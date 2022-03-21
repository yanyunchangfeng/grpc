import * as  grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { PackageDefinition } from '@grpc/proto-loader'
import { ProtoGrpcType } from './admin_service';
import { AdminServiceClient } from './rpa/core/admin/AdminService'
import { AdminRequest } from './rpa/core/admin/AdminRequest'
import { injectable } from 'src/base/common/injector'
import ClientGrpcBaseService from './ClientGrpcBaseService';
import { isMac } from 'src/base/common/platform';

@injectable('ClientGrpcAdminService')
class ClientGrpcAdminService extends ClientGrpcBaseService {
    PROTO_PATH: string;
    proto: ProtoGrpcType;
    client: AdminServiceClient;
    packageDefinition: PackageDefinition;
    count: number = 0;
    readonly protoFileName: string = 'admin_service.proto'
    constructor() {
        super()
        this.log = this.logService.tag('ClientGrpcAdminService')
        this.PROTO_PATH = this.path.join(this.environmentService.grpcProtoPath, this.protoFileName)
        this.packageDefinition = protoLoader.loadSync(
            this.PROTO_PATH,
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        this.proto = (grpc.loadPackageDefinition(this.packageDefinition) as unknown) as ProtoGrpcType;
        if (!isMac) this.init()
    }
    async init() {
        do {
            await this.getGrpPortFromFile();
            this.count++;
        } while (!this.port && this.count < this.maxCount)
        this.client = new this.proto.rpa.core.admin.AdminService(`localhost:${this.port ? this.port : this.defaultPort}`, grpc.credentials.createInsecure());
    }
    shutDownUnary = async () => {
        const adminRequest: AdminRequest = {
            Payload: {
                ClientId: 'Z-Factory',
                AdminKey: '1'
            }
        }
        return new Promise((res, rej) => {
            this.client.shutDownUnary(adminRequest, (err, data) => {
                if (err) {
                    this.log.error(err, 'shutDownUnary err')
                    return res(false)
                }
                this.log.info('Receive shutDownUnary  Data', data)
                res(data)
            })
        })
    }
}


export default ClientGrpcAdminService

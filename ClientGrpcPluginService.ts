import * as  grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { PackageDefinition } from '@grpc/proto-loader'
import { ProtoGrpcType } from './plugin_service';
import { PluginServiceClient } from './rpa/core/plugin/PluginService';
import { InitPluginRequest } from './rpa/core/plugin/InitPluginRequest';
import { BaseResponse } from './rpa/core/plugin/BaseResponse';
import { RunPluginRequest } from './rpa/core/plugin/RunPluginRequest';
import { SetParamPluginRequest } from './rpa/core/plugin/SetParamPluginRequest';
import { DisposePluginRequest } from './rpa/core/plugin/DisposePluginRequest';
import { RunPluginFromClientRequest } from './rpa/core/plugin/RunPluginFromClientRequest';
import { injectable } from 'src/base/common/injector';
import { ClientResponse } from './rpa/core/plugin/ClientResponse';
import ClientGrpcBaseService from './ClientGrpcBaseService';
import { Message } from 'src/workbench/electron-renderer/ui-lib';
import { isMac } from 'src/base/common/platform';
@injectable('ClientGrpcPluginService')
class ClientGrpcPluginService extends ClientGrpcBaseService {
    PROTO_PATH: string;
    proto: ProtoGrpcType;
    client: PluginServiceClient;
    packageDefinition: PackageDefinition;
    count: number = 0;
    readonly protoFileName: string = 'plugin_service.proto'
    constructor() {
        super()
        this.log = this.logService.tag('ClientGrpcPluginService')
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
        this.init()
    }
    async init() {
        do {
            await this.getGrpPortFromFile();
            this.count++;
        } while (!this.port && this.count < 1000)
        this.client = new this.proto.rpa.core.plugin.PluginService(`localhost:${this.port ? this.port : this.defaultPort}`, grpc.credentials.createInsecure());
    }
    pluginInitUnary = async (request: InitPluginRequest): Promise<BaseResponse> => {
        return new Promise((res, rej) => {
            this.client.pluginInitUnary(request, (err, data) => {
                if (err) {
                    this.log.error(err, 'pluginInitUnary err')
                    return res({ code: 1, message: '操作失败，请重试' })
                }
                this.log.info('Receive pluginInitUnary  Data', data)
                res(data)
            })
        })

    }
    pluginRunUnary = async (request: RunPluginRequest): Promise<BaseResponse> => {
        return new Promise((res, rej) => {
            if (!this.client) return
            this.client.pluginRunUnary(request, (err, data) => {
                if (err) {
                    this.log.error(err, 'pluginRunUnary err')
                    return res({ code: 1, message: '操作失败，请重试' })
                }
                this.log.info('Receive pluginRunUnary  Data', data)
                res(data)
            })
        })

    }
    pluginSetParamUnary = async (request: SetParamPluginRequest): Promise<BaseResponse> => {
        return new Promise((res, rej) => {
            this.client.pluginSetParamUnary(request, (err, data) => {
                if (err) {
                    this.log.error(err, 'pluginSetParamUnary err')
                    return res({ code: 1, message: '操作失败，请重试' })
                }
                this.log.info('Receive pluginSetParamUnary  Data', data)
                res(data)
            })
        })
    }
    pluginDisposeUnary = async (request: DisposePluginRequest): Promise<BaseResponse> => {
        return new Promise((res, rej) => {
            this.client.pluginDisposeUnary(request, (err, data) => {
                if (err) {
                    this.log.error(err, 'pluginDisposeUnary err')
                    return res({ code: 1, message: '操作失败，请重试' })
                }
                this.log.info('Receive pluginDisposeUnary  Data', data)
                res(data)
            })
        })

    }
    pluginRunFromClientUnary = async (request: RunPluginFromClientRequest): Promise<ClientResponse> => {
        return new Promise((res, rej) => {
            this.client.pluginRunFromClientUnary(request, (err, data) => {
                if (err) {
                    this.log.error(err, 'pluginRunFromClientUnary err')
                    return res({ code: 1, message: '操作失败，请重试' })
                }
                this.log.info('Receive pluginRunFromClientUnary  Data', data)
                return res(data)
            })
        })

    }
}


export default ClientGrpcPluginService

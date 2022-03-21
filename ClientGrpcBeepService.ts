
import * as  grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { PackageDefinition } from '@grpc/proto-loader'
import { ProtoGrpcType } from './beep_service';
import { BeepServiceClient } from './rpa/core/beep/BeepService'
import { Beep } from './rpa/core/beep/Beep'
import { injectable } from 'src/base/common/injector'
import ClientGrpcBaseService from './ClientGrpcBaseService';
import { isMac } from 'src/base/common/platform';
@injectable('ClientGrpcBeepService')
class ClientGrpcBeepService extends ClientGrpcBaseService {
    PROTO_PATH: string;
    proto: ProtoGrpcType;
    client: BeepServiceClient;
    packageDefinition: PackageDefinition;
    intervalId;
    heartBeatGap: number = 5000;
    count: number = 0;
    readonly protoFileName: string = 'beep_service.proto'
    constructor() {
        super()
        this.log = this.logService.tag('ClientGrpcBeepService')
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
        if (!isMac) this.init().then(this.startHeartBeep)
    }
    startHeartBeep = () => {
        this.intervalId = setInterval(this.doStreamHeartBeat, this.heartBeatGap)
    }
    async init() {
        do {
            await this.getGrpPortFromFile();
            this.count++;
        } while (!this.port && this.count < this.maxCount)
        this.client = new this.proto.rpa.core.beep.BeepService(`localhost:${this.port ? this.port : this.defaultPort}`, grpc.credentials.createInsecure());
    }
    doStreamHeartBeat = async () => {
        const beepPingPongStream = this.client.beepPingPongStreaming();
        const beepRequest: Beep = {
            "Beep": "1",
            "Payload": {
                "ClientId": 'Z-Factory'
            }
        }
        beepPingPongStream.on('data', (data) => {
            this.log.info(data, 'Receive beepPingPongStream Data')
        })
        beepPingPongStream.on('end', () => {
            this.log.info('beepPingPongStream end')
        })
        beepPingPongStream.on('status', status => {
            this.log.info(status, 'beepPingPongStream status')
        })
        beepPingPongStream.on('error', err => {
            this.log.info(err, 'beepPingPongStream error')
        })
        beepPingPongStream.write(beepRequest)
        beepPingPongStream.end()
    }
}


export default ClientGrpcBeepService



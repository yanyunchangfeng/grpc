import * as grpc from '@grpc/grpc-js';
import type { PackageDefinition } from '@grpc/proto-loader';
import * as protoLoader from '@grpc/proto-loader';
import { MessageServiceClient } from './rpa/core/message/MessageService';
import { ProtoGrpcType } from './message_service';
import { ClientMessage, ClientMessageAction } from './rpa/core/message/ClientMessage';
import { ServerMessage } from './rpa/core/message/ServerMessage';
import ClientGrpcBaseService from './ClientGrpcBaseService';
import { injectable } from 'src/base/common/injector';
import { BehaviorSubject, Observable } from 'rxjs';

interface IPendingJobs {
    handler: Function;
    data: string;
}

@injectable('ClientGrpcMessageService')
class ClientGrpcMessageService extends ClientGrpcBaseService {
    PROTO_PATH: string;
    proto: ProtoGrpcType;
    client: MessageServiceClient;
    packageDefinition: PackageDefinition;
    readonly protoFileName: string = 'message_service.proto';
    count: number = 0;
    clientMessage: ClientMessage = {};
    clientMessageStreaming$;
    serverMessage$: BehaviorSubject<ServerMessage> = new BehaviorSubject<ServerMessage>(this.clientMessage);
    pendingJobs: IPendingJobs[] = [];
    $selectorInfo: BehaviorSubject<{}> = new BehaviorSubject({})
    jobId: string;
    constructor() {
        super()
        this.log = this.logService.tag('ClientGrpcMessageService');
        this.PROTO_PATH = this.path.join(this.environmentService.grpcProtoPath, this.protoFileName)
        this.packageDefinition = protoLoader.loadSync(this.PROTO_PATH, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        })
        this.proto = (grpc.loadPackageDefinition(this.packageDefinition) as unknown) as ProtoGrpcType
        this.init()
    }
    async init() {
        do {
            await this.getGrpPortFromFile();
            ++this.count;
        } while (!this.port && this.count < 1000)
        this.client = new this.proto.rpa.core.message.MessageService(`localhost:${this.port ? this.port : this.defaultPort}`, grpc.credentials.createInsecure())
    }
    initClientMessageStreaming = () => {
        this.clearClientMessage();
        this.clearClientMessageStream();
        this.clearJob()
        this.clientMessageStreaming$ = this.client.clientMessageStreaming();
        this.onClientMessageStreaming()
    }
    onClientMessageStreaming = () => {
        this.clientMessageStreaming$.on('data', (data) => {
            this.log.info(data, 'Receive clientMessageStreaming Data')
            this.clientMessage = data
            if (data['Action'] === ClientMessageAction.ShowSelectorEditor) {
              try {
                this.$selectorInfo.next(JSON.parse(data['Message']))
              }catch (e) {
                this.log.info(e, 'error')
              }
            }
            if (this.pendingJobs.length) {
                const unitJob = this.pendingJobs.shift()
                unitJob.handler(data)
            }
            this.setServerData(data)
        })
        this.clientMessageStreaming$.on('end', () => {
            this.log.info('clientMessageStreaming end')
        })
        this.clientMessageStreaming$.on('status', status => {
            this.log.info(status, 'clientMessageStreaming status')
        })
        this.clientMessageStreaming$.on('error', err => {
            this.log.info(err, 'clientMessageStreaming error')
            this.clearClientMessage()
            this.clearClientMessageStream()
            if (this.pendingJobs.length) {
                const unitJob = this.pendingJobs.shift()
                unitJob.handler({})
            }
            this.clearServerData()
            this.clearJob()
        })
    }
    clientMessageStreaming = async (clientMessage: ClientMessage = {}): Promise<ServerMessage> => {
        clientMessage = { ...this.clientMessage, ...clientMessage }
        return new Promise((res, rej) => {
            this.pendingJobs.push({
                handler: res,
                data: this.genernateJobId()
            });
          this.clientMessageStreaming$.write(clientMessage)
        })
    }
    genernateJobId = (len = 10) => {
        return this.randomString(len)
    }
    clearJob = () => {
        this.pendingJobs = [];
    }
    setServerData = (data) => {
        this.serverMessage$.next(data);
    }
    getServerData = (): Observable<ServerMessage> => {
        return this.serverMessage$.asObservable();
    }
    clearServerData = () => {
        this.serverMessage$.next({});
    }
    clearClientMessage = () => {
        this.clientMessage = {}
    }
    clearClientMessageStream = () => {
        this.clientMessageStreaming$ = null;
    }
}


export default ClientGrpcMessageService

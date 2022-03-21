import FileService from "src/platform/file/common/FileService";
import { injectable, inject } from 'src/base/common/injector';
import EnvironmentService from 'src/platform/environment/common/EnvironmentService';
import LogService, { ITag } from 'src/platform/log/browser';
import randomString from "src/base/common/randomString";
const path = require('path')
@injectable('ClientGrpcBaseService')
class ClientGrpcBaseService {
    @inject() fileService: FileService
    @inject() environmentService: EnvironmentService
    @inject() logService: LogService
    log: ITag;
    port: string;
    defaultPort: string = '7181'
    maxCount: number = 1000;
    randomString = randomString;
    path = path;
    constructor() {
        this.log = this.logService.tag('ClientGrpcBaseService')
    }
    async getGrpPortFromFile() {
        try {
            let port: any = await this.fileService.readFile(
                this.environmentService.grpcPortFile
            )
            this.log.info(port, 'port')
            this.port = port
        } catch (error) {
            this.log.error('getGrpPortFromFile error', error)
        }
    }

}

export default ClientGrpcBaseService
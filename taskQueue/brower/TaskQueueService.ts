import { injectable } from "src/base/common/injector";
import { ITaskList, RequiredTaskQueue } from './types'

@injectable('TaskQueueService')
class TaskQueueService implements RequiredTaskQueue {
    totalTaskCount: number = 0;
    taskList: ITaskList[] = [];
    taskHandle = null; // 当前处理的任务
    currentTaskNumber: number = 0;
    timeout: number = 1000;
    allStartTime: number;
    constructor() {

    }
    /**
     * [enqueueTask 把任务推入队列]
     * @param taskHandler {Function} [ 需要推入的任务函数 ]
     * @param taskData {any} [执行任务需要传入的数据] 
     * @memberof TaskQueueService
     */
    enqueueTask = (taskHandler: Function, taskData) => {
        this.allStartTime = Date.now()
        this.taskList.push({
            handler: taskHandler,
            data: taskData
        })
        this.totalTaskCount++;
        if (!this.taskHandle) {
            this.taskHandle = requestIdleCallback(this.runTaskQueue, { timeout: this.timeout })
        }
    }
    /**
     * [runTaskQueue 运行队列里的任务 ]
     * @param deadLine {IdleDeadline} [requestIdleCallback deadLine]
     * @memberof TaskQueueService
     */
    runTaskQueue = (deadLine: IdleDeadline) => {
        while ((deadLine.timeRemaining() > 0 || deadLine.didTimeout) && this.taskList.length) {
            let task = this.taskList.shift();
            this.currentTaskNumber++;
            task.handler(task.data);
        }
        if (this.taskList.length) return this.taskHandle = requestIdleCallback(this.runTaskQueue, { timeout: this.timeout });
        this.taskHandle = 0;
    }
}
export default TaskQueueService
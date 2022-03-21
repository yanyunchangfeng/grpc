
type Partial<T> = {
    [P in keyof T]?: T[P];
}
type Required<T> = {
    [K in keyof T]-?: T[K];
};
export interface ITaskList {
    handler: Function;
    data?: any
}

export interface ITaskQueue {
    enqueueTask(taskHandler: Function, taskData?: any): void
    runTaskQueue(deadLine: IdleDeadline): void
}


export type PartialTaskList = Partial<ITaskList>

export type RequiredTaskQueue = Required<ITaskQueue>
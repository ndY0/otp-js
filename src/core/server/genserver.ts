import { AnyObject } from '../../types'
import { CommonServer } from '../common/server-common'

export abstract class GenServer extends CommonServer {
    protected static async *call<T extends typeof GenServer>(
        self: string,
        sid: string,
        target: T,
        op: keyof InstanceType<T>['server'],
        data: AnyObject,
        timeout: number = 10_000
    ) {}
    protected static async *cast<T extends typeof GenServer>(
        sid: string,
        target: T,
        op: keyof InstanceType<T>['server'],
        data: AnyObject
    ) {}
}

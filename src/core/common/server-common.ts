import { v1 } from 'uuid'
import { XOR } from '../../types'
import { HandlerAction } from '../constants/handler-actions'
import { ITransport } from '../interfaces/transport-interface'

export abstract class CommonServer<T = any> {
    protected id = v1()
    protected static transport: ITransport
    public abstract server: {
        [key: string]: (
            state: T
        ) => AsyncGenerator<
            unknown,
            XOR<
                { action: HandlerAction.REPLY; reply: any; state: T },
                { action: HandlerAction.NO_REPLY; state: T }
            >,
            unknown
        >
    }
    public abstract startLink(
        ...args: any
    ): AsyncGenerator<unknown, any, unknown>
    public static client: {
        [key: string]: <U>(
            ...args: any[]
        ) => AsyncGenerator<unknown, U | void, unknown>
    }
}

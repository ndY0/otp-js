import { NO_REPLY, REPLY } from '../src/core/constants/handler-actions'
import { GenServer } from '../src/core/server/genserver'

class TestServer extends GenServer {
    public async *startLink() {
        return yield { test: 'test' }
    }

    public server = {
        async *test(state: { test: string }) {
            yield true
            return {
                action: REPLY,
                state,
                reply: {},
            }
        },
        async *test2(state: { test: string }) {
            yield true
            return {
                action: NO_REPLY,
                state,
            }
        },
    }

    public static client = {
        async *testClient(self: string, sid: string, data: { foo: 'bar' }) {
            return yield* GenServer.call(self, sid, TestServer, 'test', data)
        },
    }
}

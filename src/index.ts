import { GenServer } from "./core/server/genserver";
import { NO_REPLY, REPLY } from "./core/constants/handler-actions";
import { Transport } from "./core/annotations/transport";
import { MemoryTransport } from "./core/transports/memory.transport";
import { GenSupervisor } from "./core/supervisor/gensupervisor";
import { fromGenerator } from "./utils/effects";
import { RestartStrategy } from "./core/constants/restart-strategy";

@Transport(MemoryTransport, 10_000)
class TestServer extends GenServer {
  public async *start() {
    return { test: "test" };
  }

  public server = {
    async *test(data: { foo: string }, state: { test: string }) {
      yield true;
      return {
        action: REPLY,
        state,
        reply: {},
      };
    },
    async *test2(data: { foo: string }, state: { test: string }) {
      yield true;
      return {
        action: NO_REPLY,
        state,
      };
    },
  };

  public static client = {
    async *testClient(self: string, sid: string, data: { foo: "bar" }) {
      return yield* GenServer.call(self, sid, TestServer, "test", data);
    },
  };
}

@Transport(MemoryTransport, 10_000)
class TestSupervisor extends GenSupervisor {
  public static children() {
    return [{ target: TestServer, initArgs: [] }];
  }
}
console.log(TestSupervisor);
const test = new TestSupervisor();
fromGenerator(test.startLink(TestSupervisor, RestartStrategy.ONE_FOR_ONE));

fromGenerator(
  TestSupervisor.client.countChildren(
    TestSupervisor.name,
    TestSupervisor.name,
    TestSupervisor
  )
).then(console.log);

import { GenServer } from "./core/server/genserver";
import { NO_REPLY, REPLY } from "./core/constants/handler-actions";

class TestServer extends GenServer {
  public async *start() {
    return { test: "test" };
  }

  public server = {
    async *test(state: { test: string }) {
      yield true;
      return {
        action: REPLY,
        state,
        reply: {},
      };
    },
    async *test2(state: { test: string }) {
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

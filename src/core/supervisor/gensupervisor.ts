import { Without } from "../../types";
import { fromGenerator } from "../../utils/effects";
import { superviseOneForOne } from "../../utils/supervision";
import { CommonServer } from "../common/server-common";
import { ChildResolve } from "../constants/child-resolve";
import { ChildRestart } from "../constants/child-restart";
import { HandlerAction, NO_REPLY, REPLY } from "../constants/handler-actions";
import { ProcessTermination } from "../constants/process-termination";
import { RestartStrategy } from "../constants/restart-strategy";
import { IServiceMessage } from "../interfaces/messaging/service-message.interface";
import { GenServer } from "../server/genserver";

export abstract class GenSupervisor extends CommonServer {
  public static childSpec = {
    resolve: ChildResolve.MODULE,
    restart: ChildRestart.PERMANENT,
  };
  public server = {};
  static client = {};
  static clientService = {};
  protected static children: () => {
    target: typeof CommonServer & (new (...args: any[]) => CommonServer);
    initArgs: any[];
  }[];
  async *start<T extends typeof GenSupervisor>(
    target: T,
    strategy: RestartStrategy
  ) {
    const workersState = new Map(
      target.children().map(({ target, initArgs }) => {
        const worker = new (target as { new (...args: any[]): CommonServer })(
          target
        );
        const ref =
          target.childSpec.resolve === ChildResolve.MODULE
            ? target.name
            : worker.id;
        return [
          ref,
          {
            target,
            worker,
            initArgs,
            ref:
              target.childSpec.resolve === ChildResolve.MODULE
                ? target.name
                : worker.id,
            spec: target.childSpec,
            workerLinkPipeline: worker.link(),
          },
        ];
      })
    );
    if (strategy === RestartStrategy.ONE_FOR_ONE) {
      workersState.forEach(superviseOneForOne);
      return workersState;
    } else if (strategy === RestartStrategy.ONE_FOR_ALL) {
    } else {
    }
  }
  //TODO : implement server function to handle inittialisation of watching children,
  // and client function to alter the state of supervised children
}

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

class TestSupervisor extends GenSupervisor {
  protected static children() {
    return [{ target: TestServer, initArgs: [] }];
  }
}

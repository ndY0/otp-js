import { Without } from "../../types";
import { fromGenerator } from "../../utils/effects";
import {
  superviseOneForAll,
  superviseOneForOne,
} from "../../utils/supervision";
import { Transport } from "../annotations/transport";
import { CommonServer } from "../common/server-common";
import { ChildResolve } from "../constants/child-resolve";
import { ChildRestart } from "../constants/child-restart";
import { HandlerAction, NO_REPLY, REPLY } from "../constants/handler-actions";
import { MessageAction } from "../constants/message-actions";
import { ProcessTermination } from "../constants/process-termination";
import { RestartStrategy } from "../constants/restart-strategy";
import { ServiceAction } from "../constants/service-actions";
import { IServiceMessage } from "../interfaces/messaging/service-message.interface";
import { GenServer } from "../server/genserver";
import { MemoryTransport } from "../transports/memory.transport";

export abstract class GenSupervisor extends CommonServer {
  public static childSpec = {
    resolve: ChildResolve.MODULE,
    restart: ChildRestart.PERMANENT,
  };
  public server = {};
  static client = {};
  protected service = {
    async *[ServiceAction.STOP](serviceMessage: IServiceMessage) {
      // récupérer ici tout les enfants (implémenter la méthode coté client) puis les stopper via le clientService
      yield* GenSupervisor.transport.putServiceMessage({
        action: MessageAction.STOP,
        data: { sid: serviceMessage.sid },
      });
      return {
        action: REPLY,
        reply: { status: true },
      };
    },
    async *[ServiceAction.KILL](serviceMessage: IServiceMessage) {
      // idem
      yield* GenSupervisor.transport.putServiceMessage({
        action: MessageAction.STOP,
        data: { sid: serviceMessage.sid },
      });
      return {
        action: NO_REPLY,
      };
    },
  };
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
    } else {
      superviseOneForAll(workersState);
    }
    workersState.forEach(({ worker, initArgs }) => {
      fromGenerator(worker.startLink(target, ...initArgs));
    });
    return workersState;
  }
  /**
   * ce a quoi il faut penser :
   * - conditions d'arret du supervisor ?
   * - propager l'arret du supervisor au workers !
   */
}

@Transport(MemoryTransport, 10_000)
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

@Transport(MemoryTransport, 10_000)
class TestSupervisor extends GenSupervisor {
  protected static children() {
    return [{ target: TestServer, initArgs: [] }];
  }
}

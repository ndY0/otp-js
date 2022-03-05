import { Observable } from "rxjs";
import { fromGenerator } from "../../utils/effects";
import {
  superviseOneForAll,
  superviseOneForOne,
} from "../../utils/supervision";
import { CommonServer } from "../common/server-common";
import { ChildResolve } from "../constants/child-resolve";
import { ChildRestart } from "../constants/child-restart";
import { NO_REPLY, REPLY } from "../constants/handler-actions";
import { MessageAction } from "../constants/message-actions";
import { ProcessTermination } from "../constants/process-termination";
import { RestartStrategy } from "../constants/restart-strategy";
import { ServiceAction } from "../constants/service-actions";
import { IServiceMessage } from "../interfaces/messaging/service-message.interface";
import { ChildSpec } from "../interfaces/servers/child-spec";

export abstract class GenSupervisor extends CommonServer {
  public id: string;
  constructor() {
    super();
    this.id = this.constructor.name;
  }
  public static childSpec = {
    resolve: ChildResolve.MODULE,
    restart: ChildRestart.PERMANENT,
  };
  public server = {
    async *getChildren(
      _: any,
      state: Map<
        string,
        {
          target: typeof CommonServer & (new (...args: any[]) => CommonServer);
          worker: CommonServer;
          initArgs: any[];
          ref: string;
          spec: ChildSpec;
          workerLinkPipeline: Observable<{
            termination: ProcessTermination;
            term?: any;
          }>;
        }
      >
    ) {
      return {
        state,
        action: REPLY,
        reply: Array.from(state).map(([, { ref }]) => ref),
      };
    },
    async *stopChild(
      { sid }: { sid: string },
      state: Map<
        string,
        {
          target: typeof CommonServer & (new (...args: any[]) => CommonServer);
          worker: CommonServer;
          initArgs: any[];
          ref: string;
          spec: ChildSpec;
          workerLinkPipeline: Observable<{
            termination: ProcessTermination;
            term?: any;
          }>;
        }
      >
    ) {
      const worker = state.get(sid);
      if (worker) {
        worker.target.castService(sid, worker.target, ServiceAction.KILL);
      }
      return {
        state,
        action: NO_REPLY,
      };
    },
    async *countChildren(
      { sid }: { sid: string },
      state: Map<
        string,
        {
          target: typeof CommonServer & (new (...args: any[]) => CommonServer);
          worker: CommonServer;
          initArgs: any[];
          ref: string;
          spec: ChildSpec;
          workerLinkPipeline: Observable<{
            termination: ProcessTermination;
            term?: any;
          }>;
        }
      >
    ) {
      return {
        state,
        action: REPLY,
        reply: { count: state.size },
      };
    },
  };
  static client = {
    async *getChildren(self: string, sid: string, target: typeof CommonServer) {
      return yield* GenSupervisor.call(self, sid, target, "getChildren", {});
    },
    async *countChildren(
      self: string,
      sid: string,
      target: typeof CommonServer
    ) {
      return yield* GenSupervisor.call(self, sid, target, "countChildren", {});
    },
    async *stopChild(
      sid: string,
      target: typeof CommonServer,
      data: { sid: string }
    ) {
      return yield* GenSupervisor.cast(sid, target, "stopChild", data);
    },
  };
  protected service = {
    async *[ServiceAction.STOP](
      serviceMessage: IServiceMessage,
      state: Map<
        string,
        {
          target: typeof CommonServer & (new (...args: any[]) => CommonServer);
          worker: CommonServer;
          initArgs: any[];
          ref: string;
          spec: ChildSpec;
          workerLinkPipeline: Observable<{
            termination: ProcessTermination;
            term?: any;
          }>;
        }
      >
    ) {
      for (const [ref, { target }] of state) {
        yield* target.callService(
          serviceMessage.sid,
          ref,
          target,
          ServiceAction.STOP
        );
      }
      yield* GenSupervisor.transport.putServiceMessage({
        action: MessageAction.STOP,
        data: { sid: serviceMessage.sid },
      });
      return {
        action: REPLY,
        reply: { status: true },
      };
    },
    async *[ServiceAction.KILL](
      serviceMessage: IServiceMessage,
      state: Map<
        string,
        {
          target: typeof CommonServer & (new (...args: any[]) => CommonServer);
          worker: CommonServer;
          initArgs: any[];
          ref: string;
          spec: ChildSpec;
          workerLinkPipeline: Observable<{
            termination: ProcessTermination;
            term?: any;
          }>;
        }
      >
    ) {
      for (const [ref, { target }] of state) {
        yield* target.castService(ref, target, ServiceAction.STOP);
      }
      yield* GenSupervisor.transport.putServiceMessage({
        action: MessageAction.STOP,
        data: { sid: serviceMessage.sid },
      });
      return {
        action: NO_REPLY,
      };
    },
  };
  public static children: () => {
    target: typeof CommonServer & (new (...args: any[]) => CommonServer);
    initArgs: any[];
  }[];
  public async *startLink<T extends typeof CommonServer>(
    target: T,
    strategy: RestartStrategy
  ) {
    yield* super.startLink(target, strategy);
  }
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
    workersState.forEach(({ target, worker, initArgs }) => {
      fromGenerator(worker.startLink(target, ...initArgs));
    });
    return workersState;
  }
  /**
   * ce a quoi il faut penser :
   * - conditions d'arret du supervisor ?
   * - propager l'arret du supervisor au workers ! => DONE
   */
}

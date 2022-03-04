import { Subscription } from "rxjs";
import { AnyObject, XOR } from "../../types";
import { fromGenerator } from "../../utils/effects";
import { HandlerAction } from "../constants/handler-actions";
import { MessageAction } from "../constants/message-actions";
import { ProcessTermination } from "../constants/process-termination";
import { ServiceAction } from "../constants/service-actions";
import { IMessage } from "../interfaces/messaging/message.interface";
import { IServiceMessageReply } from "../interfaces/messaging/service-message-reply.interface";
import { IServiceMessage } from "../interfaces/messaging/service-message.interface";
import { ChildSpec } from "../interfaces/servers/child-spec";
import { ITransport } from "../interfaces/transport-interface";
import { Link } from "../link/link";

export abstract class CommonServer {
  public abstract id: string;
  private innerLink = new Link();
  protected static transport: ITransport;
  public abstract server: {
    [key: string]: (
      data: any,
      state: any
    ) => AsyncGenerator<
      unknown,
      XOR<
        { action: HandlerAction.REPLY; reply: any; state: any },
        { action: HandlerAction.NO_REPLY; state: any }
      >,
      unknown
    >;
  };
  protected abstract service: {
    [key in ServiceAction]?: (
      serviceMessage: IServiceMessage,
      state: any
    ) => AsyncGenerator<
      unknown,
      XOR<
        { action: HandlerAction.REPLY; reply: any },
        { action: HandlerAction.NO_REPLY }
      >,
      unknown
    >;
  };
  public abstract start(...args: any): AsyncGenerator<unknown, any, unknown>;
  public static childSpec: ChildSpec;
  public async *startLink<T extends typeof CommonServer>(
    target: T,
    ...args: any[]
  ) {
    const state = yield* this.start(target, ...args);
    try {
      await Promise.race([
        fromGenerator(this.runMessages(state)).then(() => {
          fromGenerator(
            this.innerLink.signal({
              termination: ProcessTermination.NORMAL,
            })
          );
        }),
        fromGenerator(this.runServiceMessages(state)).then(() => {
          fromGenerator(
            this.innerLink.signal({
              termination: ProcessTermination.SHUTDOWN,
            })
          );
        }),
      ]);
      yield* CommonServer.castService(this.id, target, ServiceAction.KILL);
    } catch (error: any) {
      yield* CommonServer.castService(this.id, target, ServiceAction.KILL);
      yield* this.innerLink.signal({
        termination: ProcessTermination.ERROR,
        term: error,
      });
    }
  }
  private async *runMessages(initState: any) {
    const messageRunner = CommonServer.transport.takeEveryMessage(this.id);
    let state = initState;
    while (true) {
      yield* CommonServer.transport.nextMessage(this.id);
      const { done, value }: IteratorResult<Subscription | IMessage, void> =
        await messageRunner.next();
      let data: IMessage;
      if (done) {
        break;
      } else {
        data = value as IMessage;
      }
      if (data) {
        const response = yield* this.server[data.op](data.data, state);
        if (response.action === HandlerAction.REPLY && data.self) {
          yield* CommonServer.transport.putMessageReply({
            data: response.reply,
            sid: data.self,
            status: true,
          });
        }
        state = response.state;
      }
    }
  }
  private async *runServiceMessages(state: any) {
    const serviceMessageRunner = CommonServer.transport.takeEveryServiceMessage(
      this.id
    );
    while (true) {
      yield* CommonServer.transport.nextServiceMessage(this.id);
      const { done, value } = await serviceMessageRunner.next();
      let data: IServiceMessage;
      if (done) {
        break;
      } else {
        data = value as IServiceMessage;
      }
      if (data) {
        const serviceHandler = this.service[data.op];
        if (serviceHandler) {
          const response = yield* serviceHandler(data, state);
          if (response.action === HandlerAction.REPLY && data.self) {
            yield* CommonServer.transport.putServiceMessageReply({
              data: response.reply,
              status: true,
              op: data.op,
              sid: data.self,
            });
          }
        } else {
          if (data.self) {
            yield* CommonServer.transport.putServiceMessageReply({
              data: {
                error: `service command ${data.op} not supported`,
              },
              status: true,
              op: data.op,
              sid: data.self,
            });
          }
        }
      }
    }
  }
  public static client: {
    [key: string]: (...args: any[]) => AsyncGenerator<unknown, any, unknown>;
  };
  public static clientService = {
    async *[ServiceAction.STOP](
      self: string,
      sid: string,
      target: typeof CommonServer,
      timeout = 10_000
    ) {
      const res: IServiceMessageReply = yield* CommonServer.callService(
        self,
        sid,
        target,
        ServiceAction.STOP,
        timeout
      );
      return res;
    },
    async *[ServiceAction.KILL](sid: string, target: typeof CommonServer) {
      yield* CommonServer.castService(sid, target, ServiceAction.KILL);
    },
  };
  protected static async *callService<T extends typeof CommonServer>(
    self: string,
    sid: string,
    target: T,
    op: ServiceAction,
    timeout: number = 10_000
  ) {
    yield* target.transport.putServiceMessage({
      action: MessageAction.ADD,
      data: {
        op,
        sid,
        self,
      },
    });
    return yield* target.transport.takeServiceMessageReply(sid, op, timeout);
  }
  protected static async *castService<T extends typeof CommonServer>(
    sid: string,
    target: T,
    op: ServiceAction
  ) {
    yield* target.transport.putServiceMessage({
      action: MessageAction.ADD,
      data: {
        op,
        sid,
      },
    });
  }
  protected static async *call<T extends typeof CommonServer>(
    self: string,
    sid: string,
    target: T,
    op: Exclude<keyof InstanceType<T>["server"], symbol>,
    data: AnyObject,
    timeout: number = 10_000
  ) {
    yield* target.transport.putMessage({
      action: MessageAction.ADD,
      data: {
        data,
        op,
        sid,
        self,
      },
    });
    return yield* target.transport.takeMessageReply(sid, timeout);
  }
  protected static async *cast<T extends typeof CommonServer>(
    sid: string,
    target: T,
    op: Exclude<keyof InstanceType<T>["server"], symbol>,
    data: AnyObject
  ) {
    yield* target.transport.putMessage({
      action: MessageAction.ADD,
      data: {
        data,
        op,
        sid,
      },
    });
  }
  link() {
    return this.innerLink.link();
  }
}

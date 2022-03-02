import { v1 } from "uuid";
import { XOR } from "../../types";
import { fromGenerator } from "../../utils/effects";
import { HandlerAction } from "../constants/handler-actions";
import { MessageAction } from "../constants/message-actions";
import { ProcessTermination } from "../constants/process-termination";
import { ServiceAction } from "../constants/service-actions";
import { IMessage } from "../interfaces/messaging/message.interface";
import { IServiceMessageReply } from "../interfaces/messaging/service-message-reply.interface";
import { IServiceMessage } from "../interfaces/messaging/service-message.interface";
import { ITransport } from "../interfaces/transport-interface";
import { Link } from "../link/link";

export abstract class CommonServer {
  protected id = v1();
  private innerLink = new Link();
  protected static transport: ITransport;
  public abstract server: {
    [key: string]: (
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
      serviceMessage: IServiceMessage
    ) => AsyncGenerator<
      unknown,
      XOR<
        { action: HandlerAction.REPLY; reply: any },
        { action: HandlerAction.NO_REPLY }
      >,
      unknown
    >;
  };
  public abstract startLink(
    ...args: any
  ): AsyncGenerator<unknown, any, unknown>;
  public async *start<T extends typeof CommonServer>(
    target: T,
    ...args: any[]
  ) {
    const state = yield* this.startLink(...args);
    try {
      await Promise.race([
        fromGenerator(this.runMessages(state)).then(() => {
          fromGenerator(
            this.innerLink.signal({
              termination: ProcessTermination.NORMAL,
            })
          );
        }),
        fromGenerator(this.runServiceMessages()).then(() => {
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
      const { done, value }: IteratorResult<IMessage, void> =
        await messageRunner.next();
      if (done) {
        break;
      }
      if (value) {
        const response = yield* this.server[value.op](state);
        if (response.action === HandlerAction.REPLY && value.self) {
          yield* CommonServer.transport.putMessageReply({
            data: response.reply,
            sid: value.self,
            status: true,
          });
        }
        state = response.state;
      }
    }
  }
  private async *runServiceMessages() {
    const serviceMessageRunner = CommonServer.transport.takeEveryServiceMessage(
      this.id
    );
    while (true) {
      yield* CommonServer.transport.nextServiceMessage(this.id);
      const { done, value } = await serviceMessageRunner.next();
      if (done) {
        break;
      }
      if (value) {
        const serviceHandler = this.service[value.op];
        if (serviceHandler) {
          const response = yield* serviceHandler(value);
          if (response.action === HandlerAction.REPLY && value.self) {
            yield* CommonServer.transport.putServiceMessageReply({
              data: response.reply,
              status: true,
              op: value.op,
              sid: value.self,
            });
          }
        } else {
          if (value.self) {
            yield* CommonServer.transport.putServiceMessageReply({
              data: {
                error: `service command ${value.op} not supported`,
              },
              status: true,
              op: value.op,
              sid: value.self,
            });
          }
        }
      }
    }
  }
  public static client: {
    [key: string]: (...args: any[]) => AsyncGenerator<unknown, any, unknown>;
  };
  public static clientService: {
    [key in ServiceAction]?: (
      ...args: any[]
    ) => AsyncGenerator<unknown, IServiceMessageReply | void, unknown>;
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
  async *link() {
    return yield* this.innerLink.link();
  }
}

import { v1 } from "uuid";
import { AnyObject, XOR } from "../../types";
import { fromGenerator } from "../../utils/effects";
import { HandlerAction } from "../constants/handler-actions";
import { MessageAction } from "../constants/message-actions";
import { ServiceAction } from "../constants/service-actions";
import { IMessage } from "../interfaces/messaging/message.interface";
import { IServiceMessageReply } from "../interfaces/messaging/service-message-reply.interface";
import { IServiceMessage } from "../interfaces/messaging/service-message.interface";
import { ITransport } from "../interfaces/transport-interface";

export abstract class CommonServer<T = any> {
  protected id = v1();
  protected static transport: ITransport;
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
    >;
  };
  public abstract service: {
    [key in ServiceAction]: (
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
  public abstract startLink(...args: any): AsyncGenerator<unknown, T, unknown>;
  protected async *start(...args: any[]) {
    const state = yield* this.startLink(...args);
    await Promise.all([
      fromGenerator(this.runMessages(state)),
      fromGenerator(this.runServiceMessages()),
    ]);
  }
  private async *runMessages(initState: T) {
    const messageRunner = CommonServer.transport.takeEveryMessage(this.id);
    let state = initState;
    while (true) {
      yield* CommonServer.transport.nextMessage(this.id);
      const message: IMessage = yield messageRunner;
      const response = yield* this.server[message.op](state);
      if (response.action === HandlerAction.REPLY && message.self) {
        yield* CommonServer.transport.putMessageReply({
          data: response.reply,
          sid: message.self,
          status: true,
        });
      }
      state = response.state;
    }
  }
  private async *runServiceMessages() {
    const serviceMessageRunner = CommonServer.transport.takeEveryServiceMessage(
      this.id
    );
    while (true) {
      yield* CommonServer.transport.nextServiceMessage(this.id);
      const serviceMessage: IServiceMessage = yield serviceMessageRunner;
      const response = yield* this.service[serviceMessage.op](serviceMessage);
      if (response.action === HandlerAction.REPLY && serviceMessage.self) {
        yield* CommonServer.transport.putServiceMessageReply({
          data: response.reply,
          status: true,
          op: serviceMessage.op,
          sid: serviceMessage.self,
        });
      }
    }
  }
  public static client: {
    [key: string]: <U>(
      ...args: any[]
    ) => AsyncGenerator<unknown, U | void, unknown>;
  };
  protected static async *callService<T extends typeof CommonServer>(
    self: string,
    sid: string,
    target: T,
    op: ServiceAction,
    timeout: number = 10_000
  ) {
    yield* target.transport.putServiceMessage({
      op,
      sid,
      self,
    });
    return yield* target.transport.takeServiceMessageReply(sid, op, timeout);
  }
  protected static async *castService<T extends typeof CommonServer>(
    sid: string,
    target: T,
    op: ServiceAction
  ) {
    yield* target.transport.putServiceMessage({
      op,
      sid,
    });
  }
}

import { AnyObject } from "../../types";
import { CommonServer } from "../common/server-common";
import { ChildResolve } from "../constants/child-resolve";
import { ChildRestart } from "../constants/child-restart";
import { NO_REPLY, REPLY } from "../constants/handler-actions";
import { MessageAction } from "../constants/message-actions";
import { ServiceAction } from "../constants/service-actions";
import { IServiceMessage } from "../interfaces/messaging/service-message.interface";

export abstract class GenServer extends CommonServer {
  public static childSpec = {
    resolve: ChildResolve.MODULE,
    restart: ChildRestart.PERMANENT,
  };
  protected service = {
    async *[ServiceAction.STOP](serviceMessage: IServiceMessage) {
      yield* GenServer.transport.putServiceMessage({
        action: MessageAction.STOP,
        data: { sid: serviceMessage.sid },
      });
      return {
        action: REPLY,
        reply: { status: true },
      };
    },
    async *[ServiceAction.KILL](serviceMessage: IServiceMessage) {
      yield* GenServer.transport.putServiceMessage({
        action: MessageAction.STOP,
        data: { sid: serviceMessage.sid },
      });
      return {
        action: NO_REPLY,
      };
    },
  };

  protected static async *call<T extends typeof GenServer>(
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
  protected static async *cast<T extends typeof GenServer>(
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
}

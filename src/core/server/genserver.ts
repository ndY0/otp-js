import { v1 } from "uuid";
import { AnyObject } from "../../types";
import { CommonServer } from "../common/server-common";
import { ChildResolve } from "../constants/child-resolve";
import { ChildRestart } from "../constants/child-restart";
import { NO_REPLY, REPLY } from "../constants/handler-actions";
import { MessageAction } from "../constants/message-actions";
import { ServiceAction } from "../constants/service-actions";
import { IServiceMessage } from "../interfaces/messaging/service-message.interface";

export abstract class GenServer extends CommonServer {
  public id: string;
  constructor() {
    super();
    this.id = v1();
  }
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
}

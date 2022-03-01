import { ServiceAction } from "../constants/service-actions";
import { IMessage } from "./messaging/message.interface";
import { IReply } from "./messaging/reply.interface";
import { IServiceMessageReply } from "./messaging/service-message-reply.interface";
import { IServiceMessage } from "./messaging/service-message.interface";

export interface ITransport {
  putMessage(data: IMessage): AsyncGenerator<never, void, unknown>;
  takeEveryMessage(sid: string): AsyncGenerator<IMessage, void, unknown>;
  nextMessage(sid: string): AsyncGenerator<never, void, unknown>;
  putServiceMessage(
    data: IServiceMessage
  ): AsyncGenerator<never, void, unknown>;
  takeEveryServiceMessage(
    sid: string
  ): AsyncGenerator<IServiceMessage, void, unknown>;
  nextServiceMessage(sid: string): AsyncGenerator<never, void, unknown>;
  putMessageReply(data: IReply): AsyncGenerator<never, void, unknown>;
  takeMessageReply(
    sid: string,
    timeout: number
  ): AsyncGenerator<unknown, IReply, unknown>;
  putServiceMessageReply(
    data: IServiceMessageReply
  ): AsyncGenerator<never, void, unknown>;
  takeServiceMessageReply(
    sid: string,
    op: ServiceAction,
    timeout: number
  ): AsyncGenerator<unknown, IServiceMessageReply, unknown>;
}

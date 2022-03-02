import { share, Subject } from "rxjs";
import { MessageAction } from "../constants/message-actions";
import { IMessage } from "../interfaces/messaging/message.interface";
import { IReply } from "../interfaces/messaging/reply.interface";
import { IServiceMessageReply } from "../interfaces/messaging/service-message-reply.interface";
import { IServiceMessage } from "../interfaces/messaging/service-message.interface";
import { BaseTransport } from "./base.transport";

export class MemoryTransport extends BaseTransport {
  constructor(maxQueueSize: number) {
    const messageSubject = new Subject<{
      action: MessageAction.ADD;
      data: IMessage;
    } | { action: MessageAction.STOP, data: {sid: string} }>();
    const messagePipeline = messageSubject.pipe(share());
    const replyMessageSubject = new Subject<IReply>();
    const replyMessagePipeline = replyMessageSubject.pipe(share());
    const serviceMessageSubject = new Subject<{
      action: MessageAction.ADD;
      data: IServiceMessage;
    } | { action: MessageAction.STOP, data: {sid: string} }>();
    const serviceMessagePipeline = serviceMessageSubject.pipe(share());
    const serviceReplyMessageSubject = new Subject<IServiceMessageReply>();
    const serviceReplyMessagePipeline = serviceReplyMessageSubject.pipe(
      share()
    );
    super(
      maxQueueSize,
      messageSubject,
      messagePipeline,
      replyMessageSubject,
      replyMessagePipeline,
      serviceMessageSubject,
      serviceMessagePipeline,
      serviceReplyMessageSubject,
      serviceReplyMessagePipeline
    );
  }
}

import {
  filter,
  from,
  Observable,
  share,
  Subject,
  take,
  timeout as timeoutOperator,
  TimeoutInfo,
} from "rxjs";
import { ServiceAction } from "../constants/service-actions";
import { IMessage } from "../interfaces/messaging/message.interface";
import { IReply } from "../interfaces/messaging/reply.interface";
import { ITransport } from "../interfaces/transport-interface";
import { IServiceMessage } from "../interfaces/messaging/service-message.interface";
import { IServiceMessageReply } from "../interfaces/messaging/service-message-reply.interface";
import { fromObservable } from "../../utils/effects";

export class MemoryTransport {
  private readonly messageSubject: Subject<IMessage>;
  private readonly messagePipeline: Observable<IMessage>;
  private readonly replyMessageSubject: Subject<IReply>;
  private readonly replyMessagePipeline: Observable<IReply>;
  private readonly serviceMessageSubject: Subject<IServiceMessage>;
  private readonly serviceMessagePipeline: Observable<IServiceMessage>;
  private readonly serviceReplyMessageSubject: Subject<IServiceMessageReply>;
  private readonly serviceReplyMessagePipeline: Observable<IServiceMessageReply>;
  constructor(private readonly maxQueueSize: number) {
    this.messageSubject = new Subject();
    this.messagePipeline = this.messageSubject.pipe(share());
    this.replyMessageSubject = new Subject();
    this.replyMessagePipeline = this.replyMessageSubject.pipe(share());
    this.serviceMessageSubject = new Subject();
    this.serviceMessagePipeline = this.serviceMessageSubject.pipe(share());
    this.serviceReplyMessageSubject = new Subject();
    this.serviceReplyMessagePipeline = this.serviceReplyMessageSubject.pipe(
      share()
    );
  }

  /**
   *
   * server api
   */
  async *putMessage(data: IMessage) {
    this.messageSubject.next(data);
  }
  async *takeEveryMessage<T>(sid: string) {
    return yield* fromObservable(
      this.replyMessagePipeline.pipe(
        filter((reply: IReply) => reply.sid === sid)
      )
    );
  }

  async *putServiceMessage(data: IServiceMessage) {
    this.serviceMessageSubject.next(data);
  }
  async *takeEveryServiceMessage(sid: string) {}

  /**
   *
   * client api
   */
  async *putMessageReply(data: IReply) {
    this.replyMessageSubject.next(data);
  }
  async *takeMessageReply(sid: string, timeout: number = 10_000) {
    return yield* fromObservable(
      this.replyMessagePipeline.pipe(
        filter((reply: IReply) => reply.sid === sid),
        take(1),
        timeoutOperator({
          first: timeout,
          with: (info: TimeoutInfo<IReply>) =>
            from([
              { sid, status: false, data: { error: "timeout" } } as IReply,
            ]),
        })
      )
    );
  }

  async *putServiceMessageReply<U>(data: IServiceMessageReply) {
    this.replyMessageSubject.next(data);
  }
  async *takeServiceMessageReply<U>(
    sid: string,
    op: ServiceAction,
    timeout: number = 10_000
  ) {
    return yield* fromObservable(
      this.serviceReplyMessagePipeline.pipe(
        filter((reply: IServiceMessageReply) => reply.sid === sid),
        take(1),
        timeoutOperator({
          first: timeout,
          with: (info: TimeoutInfo<IServiceMessageReply>) =>
            from([
              {
                sid,
                status: false,
                op,
                data: { error: "timeout" },
              } as IServiceMessageReply,
            ]),
        })
      )
    );
  }
}

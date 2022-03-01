import {
  filter,
  from,
  map,
  merge,
  mergeMap,
  mergeScan,
  Observable,
  shareReplay,
  Subject,
  take,
  tap,
  timeout as timeoutOperator,
  TimeoutInfo,
} from "rxjs";
import { ServiceAction } from "../constants/service-actions";
import { IMessage } from "../interfaces/messaging/message.interface";
import { IReply } from "../interfaces/messaging/reply.interface";
import { IServiceMessage } from "../interfaces/messaging/service-message.interface";
import { IServiceMessageReply } from "../interfaces/messaging/service-message-reply.interface";
import { fromObservable } from "../../utils/effects";
import { MessageAction } from "../constants/message-actions";
import { ITransport } from "../interfaces/transport-interface";

export abstract class BaseTransport implements ITransport {
  private readonly nextMessageSubject = new Subject<{ sid: string }>();
  private readonly nextServiceMessageSubject = new Subject<{ sid: string }>();
  constructor(
    private readonly maxQueueSize: number,
    private readonly messageSubject: Subject<{
      action: MessageAction.ADD;
      data: IMessage;
    }>,
    private readonly messagePipeline: Observable<{
      action: MessageAction.ADD;
      data: IMessage;
    }>,
    private readonly replyMessageSubject: Subject<IReply>,
    private readonly replyMessagePipeline: Observable<IReply>,
    private readonly serviceMessageSubject: Subject<{
      action: MessageAction.ADD;
      data: IServiceMessage;
    }>,
    private readonly serviceMessagePipeline: Observable<{
      action: MessageAction.ADD;
      data: IServiceMessage;
    }>,
    private readonly serviceReplyMessageSubject: Subject<IServiceMessageReply>,
    private readonly serviceReplyMessagePipeline: Observable<IServiceMessageReply>
  ) {}

  /**
   *
   * server api
   */
  async *putMessage(data: IMessage) {
    this.messageSubject.next({ action: MessageAction.ADD, data });
  }
  async *takeEveryMessage(sid: string) {
    const command = new Subject<{ action: MessageAction.REMOVE_LAST }>();
    const pipeline = merge(this.messagePipeline, command).pipe(
      filter(
        (
          action:
            | { action: MessageAction.ADD; data: IMessage }
            | { action: MessageAction.REMOVE_LAST }
        ) =>
          action.action === MessageAction.REMOVE_LAST || action.data.sid === sid
      ),
      mergeScan(
        (
          acc: IMessage[],
          action:
            | { action: MessageAction.ADD; data: IMessage }
            | { action: MessageAction.REMOVE_LAST }
        ) => {
          if (action.action === MessageAction.ADD) {
            if (acc.length >= this.maxQueueSize) {
              if (action.data.self) {
                this.replyMessageSubject.next({
                  sid: action.data.self,
                  status: false,
                  data: { error: "queue is full" },
                });
              }
            } else {
              acc.push(action.data);
            }
          } else {
            acc.shift();
          }
          return from([acc]);
        },
        [] as IMessage[]
      ),
      shareReplay(1)
    );
    const combined = this.nextMessageSubject.pipe(
      filter((next: { sid: string }) => next.sid === sid),
      mergeMap(() =>
        pipeline.pipe(
          filter((messages) => messages.length > 0),
          take(1)
        )
      ),
      map((messages) => messages[0]),

      tap(() => command.next({ action: MessageAction.REMOVE_LAST }))
    );

    for await (let message of fromObservable(combined)) {
      yield message;
    }
  }
  async *nextMessage(sid: string) {
    this.nextMessageSubject.next({ sid });
  }

  async *putServiceMessage(data: IServiceMessage) {
    this.serviceMessageSubject.next({ action: MessageAction.ADD, data });
  }
  async *takeEveryServiceMessage(sid: string) {
    const command = new Subject<{ action: MessageAction.REMOVE_LAST }>();
    const pipeline = merge(this.serviceMessagePipeline, command).pipe(
      filter(
        (
          action:
            | { action: MessageAction.ADD; data: IServiceMessage }
            | { action: MessageAction.REMOVE_LAST }
        ) =>
          action.action === MessageAction.REMOVE_LAST || action.data.sid === sid
      ),
      mergeScan(
        (
          acc: IServiceMessage[],
          action:
            | { action: MessageAction.ADD; data: IServiceMessage }
            | { action: MessageAction.REMOVE_LAST }
        ) => {
          if (action.action === MessageAction.ADD) {
            if (acc.length >= this.maxQueueSize) {
              if (action.data.self) {
                this.serviceReplyMessageSubject.next({
                  sid: action.data.self,
                  status: false,
                  op: action.data.op,
                  data: { error: "queue is full" },
                });
              }
            } else {
              acc.push(action.data);
            }
          } else {
            acc.shift();
          }
          return from([acc]);
        },
        [] as IServiceMessage[]
      ),
      shareReplay(1)
    );
    const combined = this.nextMessageSubject.pipe(
      filter((next: { sid: string }) => next.sid === sid),
      mergeMap(() =>
        pipeline.pipe(
          filter((messages) => messages.length > 0),
          take(1)
        )
      ),
      map((messages) => messages[0]),

      tap(() => command.next({ action: MessageAction.REMOVE_LAST }))
    );

    for await (let message of fromObservable(combined)) {
      yield message;
    }
  }
  async *nextServiceMessage(sid: string) {
    this.nextServiceMessageSubject.next({ sid });
  }

  /**
   *
   * client api
   */
  async *putMessageReply(data: IReply) {
    this.replyMessageSubject.next(data);
  }
  async *takeMessageReply(sid: string, timeout: number = 10_000) {
    const res: IReply = yield fromObservable(
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
    return res;
  }

  async *putServiceMessageReply(data: IServiceMessageReply) {
    this.serviceReplyMessageSubject.next(data);
  }
  async *takeServiceMessageReply(
    sid: string,
    op: ServiceAction,
    timeout: number = 10_000
  ) {
    const res: IServiceMessageReply = yield fromObservable(
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
    return res;
  }
}

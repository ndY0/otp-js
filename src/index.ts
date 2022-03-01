import {
  delay,
  filter,
  from,
  interval,
  map,
  merge,
  mergeMap,
  mergeScan,
  shareReplay,
  Subject,
  take,
  tap,
} from "rxjs";
import { IMessage } from "./core/interfaces/messaging/message.interface";
import { fromObservable } from "./utils/effects";
import { MessageAction } from "./core/constants/message-actions";
import { AnyObject } from "./types";

// class TestServer extends GenServer {
//   public async *startLink() {
//     return yield { test: "test" };
//   }

//   public server = {
//     async *test(state: { test: string }) {
//       yield true;
//       return {
//         action: REPLY,
//         state,
//         reply: {},
//       };
//     },
//     async *test2(state: { test: string }) {
//       yield true;
//       return {
//         action: NO_REPLY,
//         state,
//       };
//     },
//   };

//   public static client = {
//     async *testClient(self: string, sid: string, data: { foo: "bar" }) {
//       return yield* GenServer.call(self, sid, TestServer, "test", data);
//     },
//   };
// }

const command = new Subject<{ action: MessageAction.REMOVE_LAST }>();
const pipeline = merge(
  interval(400).pipe(
    delay(500),
    map((index: number) => ({
      action: MessageAction.ADD,
      data: { sid: "1234567890", op: "test1", data: { index } as AnyObject },
    }))
  ),
  command
).pipe(
  mergeScan(
    (
      acc: IMessage[],
      action:
        | { action: MessageAction.ADD; data: IMessage }
        | { action: MessageAction.REMOVE_LAST }
    ) => {
      if (action.action === MessageAction.ADD) {
        if (acc.length >= 100) {
          console.log("full ! ");
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
  tap((messages) => console.log(messages.length)),
  shareReplay(1)
);
const combined = interval(500).pipe(
  mergeMap(() =>
    pipeline.pipe(
      filter((messages) => messages.length > 0),
      take(1)
    )
  ),
  map((messages) => messages[0]),
  tap(() => command.next({ action: MessageAction.REMOVE_LAST }))
);

// combined.subscribe({
//   complete: () => console.log("completed ! "),
//   error: (err) => console.log("error ! ", err),
//   next: (val) => console.log("value ! ", val),
// });

async function* testGen() {
  for await (const message of fromObservable(combined)) {
    yield message;
  }
}

const testFunc = async () => {
  const generator = testGen();
  let indicator = 0;
  for await (const iterator of generator) {
    console.log(indicator);

    console.log(iterator);
    indicator += 1;
  }
};

testFunc();

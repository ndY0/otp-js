import { AnyObject } from "../../types";
import { CommonServer } from "../common/server-common";

export abstract class GenServer extends CommonServer {
  protected static async *call<T extends typeof GenServer>(
    self: string,
    sid: string,
    target: T,
    op: Exclude<keyof InstanceType<T>["server"], symbol>,
    data: AnyObject,
    timeout: number = 10_000
  ) {
    yield* target.transport.putMessage({
      data,
      op,
      sid,
      self,
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
      data,
      op,
      sid,
    });
  }
}

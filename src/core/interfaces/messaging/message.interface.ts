import { AnyObject } from "../../../types";

export interface IMessage {
  sid: string;
  op: string;
  data: AnyObject;
}

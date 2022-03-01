import { AnyObject } from "../../../types";

export interface IMessage {
  sid: string;
  self?: string;
  op: string;
  data: AnyObject;
}

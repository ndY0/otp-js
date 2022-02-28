import { AnyObject } from "../../../types";
import { ServiceAction } from "../../constants/service-actions";

export interface IServiceMessageReply {
  sid: string;
  op: ServiceAction;
  status: boolean;
  data: AnyObject;
}

import { ServiceAction } from "../../constants/service-actions";

export interface IServiceMessage {
  sid: string;
  self?: string;
  op: ServiceAction;
}

import { ServiceAction } from "../../constants/service-actions";

export interface IServiceMessage {
  sid: string;
  op: ServiceAction;
}

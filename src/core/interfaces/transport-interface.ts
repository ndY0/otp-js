import { ServiceAction } from "../constants/service-actions";
import { IMessage } from "./messaging/message.interface";

export interface ITransport {
  put(data: IMessage): AsyncGenerator<unknown, void, unknown>;
  putService(
    sid: string,
    action: ServiceAction
  ): AsyncGenerator<unknown, void, unknown>;
  take<T>(self: string, timeout: number): AsyncGenerator<unknown, T, unknown>;
  takeService<U>(
    self: string,
    timeout: number
  ): AsyncGenerator<unknown, U, unknown>;
}

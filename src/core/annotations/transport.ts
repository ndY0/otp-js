import { CommonServer } from "../common/server-common";
import { ITransport } from "../interfaces/transport-interface";

const Transport =
  <
    T extends typeof CommonServer,
    U extends { new (...args: any[]): ITransport }
  >(
    transport: U,
    ...args: ConstructorParameters<U>
  ) =>
  (constructor: T) => {
    Reflect.set(constructor, "transport", new transport(...args), constructor);
  };

export { Transport };

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
    Reflect.defineProperty(constructor, "transport", {
      configurable: false,
      enumerable: false,
      value: new transport(...args),
      writable: false,
    });
  };

export { Transport };

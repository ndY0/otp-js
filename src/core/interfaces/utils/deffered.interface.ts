export interface Deferred<Value = unknown> extends Promise<Value> {
  resolve(value?: Value): void;
  reject(error: Error): void;
}

interface IAnyObject {
  [key: string | number]: AnyObject;
}

type AnyObject = Record<string | number, IAnyObject>;

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
type XOR<T, U> = T | U extends object
  ? (Without<T, U> & U) | (Without<U, T> & T)
  : T | U;

export type { AnyObject, XOR, Without };

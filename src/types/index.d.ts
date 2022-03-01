interface IAnyObject {
  [key: string | number]: AnyObject | string | number;
}

type AnyObject = Record<string | number, IAnyObject | string | number>;

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
type XOR<T, U> = T | U extends object
  ? (Without<T, U> & U) | (Without<U, T> & T)
  : T | U;

export type { AnyObject, XOR, Without };

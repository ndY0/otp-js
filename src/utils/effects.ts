import { Observable, Subscription } from "rxjs";
import { Deferred } from "../core/interfaces/utils/deffered.interface";

function defer<Value>(): Deferred<Value> {
  const transit = {} as Deferred<Value>;

  const promise = new Promise<Value>((resolve, reject) => {
    Object.assign(transit, { resolve, reject });
  });

  return Object.assign(promise, transit);
}

async function* fromObservable<T>(source: Observable<T>) {
  let running = true;
  let deferred = defer<T>();
  const subscription = source.pipe().subscribe({
    next: (value: T) => {
      setImmediate(() => {
        const result = deferred;
        deferred = defer<T>();
        result.resolve(value);
      });
    },
    error: (err: Error) => {
      setImmediate(() => {
        const result = deferred;
        deferred = defer<T>();
        result.reject(err instanceof Error ? err : new Error(String(err)));
      });
    },
    complete: () => {
      setImmediate(() => {
        running = false;
        deferred.resolve();
      });
    },
  });
  try {
    while (running) {
      yield await Promise.all([
        deferred,
        new Promise<Subscription>((resolve) => resolve(subscription)),
      ]);
    }
  } finally {
    if (!subscription.closed) {
      subscription.unsubscribe();
    }
  }
}

const fromGenerator = async <T, U>(
  generator: AsyncGenerator<U, T, unknown>
) => {
  let val: T | null = null;
  let running = true;
  while (running) {
    const { value, done } = await generator.next();
    if (done) {
      val = value as T;
    }
  }
  return val;
};

export { fromObservable, fromGenerator };

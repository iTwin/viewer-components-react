/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Observable } from "rxjs";

// cspell:words deferreds

/**
 * This is pretty much a combination of:
 * - https://github.com/benlesh/rxjs-for-await/blob/94f9cf9cb015ac3700dfd1850eb81d36962eb70f/src/index.ts#L33,
 * - https://github.com/ReactiveX/rxjs/blob/2587ee852eb43eeb0883a7787bac2944d823392b/packages/observable/src/observable.ts#L922.
 *
 * Our implementation uses a linked list rather than an array to store values, which is more efficient.
 *
 * @internal
 */
export async function* eachValueFrom<T>(source: Observable<T>): AsyncIterableIterator<T> {
  const deferreds = new Queue<{ resolve: (value: IteratorResult<T>) => void; reject: (reason: unknown) => void }>();
  const values = new Queue<IteratorResult<T>>();
  let error;
  let completed = false;
  const subs = source.subscribe({
    next: (value) => {
      const deferred = deferreds.pop();
      if (deferred) {
        deferred.resolve({ value, done: false });
      } else {
        values.push({ value, done: false });
      }
    },
    error: (err) => {
      error = err;
      for (let deferred = deferreds.pop(); deferred !== undefined; deferred = deferreds.pop()) {
        deferred.reject(err);
      }
    },
    complete: () => {
      completed = true;
      for (let deferred = deferreds.pop(); deferred !== undefined; deferred = deferreds.pop()) {
        deferred.resolve({ value: undefined, done: true });
      }
    },
  });
  try {
    while (true) {
      const queued = values.pop();
      if (queued !== undefined) {
        yield queued.value;
        continue;
      }

      if (completed) {
        return;
      }

      if (error) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw error;
      }
      const result = await new Promise<IteratorResult<T>>((resolve, reject) => {
        deferreds.push({ resolve, reject });
      });
      if (result.done) {
        return;
      }
      yield result.value;
    }
  } finally {
    subs.unsubscribe();
  }
}

class QueueEntry<T> {
  constructor(
    public readonly value: T,
    public next?: QueueEntry<T>,
  ) {}
}

class Queue<T> {
  private _front?: QueueEntry<T>;
  private _back?: QueueEntry<T>;

  public push(item: T) {
    const entry = new QueueEntry<T>(item);
    if (this._back) {
      this._back.next = entry;
    }
    this._back = entry;
    if (!this._front) {
      this._front = entry;
    }
  }

  public pop(): T | undefined {
    if (!this._front) {
      return undefined;
    }
    const value = this._front.value;
    this._front = this._front.next;
    if (!this._front) {
      this._back = undefined;
    }
    return value;
  }
}

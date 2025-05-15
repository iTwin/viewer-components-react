/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeDuration, StopWatch } from "@itwin/core-bentley";

export async function waitFor<T>(check: () => Promise<T> | T, timeout?: number): Promise<T> {
  if (timeout === undefined) {
    timeout = 5000;
  }
  const timer = new StopWatch(undefined, true);
  let lastError: unknown;
  do {
    try {
      const res = check();
      return res instanceof Promise ? await res : res;
    } catch (e) {
      lastError = e;
      await BeDuration.wait(0);
    }
  } while (timer.current.milliseconds < timeout);
  throw lastError;
}

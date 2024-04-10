/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { StopWatch } from "@itwin/core-bentley";

/** @internal */
export function trackTime(shouldTrack: boolean, onFinish: (elapsedTime: number) => void) {
  if (!shouldTrack) {
    return () => {};
  }

  let stopped = false;
  const stopwatch = new StopWatch(undefined, true);

  return (skipResult?: boolean) => {
    if (stopped) {
      return;
    }
    stopwatch.stop();
    stopped = true;
    if (skipResult) {
      return;
    }
    onFinish(stopwatch.elapsed.milliseconds);
  };
}

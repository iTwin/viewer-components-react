/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { StopWatch } from "@itwin/core-bentley";

/** @internal */
export function trackTime(shouldTrack: boolean, onFinish: (elapsedTime: number) => void) {
  if (!shouldTrack) {
    return {
      dispose: () => {},
      finish: () => {},
    };
  }

  let stopped = false;
  const stopwatch = new StopWatch(undefined, true);

  const stop = () => {
    stopwatch.stop();
    stopped = true;
  };

  return {
    dispose: stop,
    finish: () => {
      if (stopped) {
        return;
      }
      stop();
      onFinish(stopwatch.elapsed.milliseconds);
    },
  };
}

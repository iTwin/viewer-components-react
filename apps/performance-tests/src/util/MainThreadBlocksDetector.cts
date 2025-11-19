/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { setInterval } from "timers/promises";
import { SortedArray } from "@itwin/core-bentley";
import { LOGGER } from "./Logging.cjs";

const ENABLE_PINGS = false;
const LOG_CATEGORY = "Presentation.PerformanceTests.MainThreadBlocksDetector";

function log(messageOrCallback: string | (() => string)) {
  if (LOGGER.isEnabled(LOG_CATEGORY, "warning")) {
    LOGGER.logWarning(LOG_CATEGORY, typeof messageOrCallback === "string" ? messageOrCallback : messageOrCallback());
  }
}

export interface Summary {
  count: number;
  max?: number;
  p95?: number;
  median?: number;

  [key: string]: number | undefined;
}

/**
 * This class measures the durations of time when main thread is blocked.
 * This is measured by running a timer which detects cases when it is fired later than expected.
 */
export class MainThreadBlocksDetector {
  readonly #samples = new SortedArray<number>((a, b) => a - b);
  #promise?: Promise<void>;

  public getSummary(): Summary {
    const arr = this.#samples.extractArray();
    return {
      count: arr.length,
      max: arr.length ? arr[arr.length - 1] : undefined,
      p95: getP95(arr),
      median: getMedian(arr),
    };
  }

  /**
   * Starts the timer and records instances of abnormally long blocking.
   * @param threshold The minimum amount of blocking that will be considered abnormal.
   * @param interval Delay in time between each blocking check.
   */
  public start(threshold: number = 20, interval: number = 10) {
    const runTimer = async () => {
      this.#samples.clear();

      let lastTime = new Date();
      for await (const _ of setInterval(interval)) {
        const currentTime = new Date();
        const lateAmount = currentTime.getTime() - lastTime.getTime() - interval;
        if (lateAmount > threshold) {
          log(() => `${lateAmount} ms, ${lastTime.toISOString()} - ${currentTime.toISOString()}`);
          this.#samples.insert(lateAmount);
        } else if (ENABLE_PINGS) {
          log(() => `[${currentTime.toISOString()}] Ping`);
        }
        lastTime = new Date();

        if (!this.#promise) {
          break;
        }
      }
    };

    if (this.#promise) {
      throw new Error("MainThreadBlocksDetector already running.");
    }
    this.#promise = runTimer();
  }

  /** Stops the blocking timer. */
  public async stop() {
    const promise = this.#promise;
    this.#promise = undefined;
    return promise;
  }
}

function getP95(arr: number[]): number | undefined {
  if (arr.length === 0) {
    return undefined;
  }

  return arr[Math.floor(0.95 * arr.length)];
}

function getMedian(arr: number[]): number | undefined {
  if (arr.length === 0) {
    return undefined;
  }

  const middle = arr.length / 2;
  if (arr.length % 2 === 0) {
    return (arr[middle - 1] + arr[middle]) / 2;
  }
  return arr[Math.floor(middle)];
}

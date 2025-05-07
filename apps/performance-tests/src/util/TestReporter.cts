/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import asTable from "as-table";
import fs from "fs";
import Mocha from "mocha";
import { LOGGER } from "./Logging.cjs";
import { MainThreadBlocksDetector, Summary } from "./MainThreadBlocksDetector.cjs";

interface TestInfo {
  test: Mocha.Runnable;
  duration: number;
  blockingSummary: Summary;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const Base = Mocha.reporters.Base;
const { EVENT_TEST_BEGIN, EVENT_TEST_END, EVENT_SUITE_BEGIN, EVENT_SUITE_END, EVENT_RUN_END } = Mocha.Runner.constants;

const tableFormatter = asTable.configure({
  delimiter: " | ",
});

/**
 * Measures test time and the amounts of time when the main thread was blocked.
 */
export class TestReporter extends Base {
  private readonly _testStartTimes = new Map<string, number>();
  private readonly _testInfo = new Map<string, TestInfo>();
  private readonly _blockHandler = new MainThreadBlocksDetector();
  private readonly _outputPath?: string;
  private _indentLevel = 0;

  constructor(runner: Mocha.Runner, options: Mocha.MochaOptions) {
    super(runner, options);
    this._outputPath = options.reporterOptions?.BENCHMARK_OUTPUT_PATH;

    runner.on(EVENT_SUITE_BEGIN, (suite) => {
      this.print(`${suite.title}`);
      this._indentLevel++;
    });
    runner.on(EVENT_SUITE_END, () => this._indentLevel--);
    runner.on(EVENT_TEST_BEGIN, (test) => {
      // This event can be fired before beforeEach() and we do not want to measure beforeEach() blocking time.
      // Add callback to the test context, so that it could be called at the actual beginning of the test.
      test.ctx!.reporter = {
        // Must be called to start measuring.
        onTestStart: () => this.onTestStart(test),
        // Can be called to stop measuring.
        onTestEnd: async () => this.measureTestTime(test),
      };
    });
    runner.on(EVENT_TEST_END, async (test) => this.onTestEnd(test));
    runner.on(EVENT_RUN_END, () => {
      this.printResults();
      if (this._outputPath && this.failures.length === 0) {
        this.saveResults();
      }
    });
  }

  /** Print a line indented according to the level of depth in nested test suites. */
  private print(line: string = "", newLine = true) {
    line = `\r${"  ".repeat(this._indentLevel)}${line}${newLine ? "\n" : ""}`;
    process.stdout.write(line);
  }

  /** Run before each test starts. */
  private onTestStart(test: Mocha.Runnable) {
    this._blockHandler.start();
    this.print(`${test.title}...`, false);
    this._testStartTimes.set(test.fullTitle(), performance.now());
  }

  /** Run after each test passes or fails. */
  private async measureTestTime(test: Mocha.Test) {
    const endTime = performance.now();
    const fullTitle = test.fullTitle();
    const startTime = this._testStartTimes.get(fullTitle);
    if (startTime === undefined) {
      return;
    }

    const duration = Math.round((endTime - startTime) * 100) / 100;
    await this._blockHandler.stop();

    const blockingSummary = this._blockHandler.getSummary();
    this._testInfo.set(fullTitle, {
      test,
      duration,
      blockingSummary,
    });
    this._testStartTimes.delete(fullTitle);
  }

  private async onTestEnd(test: Mocha.Test) {
    await this.measureTestTime(test);

    const pass = test.isPassed();
    const duration = this._testInfo.get(test.fullTitle())!.duration;
    this.print(`${pass ? Base.symbols.ok : Base.symbols.err} ${test.title} (${duration} ms)`);
  }

  private printResults() {
    const results = [...this._testInfo.entries()].map(([testFullName, { test, duration, blockingSummary }]) => {
      const blockingInfo = Object.entries(blockingSummary)
        .filter(([_, val]) => val !== undefined)
        .map(([key, val]) => `${key}: ${(key === "count" ? val : val?.toFixed(2)) ?? "N/A"}`
        )
        .join(", ");

      /* eslint-disable @typescript-eslint/naming-convention */
      return {
        Status: test.isPassed() ? "PASS" : "FAIL",
        Test: testFullName,
        Duration: `${duration} ms`,
        Blocks: blockingInfo,
      };
      /* eslint-enable @typescript-eslint/naming-convention */
    });

    console.log();
    console.log(tableFormatter(results));

    for (const test of this.failures) {
      console.error();
      console.error(`${test.fullTitle()}:`);
      console.error(test.err);
    }
  }

  /** Saves performance results in a format that is compatible with Github benchmark action. */
  private saveResults() {
    const data = [...this._testInfo.entries()].flatMap(([fullTitle, { duration, blockingSummary }]) => {
      const durationEntry = {
        name: fullTitle,
        unit: "ms",
        value: duration,
      };

      const blockingEntry = {
        name: `${fullTitle} (P95 of main thread blocks)`,
        unit: "ms",
        value: blockingSummary.p95 ?? 0,
        extra: Object.entries(blockingSummary)
          .map(([key, val]) => `${key}: ${val ?? "N/A"}`)
          .join("\n"),
      };

      return [durationEntry, blockingEntry];
    });

    const outputPath = this._outputPath!;
    fs.writeFileSync(outputPath, JSON.stringify(data, undefined, 2));
    console.log(`Test results saved at ${outputPath}`);
  }
}

const ENABLE_PINGS = false;
const LOG_CATEGORY = "Presentation.PerformanceTests.MainThreadBlocksDetector";

function log(messageOrCallback: string | (() => string)) {
  if (LOGGER.isEnabled(LOG_CATEGORY, "trace")) {
    LOGGER.logTrace(LOG_CATEGORY, typeof messageOrCallback === "string" ? messageOrCallback : messageOrCallback());
  }
}



module.exports = TestReporter;

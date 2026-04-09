/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import asTable from "as-table";
import fs from "fs";

import type { SerializedError, UserConsoleLog } from "vitest";
import type { Reporter, TestCase, TestModule, TestSuite } from "vitest/node";
import type { Summary } from "./MainThreadBlocksDetector.js";

interface TestInfo {
  fullName: string;
  name: string;
  state: "passed" | "failed" | "skipped" | "pending";
  duration: number;
  blockingSummary: Summary;
  symbol: string;
}

const tableFormatter = asTable.configure({
  delimiter: " | ",
});

/**
 * Measures test time and the amounts of time when the main thread was blocked.
 */
export default class TestReporter implements Reporter {
  readonly #testInfo: TestInfo[] = [];
  #hasFailures = false;
  #outputPath?: string;
  #indentLevel = 0;

  public onInit(): void {
    this.#outputPath = process.env.BENCHMARK_OUTPUT_PATH;
  }

  public onTestSuiteReady(testSuite: TestSuite): void {
    this.print(`${testSuite.name}`);
    this.#indentLevel++;
  }

  public onTestSuiteResult(_testSuite: TestSuite): void {
    this.#indentLevel--;
  }

  public onUserConsoleLog(log: UserConsoleLog) {
    this.print(`  ${log.content}`);
  }

  public onTestCaseReady(testCase: TestCase): void {
    if (testCase.options.mode !== "skip") {
      this.print(`${testCase.name}...`);
    }
  }

  public onTestCaseResult(testCase: TestCase): void {
    const result = testCase.result();
    const state = result.state;
    const meta = testCase.meta();

    const info: TestInfo = {
      fullName: testCase.fullName.replaceAll(">", "").replaceAll("  ", " "),
      name: testCase.name,
      state,
      duration: meta.duration ?? 0,
      blockingSummary: meta.blockingSummary ?? { count: 0 },
      symbol: state === "passed" ? "✅" : state === "failed" ? "❌" : "⏩",
    };

    this.#testInfo.push(info);
    if (state === "failed") {
      this.#hasFailures = true;
      if (result.errors.length > 0) {
        this.printErrors(result.errors);
      }
    }

    this.print(`${info.symbol} ${testCase.name} (${info.duration} ms)`);
  }

  public onTestModuleEnd(testModule: TestModule): void {
    const errors = testModule.errors();
    if (errors.length > 0) {
      this.#hasFailures = true;
      this.print(`\n❌ Module errors in ${testModule.moduleId}:`);
      this.printErrors(errors);
    }
  }

  public printErrors(errors: ReadonlyArray<SerializedError>) {
    for (const error of errors) {
      this.print(`  ${error.name ?? "Error"}: ${error.message}`);
      if (error.stack) {
        const stackLines = error.stack.split("\n").slice(1, 6);
        for (const line of stackLines) {
          this.print(`    ${line.trim()}`);
        }
      }
    }
  }

  public onTestRunEnd(): void {
    this.printResults();
    if (this.#outputPath && !this.#hasFailures) {
      this.saveResults();
    }
  }

  /** Print a line indented according to the level of depth in nested test suites. */
  private print(line: string = "", newLine = true) {
    line = `\r${"  ".repeat(this.#indentLevel)}${line}${newLine ? "\n" : ""}`;
    process.stdout.write(line);
  }

  private printResults() {
    const results = this.#testInfo.map(({ state, fullName, duration, blockingSummary, symbol }) => {
      const blockingInfo = Object.entries(blockingSummary)
        .filter(([_, val]) => val !== undefined)
        .map(([key, val]) => `${key}: ${(key === "count" ? val : val?.toFixed(2)) ?? "N/A"}`)
        .join(", ");

      /* eslint-disable @typescript-eslint/naming-convention */

      return {
        Status: `${symbol} ${state}`,
        Test: fullName,
        Duration: `${duration} ms`,
        Blocks: blockingInfo,
      };
      /* eslint-enable @typescript-eslint/naming-convention */
    });

    console.log();
    console.log(tableFormatter(results));
  }

  /** Saves performance results in a format that is compatible with Github benchmark action. */
  private saveResults() {
    const data = this.#testInfo.flatMap(({ fullName, duration, blockingSummary }) => {
      const durationEntry = {
        name: fullName,
        unit: "ms",
        value: duration,
      };

      const blockingEntry = {
        name: `${fullName} (P95 of main thread blocks)`,
        unit: "ms",
        value: blockingSummary.p95 ?? 0,
        extra: Object.entries(blockingSummary)
          .map(([key, val]) => `${key}: ${val ?? "N/A"}`)
          .join("\n"),
      };

      return [durationEntry, blockingEntry];
    });

    const outputPath = this.#outputPath!;
    fs.writeFileSync(outputPath, JSON.stringify(data, undefined, 2));

    console.log(`Test results saved at ${outputPath}`);
  }
}

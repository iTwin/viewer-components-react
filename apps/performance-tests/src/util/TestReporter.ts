/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import asTable from "as-table";
import fs from "fs";

import type { SerializedError, UserConsoleLog } from "vitest";
import type { Reporter, TestCase, TestModule, TestRunEndReason, TestSpecification, TestSuite } from "vitest/node";
import type { Summary } from "./MainThreadBlocksDetector.js";

interface TestStepInfo {
  testFullName: string;
  stepName: string;
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
  readonly #stepResults: TestStepInfo[] = [];
  #hasFailures = false;
  #outputPath?: string;
  #indentLevel = 0;
  #symbols = {
    passed: "✅",
    failed: "❌",
    skipped: "⏩",
  };

  public onInit(): void {
    this.#outputPath = process.env.BENCHMARK_OUTPUT_PATH;
  }

  public onTestRunStart(specifications: readonly TestSpecification[]): void {
    if (specifications.length === 0) {
      this.print(`\n${this.#symbols.failed}  No test files found`);
    }
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
    const symbol = state === "passed" ? this.#symbols.passed : state === "failed" ? this.#symbols.failed : this.#symbols.skipped;
    const testFullName = testCase.fullName.replaceAll(">", "").replaceAll("  ", " ");
    const steps = meta.steps ?? [];
    for (let i = 0; i < steps.length; ++i) {
      const step = steps[i];
      const isLastStep = i === steps.length - 1;
      this.#stepResults.push({
        testFullName,
        stepName: step.name,
        state: isLastStep ? state : "passed", // if a step fails, steps before should be marked as passed, not failed
        duration: step.duration,
        blockingSummary: step.blockingSummary,
        symbol: isLastStep ? symbol : this.#symbols.passed, // if a step fails, steps before should be marked as passed, not failed
      });
    }

    if (state === "failed") {
      this.#hasFailures = true;
      if (result.errors.length > 0) {
        this.printErrors(result.errors);
      }
    }

    const totalDuration = steps.reduce<number>((sum, s) => sum + s.duration, 0);
    this.print(`${symbol} ${testCase.name} (${totalDuration} ms)`);
  }

  public onTestModuleEnd(testModule: TestModule): void {
    const errors = testModule.errors();
    if (errors.length > 0) {
      this.#hasFailures = true;
      this.print(`\n${this.#symbols.failed} Module errors in ${testModule.moduleId}:`);
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

  public onTestRunEnd(testModules: ReadonlyArray<TestModule>, unhandledErrors: ReadonlyArray<SerializedError>, reason: TestRunEndReason): void {
    if (unhandledErrors.length > 0) {
      this.#hasFailures = true;
      this.print(`\n${this.#symbols.failed} Unhandled errors:`);
      this.printErrors(unhandledErrors);
    }
    if (reason === "failed" && testModules.length === 0) {
      this.#hasFailures = true;
      this.print(`\n${this.#symbols.failed} Test run failed: no tests were executed`);
    }
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
    const results = this.#stepResults.map(({ state, testFullName, stepName, duration, blockingSummary, symbol }) => {
      const blockingInfo = Object.entries(blockingSummary)
        .filter(([_, val]) => val !== undefined)
        .map(([key, val]) => `${key}: ${(key === "count" ? val : val?.toFixed(2)) ?? "N/A"}`)
        .join(", ");

      /* eslint-disable @typescript-eslint/naming-convention */

      return {
        Status: `${symbol} ${state}`,
        Test: stepName ? `${testFullName}: ${stepName}` : testFullName,
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
    const data = this.#stepResults.flatMap(({ testFullName, stepName, duration, blockingSummary }) => {
      const name = stepName ? `${testFullName} > ${stepName}` : testFullName;
      const durationEntry = {
        name,
        unit: "ms",
        value: duration,
      };

      const blockingEntry = {
        name: `${name} (P95 of main thread blocks)`,
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

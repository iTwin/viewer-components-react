/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Runs the performance tests multiple times and creates a new benchmark file with the median results of each test.

const { execSync } = require("child_process");
const { existsSync, readFileSync, writeFileSync } = require("fs");
const { join } = require("path");

const BENCHMARK_FILE = "tree-widget-benchmark.json";
const NUM_RUNS = 5;

const performanceTestsDir = join(__dirname, "..", "apps", "performance-tests");
process.chdir(performanceTestsDir);

console.log(`Running benchmark ${NUM_RUNS} times...`);

const results = [];
for (let i = 0; i < NUM_RUNS; ++i) {
  console.log(`Run ${i} started.`);
  try {
    execSync("pnpm benchmark:tree-widget", {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    const resultPath = join(process.cwd(), BENCHMARK_FILE);
    if (existsSync(resultPath)) {
      const content = readFileSync(resultPath, "utf8");
      const data = JSON.parse(content);
      results.push({
        runNumber: i,
        data,
      });

      console.log(`Run ${i} completed.`);
    } else {
      console.error(`Warning: Benchmark file not found after run ${i}`);
    }
  } catch (error) {
    console.error(`Error during run ${i}:`, error.message);
    process.exit(1);
  }
}

const newEntries = [];
// Each test saves the total time of the test as one entry
// And another entry for P95 thread blocks
for (let i = 0; i < results[0].data.length; i += 2) {
  const singleTestResults = [];
  for (let j = 0; j < results.length; ++j) {
    singleTestResults.push({ totalTimeEntry: results[j].data[i], blocksEntry: results[j].data[i + 1] });
  }
  singleTestResults.sort((a, b) => a.totalTimeEntry.value - b.totalTimeEntry.value);
  const middleEntry = singleTestResults[Math.floor(NUM_RUNS / 2)];
  newEntries.push(middleEntry.totalTimeEntry);
  newEntries.push(middleEntry.blocksEntry);
}

const finalPath = join(process.cwd(), BENCHMARK_FILE);
writeFileSync(finalPath, JSON.stringify(newEntries, null, 2) + "\n");

console.log("Done!");

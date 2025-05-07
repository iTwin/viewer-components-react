# VCR performance tests

## Tests

The tests are supposed to represent various scenarios that we want to profile.

## Test reporter

Additionally, we want to measure how much time the main thread is being blocked.
Also, these tests have a different purpose - to provide a benchmark that will be used by GitHub actions and can be useful for the developers.
The simplest way to accommodate that is to use a custom test reporter (defined in `TestReporter.ts`).
The reporter gathers test durations and information about main thread blocking and saves it to a file if an output path is provided.

Example: `mocha -R ./lib/TestReporter.js -O BENCHMARK_OUTPUT_PATH="./results.json"`

### iModels

The tests may use iModels that are managed in `Datasets.ts` module. The iModels are stored locally in the `./datasets` folder.

## Usage

- In order to run all performance tests type:
  `pnpm test`
- In order to run performance tests and save the results to `./tree-widget-benchmark.json` enter:
  `pnpm benchmark:tree-widget`.

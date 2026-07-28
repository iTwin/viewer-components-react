import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    dir: "src",
    setupFiles: ["src/test/setup.ts"],
    restoreMocks: true,
    server: { // https://github.com/vitest-dev/vitest/discussions/2609
      deps: {
        inline: [
          "@itwin/appui-react",
          "@itwin/components-react",
          "@itwin/core-react",
          "@itwin/imodel-components-react"
        ]
      }
    },
    onConsoleLog: (log) => {
      // Filter out act warnings from React testing library
      if (log.includes("When testing, code that causes React state updates should be wrapped into act(...)")) {
        return false;
      }
      return true;
    },
    testTimeout: 20000, // 20 seconds
    coverage: {
      provider: "v8",
      include: [
        "src/**/*"
      ],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/test/**/*",
        "**/*.d.ts",
        "**/*.d.tsx"
      ],
      reporter: [
        "text-summary",
        "lcov",
        "cobertura"
      ],
      reportsDirectory: "./lib/cjs/test/coverage",
    },
    maxWorkers: 3,
  }
});

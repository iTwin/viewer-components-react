import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    dir: "src",
    setupFiles: ["src/test/setup.ts"],
    deps: { // https://github.com/vitest-dev/vitest/discussions/2609
      inline: [
        "@itwin/appui-react",
        "@itwin/components-react",
        "@itwin/core-react",
        "@itwin/imodel-components-react"
      ]
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
    minWorkers: 1,
    maxWorkers: 3,
  }
});

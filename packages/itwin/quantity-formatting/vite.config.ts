import { defineConfig } from "vite";

import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // look for all static in the dist folder
  publicDir: "./public",
  assetsInclude: "./public/*",
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/quantity-formatting/_Setup.test.ts"],
    include: ["src/test/quantity-formatting/**/*.test.*"],
    exclude: ["src/test/quantity-formatting/_Setup.test.ts"],
    coverage: {
      exclude: ["lib/*", "src/test/*"],
      include: ["src/*"],
      provider: "v8",
      reportsDirectory: "lib/coverage",
      reporter: ["html", "text-summary"],
      thresholds: {
        statements: 40,
        branches: 30,
        functions: 40,
        lines: 40,
      }
    },
  },
});

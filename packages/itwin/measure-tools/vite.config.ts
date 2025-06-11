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
    setupFiles: ["src/test/measure-tools/_Setup.test.ts"],
    include: ["src/test/measure-tools/**/*.test.*"],
    exclude: ["src/test/measure-tools/_Setup.test.ts"],
    server: {
      deps: {
        inline: [
          '@itwin/appui-react',
          '@itwin/imodel-components-react',
          '@itwin/components-react',
          '@itwin/core-react',
        ],
      }
    },
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

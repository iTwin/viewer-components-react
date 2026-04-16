/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import eslintConfigPrettier from "eslint-config-prettier";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig } from "eslint/config";
import iTwinPlugin from "@itwin/eslint-plugin";

export default defineConfig([
  {
    ignores: ["lib/**", "vitest.config.ts"],
  },
  {
    files: ["**/*.{ts,tsx,cts}"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    files: ["**/*.{ts,tsx,cts}"],
    rules: {
      "no-duplicate-imports": "off",
      "no-console": "off",
      "import/no-duplicates": "error",
      "object-curly-spacing": ["error", "always"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": ["error", { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" }],
      curly: ["error", "all"],
    },
  },
  eslintConfigPrettier,
]);

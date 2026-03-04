/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import eslintConfigPrettier from "eslint-config-prettier";
import reactPlugin from "eslint-plugin-react";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig } from "eslint/config";
import iTwinPlugin from "@itwin/eslint-plugin";

export default defineConfig([
  {
    files: ["**/*.{ts,tsx}"],
    ...iTwinPlugin.configs.uiConfig,
    rules: {
      ...iTwinPlugin.configs.uiConfig.rules,
      "@itwin/no-internal": [
        "error",
        {
          tag: ["internal"],
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      ...reactPlugin.configs["jsx-runtime"].rules,
    },
  },
  {
    files: ["src/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-duplicate-imports": "off",
      "import/no-duplicates": "error",
      "object-curly-spacing": ["error", "always"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": ["error", { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-empty-object-type": [
        "error",
        {
          allowObjectTypes: "always",
        },
      ],
      curly: ["error", "all"],
    },
  },
  {
    files: ["**/{test,e2e-tests}/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      ...eslintConfigPrettier.rules,
    },
  },
]);

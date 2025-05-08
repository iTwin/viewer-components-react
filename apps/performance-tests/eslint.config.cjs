/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

const iTwinPlugin = require("@itwin/eslint-plugin");
const eslintConfigPrettier = require("eslint-config-prettier");
const unusedImports = require("eslint-plugin-unused-imports");

module.exports = [
  {
    files: ["**/*.{ts,cts}"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    files: ["**/*.{ts,cts}"],
    rules: {
      "no-duplicate-imports": "off",
      "import/no-duplicates": "error",
      "object-curly-spacing": ["error", "always"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": ["error", { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" }],
      curly: ["error", "all"],
    },
  },
  eslintConfigPrettier,
];

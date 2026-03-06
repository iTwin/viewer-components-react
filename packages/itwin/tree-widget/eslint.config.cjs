/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const iTwinPlugin = require("@itwin/eslint-plugin");
const reactPlugin = require("eslint-plugin-react");
const eslintConfigPrettier = require("eslint-config-prettier");
const unusedImports = require("eslint-plugin-unused-imports");
const reactHooksPlugin = require("eslint-plugin-react-hooks");

module.exports = [
  {
    files: ["**/*.{ts,tsx}"],
    ...iTwinPlugin.configs.uiConfig,
    // Override the react-hooks plugin with the newer version
    plugins: {
      ...iTwinPlugin.configs.uiConfig.plugins,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...iTwinPlugin.configs.uiConfig.rules,
      ...reactHooksPlugin.configs.flat.recommended.rules,
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/unsupported-syntax": "error",
      "react-hooks/incompatible-library": "error",
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
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-exports": "error",
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
  eslintConfigPrettier,
];

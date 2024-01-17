/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

module.exports = {
  plugins: ["@itwin", "unused-imports"],
  extends: ["plugin:@itwin/ui", "plugin:react/jsx-runtime", "prettier"],
  rules: {
    "@itwin/no-internal": ["error"],
    "@typescript-eslint/consistent-type-imports": "error",
    "no-duplicate-imports": "off",
    "import/no-duplicates": "error",
    "object-curly-spacing": ["error", "always"],
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": ["error", { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" }],
    curly: ["error", "all"],
  },
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  plugins: ["@itwin", "unused-imports"],
  extends: ["plugin:@itwin/ui", "plugin:react/jsx-runtime"],
  rules: {
    "@itwin/no-internal": ["error"],
    "@typescript-eslint/no-floating-promises": [
      "error",
      { "ignoreIIFE": true }
    ],
    "@typescript-eslint/consistent-type-imports": "error",
    "no-duplicate-imports": "off",
    "import/no-duplicates": "error",
    "object-curly-spacing": ["error", "always"],
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "error",
      { "vars": "all", "varsIgnorePattern": "^_", "args": "after-used", "argsIgnorePattern": "^_" }
    ]
  }
}

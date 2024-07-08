/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.{ts,tsx}"],
    ...iTwinPlugin.configs.uiConfig,
    rules: {
      "@itwin/no-internal": [
        "warn",
        {
          tag: [
            "internal",
            "alpha",
            "beta",
          ],
        },
      ],
      "@typescript-eslint/unbound-method": "off",
      "no-duplicate-imports": "off",
      "@typescript-eslint/consistent-type-imports": "error",
  },

  },
];

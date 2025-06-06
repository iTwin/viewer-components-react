/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import iTwinPlugin from "@itwin/eslint-plugin";

export default [
  {
    files: ["**/*.{ts,tsx}"],
    ...iTwinPlugin.configs.uiConfig,
    rules: {
      "@itwin/no-internal": [
        "warn",
        {
          tag: [
            "internal",
          ],
        },
      ],
      "@typescript-eslint/unbound-method": "off",
      "no-duplicate-imports": "off",
      "@typescript-eslint/consistent-type-imports": "error",
  },

  },
];

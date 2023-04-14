/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  plugins: ["@itwin"],
  extends: "plugin:@itwin/ui",
  rules: {
    "@itwin/no-internal": ["error"],
    "@typescript-eslint/no-floating-promises": [
      "error",
      { "ignoreIIFE": true }
    ]
  },
};

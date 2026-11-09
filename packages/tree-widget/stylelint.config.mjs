/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  overrides: [
    {
      files: ["./src/**/*.css"],
      rules: {
        "comment-whitespace-inside": null,
      },
    },
  ],
};

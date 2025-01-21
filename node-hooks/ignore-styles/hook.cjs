/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

const STYLE_FILE_EXTENSIONS = [".css", ".scss", ".less", ".sass"];

exports.load = (url, context, next) => {
  if (STYLE_FILE_EXTENSIONS.some((ext) => url.endsWith(ext))) {
    return { format: "module", shortCircuit: true, source: "" };
  }
  return next(url, context);
};

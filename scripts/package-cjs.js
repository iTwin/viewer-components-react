/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

const fs = require("node:fs");
const path = require("node:path");

const relativeDir = process.argv[2];

const packageDir = path.join(process.cwd(), relativeDir);
if (!fs.existsSync(packageDir)) {
  fs.mkdirSync(packageDir, { recursive: true });
}

try {
  const filePath = path.join(packageDir, "package.json");
  fs.writeFileSync(filePath, '{ "type": "commonjs" }', {});
} catch (e) {
  console.error("Cannot create package.json", e);
}

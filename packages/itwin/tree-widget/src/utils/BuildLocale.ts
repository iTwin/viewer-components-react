/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { execSync } from "child_process";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { LOCALIZATION_NAMESPACE, LOCALIZED_STRINGS } from "../tree-widget-react/components/shared/LocalizedStrings.js";

const localeContent = JSON.stringify(LOCALIZED_STRINGS, null, 2);

const localesFolder = "public/locales";
const outputFolder = `./${localesFolder}/en`;
const filePath = `${outputFolder}/${LOCALIZATION_NAMESPACE}.json`;

// clear output directory
rmSync(outputFolder, { recursive: true, force: true });

// create output directory if it does not exist
mkdirSync(outputFolder, { recursive: true });

writeFileSync(filePath, `${localeContent}\n`, { encoding: "utf-8" });

const gitStatus = execSync("git status --porcelain").toString();
const localesChanged = gitStatus.split("\n").some((line) => line.includes(localesFolder));

if (process.env.CI && localesChanged) {
  throw new Error(`Locale file has changes. Run "npm run build:locale" to update locale file and commit the changes.`);
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import path from "path";
import sanitize from "sanitize-filename";
import { IModelJsFs } from "@itwin/core-backend";
import { getTestOutputDir } from "./Initialize.js";

import type { LocalFileName } from "@itwin/core-common";

export function setupOutputFileLocation(fileName: string): LocalFileName {
  const outputDirectoryPath = getTestOutputDir();
  !IModelJsFs.existsSync(outputDirectoryPath) && IModelJsFs.mkdirSync(outputDirectoryPath);
  const outputFilePath = limitFilePathLength(path.join(outputDirectoryPath, fileName));
  IModelJsFs.existsSync(outputFilePath) && IModelJsFs.unlinkSync(outputFilePath);
  return outputFilePath;
}

export function createFileNameFromString(str: string) {
  return sanitize(str.replace(/[ ]+/g, "-").replaceAll("`", "").replaceAll("'", "")).toLowerCase();
}

const FILE_PATH_RESERVED_CHARACTERS = 13;
export function limitFilePathLength(filePath: string) {
  const { dir, name, ext } = path.parse(filePath);
  const THREE_DOTS_LENGTH = 3;

  let allowedFileNameLength = 260 - FILE_PATH_RESERVED_CHARACTERS - (dir.length + 1) - ext.length;
  if (name.length <= allowedFileNameLength) {
    return filePath;
  }

  allowedFileNameLength -= THREE_DOTS_LENGTH;
  if (allowedFileNameLength <= 0) {
    throw new Error(`File path "${filePath}" is too long.`);
  }

  const pieceLength = allowedFileNameLength / 2;
  const shortenedName = `${name.slice(0, Math.ceil(pieceLength))}...${name.slice(Math.ceil(name.length - pieceLength))}`;
  return path.join(dir, `${shortenedName}${ext}`);
}

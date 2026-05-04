/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { SnapshotDb } from "@itwin/core-backend";
import { assert, DbResult } from "@itwin/core-bentley";

import type { IModelDb } from "@itwin/core-backend";

export async function createIModel(name: string, localPath: string, cb: (imodel: IModelDb) => void | Promise<void>) {
  fs.rmSync(localPath, { force: true });
  const imodel = SnapshotDb.createEmpty(localPath, { rootSubject: { name } });
  try {
    await cb(imodel);
  } finally {
    imodel.saveChanges("Initial commit");
    imodel.withSqliteStatement("ANALYZE", (stmt) => {
      const analyzeResult = stmt.step();
      assert(analyzeResult === DbResult.BE_SQLITE_DONE, `ANALYZE failed with result ${DbResult[analyzeResult]}`);
    });
    imodel.saveChanges("Analyze");
    imodel.close();
  }
}

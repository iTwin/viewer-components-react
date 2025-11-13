/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { getFullSchemaXml } from "test-utilities";
import { SnapshotDb } from "@itwin/core-backend";
import { assert, DbResult } from "@itwin/core-bentley";
import { Code } from "@itwin/core-common";

import type { TestIModelBuilder } from "test-utilities";
import type { IModelDb } from "@itwin/core-backend";
import type { BisCodeSpec, ElementAspectProps, ElementProps, ModelProps, RelationshipProps } from "@itwin/core-common";
export async function createIModel(name: string, localPath: string, cb: (builder: BackendTestIModelBuilder) => void | Promise<void>) {
  fs.rmSync(localPath, { force: true });
  const iModel = SnapshotDb.createEmpty(localPath, { rootSubject: { name } });
  const builder = new BackendTestIModelBuilder(iModel);
  try {
    await cb(builder);
  } finally {
    iModel.saveChanges("Initial commit");
    iModel.withSqliteStatement("ANALYZE", (stmt) => {
      const analyzeResult = stmt.step();
      assert(analyzeResult === DbResult.BE_SQLITE_DONE, `ANALYZE failed with result ${DbResult[analyzeResult]}`);
    });
    iModel.saveChanges("Analyze");
    iModel.close();
  }
}

class BackendTestIModelBuilder implements TestIModelBuilder {
  readonly #iModel: IModelDb;
  constructor(iModel: IModelDb) {
    this.#iModel = iModel;
  }

  public insertModel(props: ModelProps): string {
    return this.#iModel.models.insertModel(props);
  }

  public insertElement(props: ElementProps): string {
    return this.#iModel.elements.insertElement(props);
  }

  public insertAspect(props: ElementAspectProps): string {
    return this.#iModel.elements.insertAspect(props);
  }

  public insertRelationship(props: RelationshipProps): string {
    return this.#iModel.relationships.insertInstance(props);
  }

  public createCode(scopeModelId: string, codeSpecName: BisCodeSpec, codeValue: string): Code {
    const spec = this.#iModel.codeSpecs.getByName(codeSpecName).id;
    return new Code({ scope: scopeModelId, spec, value: codeValue });
  }

  public async importSchema(schemaName: string, schemaContentXml: string): Promise<void> {
    const fullXml = getFullSchemaXml({ schemaName, schemaContentXml });
    await this.#iModel.importSchemaStrings([fullXml]);
  }

  public async importFullSchema(schema: string): Promise<void> {
    await this.#iModel.importSchemaStrings([schema]);
  }
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { getFullSchemaXml } from "test-utilities";
import { SnapshotDb } from "@itwin/core-backend";
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
    iModel.withSqliteStatement("ANALYZE", () => {});
    iModel.saveChanges("Analyze");
    iModel.close();
  }
}

class BackendTestIModelBuilder implements TestIModelBuilder {
  constructor(private readonly _iModel: IModelDb) {}

  public insertModel(props: ModelProps): string {
    return this._iModel.models.insertModel(props);
  }

  public insertElement(props: ElementProps): string {
    return this._iModel.elements.insertElement(props);
  }

  public insertAspect(props: ElementAspectProps): string {
    return this._iModel.elements.insertAspect(props);
  }

  public insertRelationship(props: RelationshipProps): string {
    return this._iModel.relationships.insertInstance(props);
  }

  public createCode(scopeModelId: string, codeSpecName: BisCodeSpec, codeValue: string): Code {
    const spec = this._iModel.codeSpecs.getByName(codeSpecName).id;
    return new Code({ scope: scopeModelId, spec, value: codeValue });
  }

  public async importSchema(schemaName: string, schemaContentXml: string): Promise<void> {
    const fullXml = getFullSchemaXml({ schemaName, schemaContentXml });
    await this._iModel.importSchemaStrings([fullXml]);
  }

  public async importFullSchema(schema: string): Promise<void> {
    await this._iModel.importSchemaStrings([schema]);
  }
}

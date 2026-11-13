/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { initializeCore, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory, terminateCore } from "test-utilities";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { CLASS_NAME_GeometricElement3d } from "../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { ElementModelCategoriesProvider } from "../../../tree-widget-react/shared/internal/idsProviders/ElementModelCategoriesProvider.js";
import { buildIModel, insertGeometricModelWithPartition } from "../../IModelUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";

function createProvider(imodel: IModelConnection) {
  return new ElementModelCategoriesProvider({
    queryExecutor: createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
    componentId: "test",
    elementClassName: CLASS_NAME_GeometricElement3d,
  });
}

describe("ElementModelCategoriesProvider", () => {
  beforeAll(async () => {
    await initializeCore();
  });

  afterAll(async () => {
    await terminateCore();
  });

  it("does not return private or template models", async () => {
    await using buildIModelResult = await buildIModel(async (imodel) =>
      withEditTxn(imodel, (txn) => {
        const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
        const privateModel = insertGeometricModelWithPartition({ txn, codeValue: "private", isPrivate: true });
        const templateModel = insertGeometricModelWithPartition({ txn, codeValue: "template", isTemplate: true });
        const category = insertSpatialCategory({ txn, codeValue: "category" });
        insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
        insertPhysicalElement({ txn, modelId: privateModel.id, categoryId: category.id });
        insertPhysicalElement({ txn, modelId: templateModel.id, categoryId: category.id });
        return { model, category };
      }),
    );
    const { imodelConnection, ...keys } = buildIModelResult;
    const provider = createProvider(imodelConnection);

    const result = await firstValueFrom(provider.getCachedData());

    expect([...result.modelsCategoriesInfo.keys()]).toEqual([keys.model.id]);
    expect(result.categoryModelsInfo.get(keys.category.id)).toEqual([
      { id: keys.model.id, categoryIsOfTopMostElement: true, hasNonExcludedTopMostElements: true },
    ]);
  });
});

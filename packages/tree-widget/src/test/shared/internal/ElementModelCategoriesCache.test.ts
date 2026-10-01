/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import {
  initializeCore,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  terminateCore,
} from "test-utilities";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { IModel } from "@itwin/core-common";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { ElementModelCategoriesCache } from "../../../tree-widget-react/shared/internal/caches/ElementModelCategoriesCache.js";
import { CLASS_NAME_GeometricElement3d } from "../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { buildIModel } from "../../IModelUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";

function createCache(imodel: IModelConnection) {
  return new ElementModelCategoriesCache({
    queryExecutor: createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
    componentId: "test",
    elementClassName: CLASS_NAME_GeometricElement3d,
  });
}

describe("ElementModelCategoriesCache", () => {
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
        const partition = insertPhysicalPartition({ txn, codeValue: "private", parentId: IModel.rootSubjectId });
        const privateModel = insertPhysicalSubModel({ txn, modeledElementId: partition.id, isPrivate: true });
        const templatePartition = insertPhysicalPartition({ txn, codeValue: "template", parentId: IModel.rootSubjectId });
        const templateModel = insertPhysicalSubModel({ txn, modeledElementId: templatePartition.id, isTemplate: true });
        const category = insertSpatialCategory({ txn, codeValue: "category" });
        insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
        insertPhysicalElement({ txn, modelId: privateModel.id, categoryId: category.id });
        insertPhysicalElement({ txn, modelId: templateModel.id, categoryId: category.id });
        return { model, category };
      }),
    );
    const { imodelConnection, ...keys } = buildIModelResult;
    const cache = createCache(imodelConnection);

    const result = await firstValueFrom(cache.getCachedData());

    expect([...result.modelsCategoriesInfo.keys()]).toEqual([keys.model.id]);
    expect(result.categoryModelsInfo.get(keys.category.id)).toEqual([
      { id: keys.model.id, categoryIsOfTopMostElement: true, hasNonExcludedTopMostElements: true },
    ]);
  });
});

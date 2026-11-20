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
import { BaseIdsCache } from "../../../tree-widget-react/shared/internal/caches/BaseIdsCache.js";
import { CLASS_NAME_GeometricElement3d } from "../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { buildIModel } from "../../IModelUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";

function createCache(imodel: IModelConnection) {
  return new BaseIdsCache({
    queryExecutor: createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
    elementClassName: CLASS_NAME_GeometricElement3d,
    type: "3d",
  });
}

describe("BaseIdsCache", () => {
  beforeAll(async () => {
    await initializeCore();
  });

  afterAll(async () => {
    await terminateCore();
  });

  describe("getAllModelsOfViewType and getAllCategoriesOfViewType", () => {
    async function buildTestIModel() {
      return buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
          const emptyModel = insertPhysicalModelWithPartition({ txn, codeValue: "empty model" });
          const category = insertSpatialCategory({ txn, codeValue: "category" });
          const emptyCategory = insertSpatialCategory({ txn, codeValue: "empty category" });
          insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
          return { model, emptyModel, category, emptyCategory };
        }),
      );
    }

    it("returns all models and categories until element model categories are loaded, then only ones with elements", async () => {
      await using buildIModelResult = await buildTestIModel();
      const { imodelConnection, ...keys } = buildIModelResult;
      const cache = createCache(imodelConnection);

      const fallbackModels = await firstValueFrom(cache.getAllModelsOfViewType());
      const fallbackCategories = await firstValueFrom(cache.getAllCategoriesOfViewType());
      expect(fallbackModels.map(({ id }) => id).sort()).toEqual([keys.model.id, keys.emptyModel.id].sort());
      expect([...fallbackCategories].sort()).toEqual([keys.category.id, keys.emptyCategory.id].sort());
      expect(cache.elementModelCategoriesLoaded()).toBe(false);

      await cache.preloadElementModelCategories();

      expect(cache.elementModelCategoriesLoaded()).toBe(true);
      expect(await firstValueFrom(cache.getAllModelsOfViewType())).toEqual([{ id: keys.model.id, isPlanProjection: false }]);
      expect([...(await firstValueFrom(cache.getAllCategoriesOfViewType()))]).toEqual([keys.category.id]);
    });

    it("emits only models and categories with elements when element model categories are already loaded", async () => {
      await using buildIModelResult = await buildTestIModel();
      const { imodelConnection, ...keys } = buildIModelResult;
      const cache = createCache(imodelConnection);
      await cache.preloadElementModelCategories();

      expect(await firstValueFrom(cache.getAllModelsOfViewType())).toEqual([{ id: keys.model.id, isPlanProjection: false }]);
      expect([...(await firstValueFrom(cache.getAllCategoriesOfViewType()))]).toEqual([keys.category.id]);
    });
  });
});

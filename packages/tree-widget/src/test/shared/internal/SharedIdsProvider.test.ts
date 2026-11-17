/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { initializeCore, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory, terminateCore } from "test-utilities";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { CLASS_NAMES } from "../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { createSharedIdsProvider } from "../../../tree-widget-react/shared/internal/idsProviders/SharedIdsProvider.js";
import { toObservable } from "../../../tree-widget-react/shared/internal/Rxjs.js";
import { buildIModel, insertGeometricModelWithPartition } from "../../IModelUtils.js";
import { createIModelAccess, createIModelMock } from "../../trees/Common.js";

import type { IModelConnection } from "@itwin/core-frontend";

function createProvider(imodel: IModelConnection) {
  return createSharedIdsProvider({ imodelAccess: createIModelAccess(imodel), elementClassName: CLASS_NAMES.GeometricElement3d });
}

describe("SharedIdsProvider", () => {
  describe("elements", () => {
    it("caches category element count", async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const elementCount = 3;
      const stub = vi.fn((query: string) => {
        if (query.includes("Descendants")) {
          return [{ modelId, reqParent: null, reqCategory: categoryId, ownCategory: categoryId, cnt: elementCount }];
        }
        throw new Error(`Unexpected query: ${query}`);
      });
      const provider = createProvider(createIModelMock({ queryHandler: stub }));
      await expect(firstValueFrom(provider.elements.getDescendantsCounts({ modelId, categoryId }))).resolves.toEqual([{ categoryId, count: elementCount }]);
      expect(stub).toHaveBeenCalledOnce();
      await expect(firstValueFrom(provider.elements.getDescendantsCounts({ modelId, categoryId }))).resolves.toEqual([{ categoryId, count: elementCount }]);
      expect(stub).toHaveBeenCalledOnce();
    });

    it("runs only one query when multiple requests are made", async () => {
      const modelId = "0x1";
      const categoryId = "0x2";
      const categoryId2 = "0x3";
      const elementCount1 = 3;
      const elementCount2 = 4;
      const stub = vi.fn((query: string) => {
        if (query.includes("Descendants")) {
          return [
            { modelId, reqParent: null, reqCategory: categoryId, ownCategory: categoryId, cnt: elementCount1 },
            { modelId, reqParent: null, reqCategory: categoryId2, ownCategory: categoryId2, cnt: elementCount2 },
          ];
        }
        throw new Error(`Unexpected query: ${query}`);
      });
      const provider = createProvider(createIModelMock({ queryHandler: stub }));
      const [count1, count2] = await Promise.all([
        firstValueFrom(provider.elements.getDescendantsCounts({ modelId, categoryId })),
        firstValueFrom(provider.elements.getDescendantsCounts({ modelId, categoryId: categoryId2 })),
      ]);
      expect(count1).toEqual([{ categoryId, count: elementCount1 }]);
      expect(count2).toEqual([{ categoryId: categoryId2, count: elementCount2 }]);
      expect(stub).toHaveBeenCalledOnce();
    });
  });

  describe("with iModel", () => {
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

      const result = await firstValueFrom(toObservable(provider.models.getData()));

      expect([...result.modelsCategoriesInfo.keys()]).toEqual([keys.model.id]);
      expect(result.categoryModelsInfo.get(keys.category.id)).toEqual([
        { id: keys.model.id, categoryIsOfTopMostElement: true, hasNonExcludedTopMostElements: true },
      ]);
    });

    it("determines whether category contains parent elements, ignoring private and template models", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
          const privateModel = insertGeometricModelWithPartition({ txn, codeValue: "private", isPrivate: true });
          const templateModel = insertGeometricModelWithPartition({ txn, codeValue: "template", isTemplate: true });
          const categoryWithParentElements = insertSpatialCategory({ txn, codeValue: "category with parent elements" });
          const categoryWithoutParentElements = insertSpatialCategory({ txn, codeValue: "category without parent elements" });
          const categoryWithParentElementsInNonVisibleModels = insertSpatialCategory({ txn, codeValue: "category with parent elements in non-visible models" });

          const parentElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: categoryWithParentElements.id });
          insertPhysicalElement({ txn, modelId: model.id, categoryId: categoryWithoutParentElements.id, parentId: parentElement.id });
          for (const modelId of [privateModel.id, templateModel.id]) {
            const nonVisibleParentElement = insertPhysicalElement({ txn, modelId, categoryId: categoryWithParentElementsInNonVisibleModels.id });
            insertPhysicalElement({ txn, modelId, categoryId: categoryWithParentElementsInNonVisibleModels.id, parentId: nonVisibleParentElement.id });
          }
          return { categoryWithParentElements, categoryWithoutParentElements, categoryWithParentElementsInNonVisibleModels };
        }),
      );
      const { imodelConnection, ...keys } = buildIModelResult;
      const provider = createProvider(imodelConnection);

      expect(await firstValueFrom(provider.categories.hasParentElements({ categoryId: keys.categoryWithParentElements.id }))).toBe(true);
      expect(await firstValueFrom(provider.categories.hasParentElements({ categoryId: keys.categoryWithoutParentElements.id }))).toBe(false);
      expect(await firstValueFrom(provider.categories.hasParentElements({ categoryId: keys.categoryWithParentElementsInNonVisibleModels.id }))).toBe(false);
    });

    it("preloads data required to determine whether category contains parent elements", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
          const category = insertSpatialCategory({ txn, codeValue: "category" });
          const parentElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
          insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
          return { category };
        }),
      );
      const { imodelConnection, ...keys } = buildIModelResult;
      const provider = createProvider(imodelConnection);
      await provider.models.preloadData();

      const querySpy = vi.spyOn(imodelConnection, "createQueryReader");
      expect(await firstValueFrom(provider.categories.hasParentElements({ categoryId: keys.category.id }))).toBe(true);
      expect(querySpy).not.toHaveBeenCalled();
    });
  });
});

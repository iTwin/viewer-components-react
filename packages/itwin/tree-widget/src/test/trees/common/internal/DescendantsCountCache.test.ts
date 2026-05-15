/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import {
  HierarchyCacheMode,
  initializeCore,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  terminateCore,
} from "test-utilities";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { DescendantsCountCache } from "../../../../tree-widget-react/components/trees/common/internal/caches/DescendantsCountCache.js";
import { CLASS_NAME_GeometricElement3d } from "../../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { buildIModel } from "../../../IModelUtils.js";
import { createFakeViewport } from "../../Common.js";

import type { IModelConnection } from "@itwin/core-frontend";

function createCache(imodel: IModelConnection) {
  return new DescendantsCountCache({
    queryExecutor: createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
    componentId: "test",
    elementClassName: CLASS_NAME_GeometricElement3d,
  });
}

function createFakeCache(viewport: ReturnType<typeof createFakeViewport>) {
  return new DescendantsCountCache({
    queryExecutor: createECSqlQueryExecutor(viewport.iModel),
    componentId: "test",
    elementClassName: CLASS_NAME_GeometricElement3d,
  });
}

describe("DescendantsCountCache", () => {
  describe("batching and caching", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns default count for category with no results", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const [result] = await Promise.all([firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x2" })), vi.advanceTimersByTimeAsync(20)]);
      expect(result).toEqual([{ categoryId: "0x2", count: 0 }]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("returns empty array for element request with no results", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const [result] = await Promise.all([
        firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", parentElementId: "0x10" })),
        vi.advanceTimersByTimeAsync(20),
      ]);
      expect(result).toEqual([]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("returns results for one category and default for another", async () => {
      using vp = createFakeViewport({
        queryHandler: () => [{ modelId: "0x1", reqParent: undefined, reqCategory: "0x2", ownCategory: "0x2", cnt: 3 }],
      });
      const cache = createFakeCache(vp);

      const promise1 = firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x2" }));
      const promise2 = firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x3" }));
      const [result1, result2] = await Promise.all([promise1, promise2, vi.advanceTimersByTimeAsync(20)]);
      expect(result1).toEqual([{ categoryId: "0x2", count: 3 }]);
      expect(result2).toEqual([{ categoryId: "0x3", count: 0 }]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("batches multiple category requests into single query", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const promise1 = firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x2" }));
      const promise2 = firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x3" }));
      await Promise.all([promise1, promise2, vi.advanceTimersByTimeAsync(20)]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("batches requests which are less than 20 ms apart", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const promise1 = firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x2" }));
      await vi.advanceTimersByTimeAsync(19);
      const promise2 = firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x3" }));
      await Promise.all([promise1, promise2, vi.advanceTimersByTimeAsync(2)]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("does not batch requests which are more than 20 ms apart", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const promise1 = firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x2" }));
      await vi.advanceTimersByTimeAsync(21);
      const promise2 = firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x3" }));
      await Promise.all([promise1, promise2, vi.advanceTimersByTimeAsync(20)]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
    });

    it("batches mixed category and element requests into single query", async () => {
      using vp = createFakeViewport({
        queryHandler: () => [
          { modelId: "0x1", reqParent: undefined, reqCategory: "0x2", ownCategory: "0x2", cnt: 2 },
          { modelId: "0x1", reqParent: "0x10", reqCategory: undefined, ownCategory: "0x3", cnt: 5 },
        ],
      });
      const cache = createFakeCache(vp);

      const promise1 = firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x2" }));
      const promise2 = firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", parentElementId: "0x10" }));
      const [result1, result2] = await Promise.all([promise1, promise2, vi.advanceTimersByTimeAsync(20)]);
      expect(result1).toEqual([{ categoryId: "0x2", count: 2 }]);
      expect(result2).toEqual([{ categoryId: "0x3", count: 5 }]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("caches empty values", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const [result1] = await Promise.all([firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x2" })), vi.advanceTimersByTimeAsync(20)]);
      const result2 = await firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x2" }));
      expect(result1).toEqual([{ categoryId: "0x2", count: 0 }]);
      expect(result2).toEqual([{ categoryId: "0x2", count: 0 }]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("caches values returned by query", async () => {
      using vp = createFakeViewport({
        queryHandler: () => [{ modelId: "0x1", reqParent: undefined, reqCategory: "0x2", ownCategory: "0x2", cnt: 2 }],
      });
      const cache = createFakeCache(vp);

      const [result1] = await Promise.all([firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x2" })), vi.advanceTimersByTimeAsync(20)]);
      const result2 = await firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", categoryId: "0x2" }));
      expect(result1).toEqual([{ categoryId: "0x2", count: 2 }]);
      expect(result2).toEqual([{ categoryId: "0x2", count: 2 }]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("caches element request values", async () => {
      using vp = createFakeViewport({
        queryHandler: () => [{ modelId: "0x1", reqParent: "0x10", reqCategory: undefined, ownCategory: "0x2", cnt: 3 }],
      });
      const cache = createFakeCache(vp);

      const [result1] = await Promise.all([
        firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", parentElementId: "0x10" })),
        vi.advanceTimersByTimeAsync(20),
      ]);
      const result2 = await firstValueFrom(cache.getDescendantsCounts({ modelId: "0x1", parentElementId: "0x10" }));
      expect(result1).toEqual([{ categoryId: "0x2", count: 3 }]);
      expect(result2).toEqual([{ categoryId: "0x2", count: 3 }]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("executes single query if 100 where clauses are generated", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);
      const promises = new Array<Promise<unknown>>();
      for (let i = 1; i <= 100; ++i) {
        promises.push(firstValueFrom(cache.getDescendantsCounts({ modelId: `0x${i}`, categoryId: "0x1000" })));
      }
      await Promise.all([...promises, vi.advanceTimersByTimeAsync(20)]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("executes separate queries if > 100 where clauses are generated", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);
      const promises = new Array<Promise<unknown>>();
      for (let i = 1; i <= 101; ++i) {
        promises.push(firstValueFrom(cache.getDescendantsCounts({ modelId: `0x${i}`, categoryId: "0x1000" })));
      }
      await Promise.all([...promises, vi.advanceTimersByTimeAsync(20)]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
    });
  });

  describe("query results", () => {
    beforeAll(async () => {
      await initializeCore({
        backendProps: {
          caching: {
            hierarchies: {
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    afterAll(async () => {
      await terminateCore();
    });

    describe("category requests", () => {
      it("returns self count for root category with elements", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
            return { model, category };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const incorrectModelResult = await firstValueFrom(cache.getDescendantsCounts({ modelId: "0x123", categoryId: keys.category.id }));
        expect(incorrectModelResult).toEqual([{ categoryId: keys.category.id, count: 0 }]);
        const incorrectCategoryResult = await firstValueFrom(cache.getDescendantsCounts({ modelId: keys.model.id, categoryId: "0x123" }));
        expect(incorrectCategoryResult).toEqual([{ categoryId: "0x123", count: 0 }]);
        const result = await firstValueFrom(cache.getDescendantsCounts({ modelId: keys.model.id, categoryId: keys.category.id }));
        expect(result).toEqual([{ categoryId: keys.category.id, count: 2 }]);
      });

      it("returns 0 count when category has no root elements", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const categoryA = insertSpatialCategory({ txn, codeValue: "catA" });
            const categoryB = insertSpatialCategory({ txn, codeValue: "catB" });
            const rootEl = insertPhysicalElement({ txn, modelId: model.id, categoryId: categoryA.id });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: categoryB.id, parentId: rootEl.id });
            return { model, categoryB };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const result = await firstValueFrom(cache.getDescendantsCounts({ modelId: keys.model.id, categoryId: keys.categoryB.id }));
        expect(result).toEqual([{ categoryId: keys.categoryB.id, count: 0 }]);
      });

      it("returns counts which include nested children", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const catA = insertSpatialCategory({ txn, codeValue: "catA" });
            const catB = insertSpatialCategory({ txn, codeValue: "catB" });
            // root element catA
            const el1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id });
            // child1 catA
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id, parentId: el1.id });
            // child2 catB
            const child = insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1.id });
            // child of child has catA
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id, parentId: child.id });
            return { model, catA, catB };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const result = await firstValueFrom(cache.getDescendantsCounts({ modelId: keys.model.id, categoryId: keys.catA.id }));
        expect(result).toEqual(
          expect.arrayContaining([
            { categoryId: keys.catA.id, count: 3 },
            { categoryId: keys.catB.id, count: 1 },
          ]),
        );
      });

      it("returns counts scoped to parentElementId", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const catA = insertSpatialCategory({ txn, codeValue: "catA" });
            const catB = insertSpatialCategory({ txn, codeValue: "catB" });
            const el1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id });
            const el1_1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1.id });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id, parentId: el1_1.id });
            return { model, catA, catB, el1 };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const resultCatB = await firstValueFrom(cache.getDescendantsCounts({ modelId: keys.model.id, categoryId: keys.catB.id, parentElementId: keys.el1.id }));
        const resultCatA = await firstValueFrom(cache.getDescendantsCounts({ modelId: keys.model.id, categoryId: keys.catA.id, parentElementId: keys.el1.id }));
        expect(resultCatB).toEqual(
          expect.arrayContaining([
            { categoryId: keys.catB.id, count: 1 },
            { categoryId: keys.catA.id, count: 1 },
          ]),
        );
        // Even though el1 has nested children with catA, it does not have any direct children with catA, so count is 0
        expect(resultCatA).toEqual([{ categoryId: keys.catA.id, count: 0 }]);
      });
    });

    describe("element requests", () => {
      it("returns empty array when element has no children", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const el = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
            return { model, el };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const result = await firstValueFrom(cache.getDescendantsCounts({ modelId: keys.model.id, parentElementId: keys.el.id }));
        expect(result).toEqual([]);
      });

      it("returns all child category counts under an element", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const catA = insertSpatialCategory({ txn, codeValue: "catA" });
            const catB = insertSpatialCategory({ txn, codeValue: "catB" });
            const catC = insertSpatialCategory({ txn, codeValue: "catC" });
            const el1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id });
            // children in different categories
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id, parentId: el1.id });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1.id });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1.id });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catC.id, parentId: el1.id });
            return { model, catA, catB, catC, el1 };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const result = await firstValueFrom(cache.getDescendantsCounts({ modelId: keys.model.id, parentElementId: keys.el1.id }));
        expect(result).toEqual(
          expect.arrayContaining([
            { categoryId: keys.catA.id, count: 1 },
            { categoryId: keys.catB.id, count: 2 },
            { categoryId: keys.catC.id, count: 1 },
          ]),
        );
      });

      it("returns nested descendant counts grouped by category", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const catA = insertSpatialCategory({ txn, codeValue: "catA" });
            const catB = insertSpatialCategory({ txn, codeValue: "catB" });
            const el1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id });
            const el1_1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1.id });
            // grandchild back in catA
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id, parentId: el1_1.id });
            // grandchild in catB
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1_1.id });
            return { model, catA, catB, el1 };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const result = await firstValueFrom(cache.getDescendantsCounts({ modelId: keys.model.id, parentElementId: keys.el1.id }));
        expect(result).toEqual(
          expect.arrayContaining([
            { categoryId: keys.catA.id, count: 1 },
            { categoryId: keys.catB.id, count: 2 },
          ]),
        );
      });
    });
  });
});

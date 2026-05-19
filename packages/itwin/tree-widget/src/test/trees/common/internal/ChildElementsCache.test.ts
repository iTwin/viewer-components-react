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
import { CompressedId64Set } from "@itwin/core-bentley";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { ChildElementsCache } from "../../../../tree-widget-react/components/trees/common/internal/caches/ChildElementsCache.js";
import { CLASS_NAME_GeometricElement3d } from "../../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { buildIModel } from "../../../IModelUtils.js";
import { createFakeViewport } from "../../Common.js";

import type { IModelConnection } from "@itwin/core-frontend";

function createCache(imodel: IModelConnection) {
  return new ChildElementsCache({
    queryExecutor: createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
    componentId: "test",
    elementClassName: CLASS_NAME_GeometricElement3d,
  });
}

function createFakeCache(viewport: ReturnType<typeof createFakeViewport>) {
  return new ChildElementsCache({
    queryExecutor: createECSqlQueryExecutor(viewport.iModel),
    componentId: "test",
    elementClassName: CLASS_NAME_GeometricElement3d,
  });
}

describe("ChildElementsCache", () => {
  describe("batching and caching", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns empty array for empty childCategoryIds", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const result = await firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: [] }));
      expect(result).toEqual([]);
      expect(vp.iModel.createQueryReader).not.toHaveBeenCalled();
    });

    it("returns empty array for category request with no results", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const [result] = await Promise.all([
        firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] })),
        vi.advanceTimersByTimeAsync(20),
      ]);
      expect(result).toEqual([]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("returns empty array for element request with no results", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const [result] = await Promise.all([
        firstValueFrom(cache.getChildElements({ modelId: "0x1", parentElementId: "0x10", childCategoryIds: ["0x3"] })),
        vi.advanceTimersByTimeAsync(20),
      ]);
      expect(result).toEqual([]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("returns element ids from query results", async () => {
      using vp = createFakeViewport({
        queryHandler: () => [
          { modelId: "0x1", reqParent: null, reqCategory: "0x2", ownCategory: "0x3", id: "0x100" },
          { modelId: "0x1", reqParent: null, reqCategory: "0x2", ownCategory: "0x3", id: "0x101" },
        ],
      });
      const cache = createFakeCache(vp);

      const [result] = await Promise.all([
        firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] })),
        vi.advanceTimersByTimeAsync(20),
      ]);
      expect(result).toEqual(expect.arrayContaining(["0x100", "0x101"]));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("batches multiple requests into single query", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const promise1 = firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] }));
      const promise2 = firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x4", childCategoryIds: ["0x3"] }));
      await Promise.all([promise1, promise2, vi.advanceTimersByTimeAsync(20)]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("batches requests which are less than 20 ms apart", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const promise1 = firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] }));
      await vi.advanceTimersByTimeAsync(19);
      const promise2 = firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x4", childCategoryIds: ["0x3"] }));
      await Promise.all([promise1, promise2, vi.advanceTimersByTimeAsync(2)]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("does not batch requests which are more than 20 ms apart", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const promise1 = firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] }));
      await vi.advanceTimersByTimeAsync(21);
      const promise2 = firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x4", childCategoryIds: ["0x3"] }));
      await Promise.all([promise1, promise2, vi.advanceTimersByTimeAsync(20)]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
    });

    it("batches mixed category and element requests into single query", async () => {
      using vp = createFakeViewport({
        queryHandler: () => [
          { modelId: "0x1", reqParent: null, reqCategory: "0x2", ownCategory: "0x3", id: "0x100" },
          { modelId: "0x1", reqParent: "0x10", reqCategory: null, ownCategory: "0x3", id: "0x200" },
        ],
      });
      const cache = createFakeCache(vp);

      const promise1 = firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] }));
      const promise2 = firstValueFrom(cache.getChildElements({ modelId: "0x1", parentElementId: "0x10", childCategoryIds: ["0x3"] }));
      await Promise.all([promise1, promise2, vi.advanceTimersByTimeAsync(20)]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("caches empty values", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const [result1] = await Promise.all([
        firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] })),
        vi.advanceTimersByTimeAsync(20),
      ]);
      const result2 = await firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] }));
      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("caches values returned by query", async () => {
      using vp = createFakeViewport({
        queryHandler: () => [{ modelId: "0x1", reqParent: null, reqCategory: "0x2", ownCategory: "0x3", id: "0x100" }],
      });
      const cache = createFakeCache(vp);

      const [result1] = await Promise.all([
        firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] })),
        vi.advanceTimersByTimeAsync(20),
      ]);
      const result2 = await firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] }));
      expect(result1).toEqual(["0x100"]);
      expect(result2).toEqual(["0x100"]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("caches element request values", async () => {
      using vp = createFakeViewport({
        queryHandler: () => [{ modelId: "0x1", reqParent: "0x10", reqCategory: null, ownCategory: "0x3", id: "0x100" }],
      });
      const cache = createFakeCache(vp);

      const [result1] = await Promise.all([
        firstValueFrom(cache.getChildElements({ modelId: "0x1", parentElementId: "0x10", childCategoryIds: ["0x3"] })),
        vi.advanceTimersByTimeAsync(20),
      ]);
      const result2 = await firstValueFrom(cache.getChildElements({ modelId: "0x1", parentElementId: "0x10", childCategoryIds: ["0x3"] }));
      expect(result1).toEqual(["0x100"]);
      expect(result2).toEqual(["0x100"]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("only requests missing childCategoryIds when in-flight batch covers them", async () => {
      using vp = createFakeViewport({
        queryHandler: () => [{ modelId: "0x1", reqParent: null, reqCategory: "0x2", ownCategory: "0x3", id: "0x100" }],
      });
      const cache = createFakeCache(vp);

      // First request caches childCategoryId "0x3"
      const promise1 = firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] }));
      // Second request arrives before the first batch fires — "0x3" is in-flight, so only "0x4" needs to be added
      const promise2 = firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3", "0x4"] }));
      const [result1, result2] = await Promise.all([promise1, promise2, vi.advanceTimersByTimeAsync(20)]);
      expect(result1).toEqual(["0x100"]);
      expect(result2).toEqual(expect.arrayContaining(["0x100"]));
      // Both requests are served by a single query since they're in the same batch
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
      const params = vi.mocked(vp.iModel.createQueryReader).mock.calls[0][1];
      const ids = CompressedId64Set.decompressSet((params?.serialize() as any)[1].value);

      expect(ids.has("0x3")).toBe(true);
      expect(ids.has("0x4")).toBe(true);
    });

    it("only requests missing childCategoryIds on subsequent calls", async () => {
      using vp = createFakeViewport({
        queryHandler: () => [{ modelId: "0x1", reqParent: null, reqCategory: "0x2", ownCategory: "0x3", id: "0x100" }],
      });
      const cache = createFakeCache(vp);

      // First request caches childCategoryId "0x3"
      const [result1] = await Promise.all([
        firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] })),
        vi.advanceTimersByTimeAsync(20),
      ]);
      expect(result1).toEqual(["0x100"]);

      // Second request after first batch completed — "0x3" is cached, only "0x4" should be queried
      const [result2] = await Promise.all([
        firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3", "0x4"] })),
        vi.advanceTimersByTimeAsync(20),
      ]);
      expect(result2).toEqual(expect.arrayContaining(["0x100"]));
      expect(vp.iModel.createQueryReader).toHaveBeenCalledTimes(2);
      const secondParams = vi.mocked(vp.iModel.createQueryReader).mock.calls[1][1];
      const secondIds = CompressedId64Set.decompressSet((secondParams?.serialize() as any)[1].value);
      expect(secondIds.has("0x3")).toBe(false); // "0x3" does not appear
      expect(secondIds.has("0x4")).toBe(true); // "0x4" appears
    });

    it("returns combined results from multiple childCategoryIds", async () => {
      using vp = createFakeViewport({
        queryHandler: () => [
          { modelId: "0x1", reqParent: null, reqCategory: "0x2", ownCategory: "0x3", id: "0x100" },
          { modelId: "0x1", reqParent: null, reqCategory: "0x2", ownCategory: "0x4", id: "0x200" },
        ],
      });
      const cache = createFakeCache(vp);

      const [result] = await Promise.all([
        firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3", "0x4"] })),
        vi.advanceTimersByTimeAsync(20),
      ]);
      expect(result).toEqual(expect.arrayContaining(["0x100", "0x200"]));
    });

    it("does not re-request childCategoryIds already in-flight", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);

      const promise1 = firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] }));
      const promise2 = firstValueFrom(cache.getChildElements({ modelId: "0x1", categoryId: "0x2", childCategoryIds: ["0x3"] }));
      await Promise.all([promise1, promise2, vi.advanceTimersByTimeAsync(20)]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("executes single query if 100 where clauses are generated", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);
      const promises = new Array<Promise<unknown>>();
      for (let i = 1; i <= 100; ++i) {
        promises.push(firstValueFrom(cache.getChildElements({ modelId: `0x${i}`, categoryId: "0x1000", childCategoryIds: ["0x2000"] })));
      }
      await Promise.all([...promises, vi.advanceTimersByTimeAsync(20)]);
      expect(vp.iModel.createQueryReader).toHaveBeenCalledOnce();
    });

    it("executes separate queries if > 100 where clauses are generated", async () => {
      using vp = createFakeViewport();
      const cache = createFakeCache(vp);
      const promises = new Array<Promise<unknown>>();
      for (let i = 1; i <= 101; ++i) {
        promises.push(firstValueFrom(cache.getChildElements({ modelId: `0x${i}`, categoryId: "0x1000", childCategoryIds: ["0x2000"] })));
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
      it("returns element ids for root category elements", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const el1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
            const el2 = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
            return { model, category, el1, el2 };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const result = await firstValueFrom(
          cache.getChildElements({ modelId: keys.model.id, categoryId: keys.category.id, childCategoryIds: [keys.category.id] }),
        );
        expect(result).toEqual([keys.el1.id, keys.el2.id]);
        expect(result).toHaveLength(2);
      });

      it("returns empty array for incorrect model", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
            return { model, category };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const result = await firstValueFrom(cache.getChildElements({ modelId: "0x123", categoryId: keys.category.id, childCategoryIds: [keys.category.id] }));
        expect(result).toEqual([]);
      });

      it("returns descendant elements including nested children", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const catA = insertSpatialCategory({ txn, codeValue: "catA" });
            const catB = insertSpatialCategory({ txn, codeValue: "catB" });
            // root element catA
            const el1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id });
            // child catB
            const el1_1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1.id });
            // grandchild catB
            const el1_1_1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1_1.id });
            return { model, catA, catB, el1, el1_1, el1_1_1 };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const result = await firstValueFrom(cache.getChildElements({ modelId: keys.model.id, categoryId: keys.catA.id, childCategoryIds: [keys.catB.id] }));
        expect(result).toEqual([keys.el1_1.id, keys.el1_1_1.id]);
        expect(result).toHaveLength(2);
      });

      it("returns elements scoped to parentElementId", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const catA = insertSpatialCategory({ txn, codeValue: "catA" });
            const catB = insertSpatialCategory({ txn, codeValue: "catB" });
            const el1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id });
            // direct child of el1 in catA (matches category request)
            const el1_childA = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id, parentId: el1.id });
            // el1_childA has a descendant in catB
            const el1_grandchildB = insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1_childA.id });
            // another root element in catA with its own catB descendant (should not appear)
            const el2 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id });
            const el2_childA = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id, parentId: el2.id });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el2_childA.id });
            return { model, catA, catB, el1, el1_childA, el1_grandchildB, el2 };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        // Request: find descendants of catA elements under el1, filter by catB
        const result = await firstValueFrom(
          cache.getChildElements({ modelId: keys.model.id, categoryId: keys.catA.id, parentElementId: keys.el1.id, childCategoryIds: [keys.catB.id] }),
        );
        expect(result).toEqual([keys.el1_grandchildB.id]);
      });

      it("returns elements from multiple childCategoryIds", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const catA = insertSpatialCategory({ txn, codeValue: "catA" });
            const catB = insertSpatialCategory({ txn, codeValue: "catB" });
            const catC = insertSpatialCategory({ txn, codeValue: "catC" });
            const el1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id });
            const childB = insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1.id });
            const childC = insertPhysicalElement({ txn, modelId: model.id, categoryId: catC.id, parentId: el1.id });
            return { model, catA, catB, catC, el1, childB, childC };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const result = await firstValueFrom(
          cache.getChildElements({ modelId: keys.model.id, categoryId: keys.catA.id, childCategoryIds: [keys.catB.id, keys.catC.id] }),
        );
        expect(result).toEqual(expect.arrayContaining([keys.childB.id, keys.childC.id]));
        expect(result).toHaveLength(2);
      });
    });

    describe("element requests", () => {
      it("returns empty array when element has no children", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const el = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
            return { model, category, el };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const result = await firstValueFrom(
          cache.getChildElements({ modelId: keys.model.id, parentElementId: keys.el.id, childCategoryIds: [keys.category.id] }),
        );
        expect(result).toEqual([]);
      });

      it("returns all descendant elements in specified child categories", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const catA = insertSpatialCategory({ txn, codeValue: "catA" });
            const catB = insertSpatialCategory({ txn, codeValue: "catB" });
            const el1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id });
            const child1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id, parentId: el1.id });
            const child2 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1.id });
            const grandchild = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id, parentId: child2.id });
            return { model, catA, catB, el1, child1, child2, grandchild };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        const result = await firstValueFrom(
          cache.getChildElements({ modelId: keys.model.id, parentElementId: keys.el1.id, childCategoryIds: [keys.catA.id, keys.catB.id] }),
        );
        expect(result).toEqual(expect.arrayContaining([keys.child1.id, keys.child2.id, keys.grandchild.id]));
        expect(result).toHaveLength(3);
      });

      it("returns only elements in specified childCategoryIds", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const catA = insertSpatialCategory({ txn, codeValue: "catA" });
            const catB = insertSpatialCategory({ txn, codeValue: "catB" });
            const el1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id });
            const childA = insertPhysicalElement({ txn, modelId: model.id, categoryId: catA.id, parentId: el1.id });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: catB.id, parentId: el1.id });
            return { model, catA, catB, el1, childA };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        const cache = createCache(imodelConnection);

        // Only request catA children
        const result = await firstValueFrom(cache.getChildElements({ modelId: keys.model.id, parentElementId: keys.el1.id, childCategoryIds: [keys.catA.id] }));
        expect(result).toEqual([keys.childA.id]);
      });
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { BaseIdsCache } from "../../../../tree-widget-react/components/trees/common/internal/caches/BaseIdsCache.js";
import { ModelsTreeIdsCache } from "../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { defaultHierarchyConfiguration } from "../../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import { createIModelMock } from "../../Common.js";

describe("ModelsTreeIdsCache", () => {
  function createIdsCache(queryHandler: (query: string) => any[]) {
    const iModel = createIModelMock({ queryHandler });
    const queryExecutor = createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(iModel), "unbounded");
    const baseIdsCache = new BaseIdsCache({ queryExecutor, elementClassName: defaultHierarchyConfiguration.elementClassSpecification, type: "3d" });
    const idsCache = new ModelsTreeIdsCache({
      queryExecutor,
      hierarchyConfig: defaultHierarchyConfiguration,
      baseIdsCache,
    });
    return idsCache;
  }

  it("caches category element count", async () => {
    const modelId = "0x1";
    const categoryId = "0x2";
    const elementCount = 3;
    const stub = vi.fn((query: string) => {
      if (query.includes("Descendants") && query.includes(`Model.Id = ${modelId}`)) {
        return [{ modelId, reqParent: null, reqCategory: categoryId, ownCategory: categoryId, cnt: elementCount }];
      }
      throw new Error(`Unexpected query: ${query}`);
    });
    const cache = createIdsCache(stub);
    await expect(firstValueFrom(cache.getDescendantsCounts({ modelId, categoryId }))).resolves.toEqual([{ categoryId, count: elementCount }]);
    expect(stub).toHaveBeenCalledOnce();
    await expect(firstValueFrom(cache.getDescendantsCounts({ modelId, categoryId }))).resolves.toEqual([{ categoryId, count: elementCount }]);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("runs only one query when multiple requests are made", async () => {
    const modelId = "0x1";
    const categoryId = "0x2";
    const categoryId2 = "0x3";
    const elementCount1 = 3;
    const elementCount2 = 4;
    const stub = vi.fn((query: string) => {
      if (query.includes("Descendants") && query.includes(`Model.Id = ${modelId}`)) {
        return [
          { modelId, reqParent: null, reqCategory: categoryId, ownCategory: categoryId, cnt: elementCount1 },
          { modelId, reqParent: null, reqCategory: categoryId2, ownCategory: categoryId2, cnt: elementCount2 },
        ];
      }
      throw new Error(`Unexpected query: ${query}`);
    });
    const cache = createIdsCache(stub);
    const obs1 = cache.getDescendantsCounts({ modelId, categoryId });
    const obs2 = cache.getDescendantsCounts({ modelId, categoryId: categoryId2 });
    const [count1, count2] = await Promise.all([firstValueFrom(obs1), firstValueFrom(obs2)]);
    expect(count1).toEqual([
      {
        categoryId,
        count: elementCount1,
      },
    ]);
    expect(count2).toEqual([
      {
        categoryId: categoryId2,
        count: elementCount2,
      },
    ]);
    expect(stub).toHaveBeenCalledOnce();
  });
});

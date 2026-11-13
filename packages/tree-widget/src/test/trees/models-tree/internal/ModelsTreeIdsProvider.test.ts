/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { SharedIdsProvider } from "../../../../tree-widget-react/shared/internal/idsProviders/SharedIdsProvider.js";
import { ModelsTreeIdsProvider } from "../../../../tree-widget-react/trees/models-tree/internal/ModelsTreeIdsProvider.js";
import { defaultHierarchyConfiguration } from "../../../../tree-widget-react/trees/models-tree/ModelsTreeDefinition.js";
import { createIModelMock } from "../../Common.js";

describe("ModelsTreeIdsProvider", () => {
  function createIdsProvider(queryHandler: (query: string) => any[]) {
    const iModel = createIModelMock({ queryHandler });
    const queryExecutor = createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(iModel), "unbounded");
    const sharedIdsProvider = new SharedIdsProvider({ queryExecutor, elementClassName: defaultHierarchyConfiguration.elements.baseClass, type: "3d" });
    const idsProvider = new ModelsTreeIdsProvider({
      queryExecutor,
      sharedIdsProvider,
      hierarchyConfig: defaultHierarchyConfiguration,
    });
    return idsProvider;
  }

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
    const idsProvider = createIdsProvider(stub);
    await expect(firstValueFrom(idsProvider.getDescendantsCounts({ modelId, categoryId }))).resolves.toEqual([{ categoryId, count: elementCount }]);
    expect(stub).toHaveBeenCalledOnce();
    await expect(firstValueFrom(idsProvider.getDescendantsCounts({ modelId, categoryId }))).resolves.toEqual([{ categoryId, count: elementCount }]);
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
    const idsProvider = createIdsProvider(stub);
    const obs1 = idsProvider.getDescendantsCounts({ modelId, categoryId });
    const obs2 = idsProvider.getDescendantsCounts({ modelId, categoryId: categoryId2 });
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

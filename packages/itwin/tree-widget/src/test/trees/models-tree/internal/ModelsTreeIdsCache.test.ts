/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { firstValueFrom } from "rxjs";
import sinon from "sinon";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { ModelsTreeIdsCache } from "../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { defaultHierarchyConfiguration } from "../../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import { createIModelMock } from "../../Common.js";

describe("ModelsTreeIdsCache", () => {
  function createIdsCache(queryHandler: (query: string) => any[]) {
    const iModel = createIModelMock({ queryHandler });
    return new ModelsTreeIdsCache(createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(iModel), "unbounded"), defaultHierarchyConfiguration);
  }

  it("caches category element count", async () => {
    const modelId = "0x1";
    const categoryId = "0x2";
    const elementIds = ["0x10", "0x20", "0x30"];
    const stub = sinon.fake((query: string) => {
      if (query.includes(`WHERE Parent.Id IS NULL AND (Model.Id = ${modelId} AND Category.Id IN (${categoryId}))`)) {
        return [{ modelId, categoryId, elementsCount: elementIds.length }];
      }
      throw new Error(`Unexpected query: ${query}`);
    });
    using cache = createIdsCache(stub);
    await expect(firstValueFrom(cache.getCategoryElementsCount({ modelId, categoryId }))).to.eventually.eq(elementIds.length);
    expect(stub).to.have.callCount(1);
    await expect(firstValueFrom(cache.getCategoryElementsCount({ modelId, categoryId }))).to.eventually.eq(elementIds.length);
    expect(stub).to.have.callCount(1);
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { ModelsTreeIdsCache } from "../../../../components/trees/models-tree/internal/ModelsTreeIdsCache";
import { defaultHierarchyConfiguration } from "../../../../components/trees/models-tree/ModelsTreeDefinition";
import { createIModelMock } from "../../Common";

describe("ModelsTreeIdsCache", () => {
  function createIdsCache(queryHandler: (query: string) => any[]) {
    const iModel = createIModelMock(queryHandler);
    return new ModelsTreeIdsCache(createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(iModel), "unbounded"), defaultHierarchyConfiguration);
  }

  it("caches model element count", async () => {
    const modelId = "0x1";
    const categoryId = "0x2";
    const elementIds = ["0x10", "0x20", "0x30"];
    const stub = sinon.fake((query: string) => {
      if (query.includes("GROUP BY modelId, categoryId")) {
        return elementIds.map((elementId) => ({ elementId, modelId, categoryId }));
      }
      if (query.includes("COUNT(*)")) {
        return [{ modelId, elementCount: elementIds.length }];
      }

      return [];
    });
    const cache = createIdsCache(stub);
    await expect(cache.getModelElementCount(modelId)).to.eventually.eq(elementIds.length);
    expect(stub).to.have.callCount(2);
    await expect(cache.getModelElementCount(modelId)).to.eventually.eq(elementIds.length);
    expect(stub).to.have.callCount(2);
  });

  it("caches category element count", async () => {
    const modelId = "0x1";
    const categoryId = "0x2";
    const elementIds = ["0x10", "0x20", "0x30"];
    const stub = sinon.fake((query: string) => {
      if (query.includes("WHERE Model.Id = ? AND Category.Id = ?")) {
        return [[elementIds.length]];
      }

      throw new Error(`Unexpected query: ${query}`);
    });
    const cache = createIdsCache(stub);
    await expect(cache.getCategoryElementsCount(modelId, categoryId)).to.eventually.eq(elementIds.length);
    expect(stub).to.have.callCount(1);
    await expect(cache.getCategoryElementsCount(modelId, categoryId)).to.eventually.eq(elementIds.length);
    expect(stub).to.have.callCount(1);
  });
});

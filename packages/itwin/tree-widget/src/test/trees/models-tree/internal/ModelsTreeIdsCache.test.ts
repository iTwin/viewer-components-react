/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { ModelsTreeIdsCache } from "../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { defaultHierarchyConfiguration } from "../../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../../IModelUtils.js";
import { createIModelAccess, createIModelMock } from "../../Common.js";

import type { IModelConnection } from "@itwin/core-frontend";

describe("ModelsTreeIdsCache", () => {
  describe("#unit", () => {
    function createIdsCache(queryHandler: (query: string) => any[]) {
      const iModel = createIModelMock(queryHandler);
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
      await expect(cache.getCategoryElementsCount(modelId, categoryId)).to.eventually.eq(elementIds.length);
      expect(stub).to.have.callCount(1);
      await expect(cache.getCategoryElementsCount(modelId, categoryId)).to.eventually.eq(elementIds.length);
      expect(stub).to.have.callCount(1);
    });
  });

  describe("#integration", () => {
    before(async () => {
      await initializePresentationTesting({
        backendProps: {
          caching: {
            hierarchies: {
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async () => {
      await terminatePresentationTesting();
    });

    function createIdsCache(props: { imodel: IModelConnection }) {
      const idsCache = new ModelsTreeIdsCache(createIModelAccess(props.imodel), defaultHierarchyConfiguration);
      return idsCache;
    }

    it("Does not throw with many requests to `idsCache.getCategoryElementsCount`", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const modelId = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId, categoryId });
        return { categoryId, modelId };
      });

      const { imodel, ...keys } = buildIModelResult;
      using idsCache = createIdsCache({ imodel });
      const promiseToAwait = idsCache.getCategoryElementsCount(keys.modelId, keys.categoryId);
      for (let i = 0; i < 5000; ++i) {
        void idsCache.getCategoryElementsCount(`0x${i}`, `0x${i}`);
      }
      await promiseToAwait;
    });
  });
});

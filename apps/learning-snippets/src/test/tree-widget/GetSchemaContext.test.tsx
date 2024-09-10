/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
import { expect } from "chai";
import { join } from "path";
import { IModel, IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils";
// __PUBLISH_EXTRACT_START__ TreeWidget.GetSchemaContextExampleImports
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import type { IModelConnection } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_END__

describe("Tree widget", () => {
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("GetSchemaContext", () => {
        before(async function () {
          await initializePresentationTesting({
            backendProps: {
              caching: {
                hierarchies: {
                  mode: HierarchyCacheMode.Memory,
                },
              },
            },
            testOutputDir: join(__dirname, "output"),
            backendHostProps: {
              cacheDir: join(__dirname, "cache"),
            },
            rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
          });
          // eslint-disable-next-line @itwin/no-internal
          ECSchemaRpcImpl.register();
        });

        after(async function () {
          await terminatePresentationTesting();
        });

        it("Returns schema context", async function () {
          const imodelConnection = (
            await buildIModel(this, async (builder) => {
              const model = insertPhysicalModelWithPartition({ builder, codeValue: "model", partitionParentId: IModel.rootSubjectId });
              const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ builder, userLabel: `element`, modelId: model.id, categoryId: category.id });
              return { model, category };
            })
          ).imodel;
          // __PUBLISH_EXTRACT_START__ TreeWidget.GetSchemaContextExample
          const schemaContextCache = new Map<string, SchemaContext>();
          function getSchemaContext(imodel: IModelConnection) {
            const key = imodel.getRpcProps().key;
            let schemaContext = schemaContextCache.get(key);
            if (!schemaContext) {
              const schemaLocater = new ECSchemaRpcLocater(imodel.getRpcProps());
              schemaContext = new SchemaContext();
              schemaContext.addLocater(schemaLocater);
              schemaContextCache.set(key, schemaContext);
              imodel.onClose.addOnce(() => schemaContextCache.delete(key));
            }
            return schemaContext;
          }
          // __PUBLISH_EXTRACT_END__
          const result = getSchemaContext(imodelConnection);

          expect(result).to.be.eq(schemaContextCache.get(imodelConnection.getRpcProps().key));
        });
      });
    });
  });
});

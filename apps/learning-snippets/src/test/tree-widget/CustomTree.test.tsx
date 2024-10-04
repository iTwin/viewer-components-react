/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
import { join } from "path";
// __PUBLISH_EXTRACT_START__ TreeWidget.CustomTreeExampleImports
import type { ComponentPropsWithoutRef } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import { Tree, TreeRenderer } from "@itwin/tree-widget-react";
import { createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";
// __PUBLISH_EXTRACT_END__
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils";
import { getSchemaContext, getTestViewer, mockGetBoundingClientRect, TreeWidgetTestUtils } from "../../utils/TreeWidgetTestUtils";

describe("Tree widget", () => {
  describe("Learning snippets", () => {
    describe("Components", () => {
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

      beforeEach(async () => {
        await NoRenderApp.startup();
        await TreeWidgetTestUtils.initialize();
      });

      afterEach(async () => {
        TreeWidgetTestUtils.terminate();
        await IModelApp.shutdown();
        sinon.restore();
      });

      it("Renders custom tree", async function () {
        const imodelConnection = (
          await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            return { category };
          })
        ).imodel;
        const testViewport = getTestViewer(imodelConnection);
        const unifiedSelectionStorage = createStorage();
        sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
        sinon.stub(UiFramework, "getIModelConnection").returns(imodelConnection);
        mockGetBoundingClientRect();

        // __PUBLISH_EXTRACT_START__ TreeWidget.CustomTreeExample
        type TreeProps = ComponentPropsWithoutRef<typeof Tree>;
        const getHierarchyDefinition: TreeProps["getHierarchyDefinition"] = ({ imodelAccess }) => {
          // create a hierarchy definition that defines what should be shown in the tree
          // see https://github.com/iTwin/presentation/blob/master/packages/hierarchies/learning/imodel/HierarchyDefinition.md
          const labelsQueryFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: imodelAccess });
          const nodesQueryFactory = createNodesQueryClauseFactory({ imodelAccess, instanceLabelSelectClauseFactory: labelsQueryFactory });
          return createPredicateBasedHierarchyDefinition({
            classHierarchyInspector: imodelAccess,
            hierarchy: {
              // For root nodes, select all BisCore.GeometricModel3d instances
              rootNodes: async () => [
                {
                  fullClassName: "BisCore.GeometricModel3d",
                  query: {
                    ecsql: `
                      SELECT
                        ${await nodesQueryFactory.createSelectClause({
                          ecClassId: { selector: "this.ECClassId" },
                          ecInstanceId: { selector: "this.ECInstanceId" },
                          nodeLabel: {
                            selector: await labelsQueryFactory.createSelectClause({ classAlias: "this", className: "BisCore.GeometricModel3d" }),
                          },
                        })}
                      FROM BisCore.GeometricModel3d this
                    `,
                  },
                },
              ],
              childNodes: [],
            },
          });
        };

        interface MyTreeProps {
          imodel: IModelConnection;
        }

        function MyTree({ imodel }: MyTreeProps) {
          return (
            <Tree
              treeName="MyTree"
              imodel={imodel}
              selectionStorage={unifiedSelectionStorage}
              getSchemaContext={getSchemaContext}
              getHierarchyDefinition={getHierarchyDefinition}
              treeRenderer={(props) => <TreeRenderer {...props} />}
            />
          );
        }
        // __PUBLISH_EXTRACT_END__
        const result = render(<MyTree imodel={imodelConnection} />);

        await waitFor(() => result.getByText("TestPhysicalModel"));
        cleanup();
      });
    });
  });
});

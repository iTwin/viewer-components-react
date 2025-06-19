/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */

// __PUBLISH_EXTRACT_START__ TreeWidget.CustomTreeExampleImports
import type { ComponentPropsWithoutRef } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import { Tree, TreeRenderer } from "@itwin/tree-widget-react";
import { createNodesQueryClauseFactory, createPredicateBasedHierarchyDefinition } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";
// __PUBLISH_EXTRACT_END__
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { getSchemaContext, getTestViewer, mockGetBoundingClientRect, TreeWidgetTestUtils } from "../../utils/TreeWidgetTestUtils.js";

describe("Tree widget", () => {
  mockGetBoundingClientRect();
  describe("Learning snippets", () => {
    describe("Components", () => {
      before(async function () {
        await initializeLearningSnippetsTests();
        await TreeWidgetTestUtils.initialize();
      });

      after(async function () {
        await terminateLearningSnippetsTests();
        TreeWidgetTestUtils.terminate();
      });

      afterEach(async () => {
        sinon.restore();
      });

      it("renders custom tree", async function () {
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

        using _ = { [Symbol.dispose]: cleanup };
        const result = render(<MyTree imodel={imodelConnection} />);
        await waitFor(() => result.getByText("TestPhysicalModel"));
      });
    });
  });
});

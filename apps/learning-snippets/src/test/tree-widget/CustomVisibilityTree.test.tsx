/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable unused-imports/no-unused-vars */

import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
// __PUBLISH_EXTRACT_START__ TreeWidget.CustomVisibilityTreeExampleImports
import { BeEvent } from "@itwin/core-bentley";
import { VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import { createPredicateBasedHierarchyDefinition } from "@itwin/presentation-hierarchies";
import type { ComponentPropsWithoutRef } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_END__
import { IModelApp } from "@itwin/core-frontend";
import { createStorage } from "@itwin/unified-selection";
import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { cleanup, getTestViewer, mockGetBoundingClientRect, render, TreeWidgetTestUtils, waitFor } from "./TestUtils.js";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { VisibilityStatus } from "@itwin/tree-widget-react";
import { withEditTxn } from "@itwin/core-backend";

describe("Tree widget", () => {
  mockGetBoundingClientRect();
  describe("Learning snippets", () => {
    describe("Components", () => {
      beforeAll(async () => {
        await initializeLearningSnippetsTests();
        await TreeWidgetTestUtils.initialize();
      });

      afterAll(async () => {
        await terminateLearningSnippetsTests();
        TreeWidgetTestUtils.terminate();
      });

      it("renders custom visibility tree", async () => {
        const { imodelConnection } = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ txn, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });
            return { category };
          }),
        );
        const testViewport = getTestViewer(imodelConnection);
        const unifiedSelectionStorage = createStorage();
        vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
        vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

        // __PUBLISH_EXTRACT_START__ TreeWidget.CustomVisibilityTreeExample
        type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;
        const getHierarchyDefinition: VisibilityTreeProps["getHierarchyDefinition"] = ({ imodelAccess }) => {
          // create a hierarchy definition that defines what should be shown in the tree
          // see https://github.com/iTwin/presentation/blob/master/packages/hierarchies/learning/imodel/HierarchyDefinition.md
          return createPredicateBasedHierarchyDefinition({
            classHierarchyInspector: imodelAccess,
            hierarchy: {
              // For root nodes, select all BisCore.GeometricModel3d instances
              rootNodes: async ({ createSelectClause }) => [
                {
                  fullClassName: "BisCore.GeometricModel3d",
                  query: {
                    ecsql: `
                      SELECT
                        ${await createSelectClause({
                          ecClassId: { selector: "this.ECClassId" },
                          ecInstanceId: { selector: "this.ECInstanceId" },
                          nodeLabel: {
                            of: { classAlias: "this", className: "BisCore.GeometricModel3d" },
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

        const visibilityHandlerFactory: VisibilityTreeProps["visibilityHandlerFactory"] = () => {
          return {
            // event that can be used to notify tree when visibility of instances represented by tree nodes changes from outside.
            onVisibilityChange: new BeEvent(),
            async getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> {
              return { state: "visible" };
              // determine visibility status of the instance represented by tree node.
            },
            async changeVisibility(node: HierarchyNode, on: boolean): Promise<void> {
              // change visibility of the instance represented by tree node.
            },
            [Symbol.dispose]() {
              // if necessary, do some clean up before new visibility handler is created or component is unmounted.
            },
          };
        };

        interface MyVisibilityTreeProps {
          imodel: IModelConnection;
        }

        function MyVisibilityTree({ imodel }: MyVisibilityTreeProps) {
          return (
            <VisibilityTree
              treeName="MyVisibilityTree"
              imodel={imodel}
              selectionStorage={unifiedSelectionStorage}
              getHierarchyDefinition={getHierarchyDefinition}
              visibilityHandlerFactory={visibilityHandlerFactory}
              treeRenderer={(props) => <VisibilityTreeRenderer {...props} treeLabel="My visibility tree" />}
            />
          );
        }
        // __PUBLISH_EXTRACT_END__

        using _ = { [Symbol.dispose]: cleanup };
        const result = render(<MyVisibilityTree imodel={imodelConnection} />);
        await waitFor(() => result.getByText("TestPhysicalModel"));
      });
    });
  });
});

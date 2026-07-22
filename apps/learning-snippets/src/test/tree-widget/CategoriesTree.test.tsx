/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */

import { useCallback, useMemo } from "react";
import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ TreeWidget.CategoriesTreeExampleImports
import { CategoriesTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.CustomCategoriesTreeExampleImports
import {
  createTreeWidgetViewport,
  SelectableTree,
  SharedTreeContextProvider,
  useCategoriesTree,
  useCategoriesTreeButtonProps,
  VisibilityTree,
  VisibilityTreeRenderer,
} from "@itwin/tree-widget-react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { SelectionStorage } from "@itwin/unified-selection";
import type { ComponentPropsWithoutRef } from "react";
// __PUBLISH_EXTRACT_END__
import { createStorage } from "@itwin/unified-selection";
import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { cleanup, getTestViewer, mockGetBoundingClientRect, render, TreeWidgetTestUtils, waitFor } from "./TestUtils.js";
import { withEditTxn } from "@itwin/core-backend";

describe("Tree widget", () => {
  mockGetBoundingClientRect();
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("Categories tree", () => {
        beforeAll(async () => {
          await initializeLearningSnippetsTests();
          await TreeWidgetTestUtils.initialize();
        });

        afterAll(async () => {
          await terminateLearningSnippetsTests();
          TreeWidgetTestUtils.terminate();
        });

        it("renders <CategoriesTreeComponent />", async () => {
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

          // __PUBLISH_EXTRACT_START__ TreeWidget.CategoriesTreeExample
          function MyWidget() {
            return (
              <SharedTreeContextProvider>
                <CategoriesTreeComponent
                  // label for the tree, used for accessibility purposes
                  treeLabel="Categories tree"
                  // see "Creating unified selection storage" section for example implementation
                  selectionStorage={unifiedSelectionStorage}
                  headerButtons={[
                    (props) => <CategoriesTreeComponent.ShowAllButton {...props} />,
                    (props) => <CategoriesTreeComponent.HideAllButton {...props} />,
                  ]}
                />
              </SharedTreeContextProvider>
            );
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText } = render(<MyWidget />);
          await waitFor(() => getByText("Test SpatialCategory"));
        });

        it("renders custom categories tree", async () => {
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

          // __PUBLISH_EXTRACT_START__ TreeWidget.CustomCategoriesTreeExample
          type VisibilityTreeRendererProps = ComponentPropsWithoutRef<typeof VisibilityTreeRenderer>;
          type CustomCategoriesTreeRendererProps = Parameters<ComponentPropsWithoutRef<typeof VisibilityTree>["treeRenderer"]>[0];

          function CustomCategoriesTreeRenderer(props: CustomCategoriesTreeRendererProps) {
            const getTreeItemProps = props.getTreeItemProps;
            const getTreeItemPropsCallback = useCallback<Required<VisibilityTreeRendererProps>["getTreeItemProps"]>(
              (node) => {
                const nodeProps = getTreeItemProps(node);
                return {
                  ...nodeProps,
                  label: <>Custom node - {nodeProps.label}</>,
                  description: <>Custom sub label</>,
                };
              },
              [getTreeItemProps],
            );
            return <VisibilityTreeRenderer {...props} treeLabel="Custom categories tree" getTreeItemProps={getTreeItemPropsCallback} />;
          }

          interface CustomCategoriesTreeProps {
            imodel: IModelConnection;
            viewport: Viewport;
            selectionStorage: SelectionStorage;
          }

          function CustomCategoriesTree({ imodel, viewport, selectionStorage }: CustomCategoriesTreeProps) {
            const activeView = useMemo(() => createTreeWidgetViewport(viewport), [viewport]);
            const { buttonProps } = useCategoriesTreeButtonProps({ viewport: activeView });
            const { treeProps, getTreeItemProps } = useCategoriesTree({ activeView });
            return (
              <SelectableTree
                buttons={[
                  <CategoriesTreeComponent.ShowAllButton {...buttonProps} key={"ShowAllButton"} />,
                  <CategoriesTreeComponent.HideAllButton {...buttonProps} key={"HideAllButton"} />,
                ]}
              >
                <VisibilityTree
                  {...treeProps}
                  selectionStorage={selectionStorage}
                  imodel={imodel}
                  treeRenderer={(rendererProps) => (
                    <CustomCategoriesTreeRenderer {...rendererProps} getTreeItemProps={(node) => getTreeItemProps(node, rendererProps)} />
                  )}
                />
              </SelectableTree>
            );
          }

          function CustomCategoriesTreeComponent(props: CustomCategoriesTreeProps) {
            return (
              <SharedTreeContextProvider>
                <CustomCategoriesTree {...props} />
              </SharedTreeContextProvider>
            );
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText } = render(
            <CustomCategoriesTreeComponent imodel={imodelConnection} viewport={testViewport} selectionStorage={unifiedSelectionStorage} />,
          );
          await waitFor(() => {
            getByText("Test SpatialCategory");
            getByText("Custom sub label");
          });
        });
      });
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */

import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
import { IModel } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ TreeWidget.ModelsTreeExampleImports
import { ModelsTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.CustomModelsTreeExampleImports
import { useCallback, useMemo } from "react";
import {
  createTreeWidgetViewport,
  SelectableTree,
  SharedTreeContextProvider,
  useModelsTree,
  useModelsTreeButtonProps,
  VisibilityTree,
  VisibilityTreeRenderer,
} from "@itwin/tree-widget-react";
import type { SelectionStorage } from "@itwin/unified-selection";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { ComponentPropsWithoutRef } from "react";
// __PUBLISH_EXTRACT_END__
import { createStorage } from "@itwin/unified-selection";
import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory, insertSubject } from "test-utilities";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { cleanup, getTestViewer, mockGetBoundingClientRect, render, TreeWidgetTestUtils, waitFor } from "./TestUtils.js";

import type { InstanceKey } from "@itwin/presentation-common";
import { withEditTxn } from "@itwin/core-backend";

describe("Tree widget", () => {
  mockGetBoundingClientRect();
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("Models tree", () => {
        beforeAll(async () => {
          await initializeLearningSnippetsTests();
          await TreeWidgetTestUtils.initialize();
        });

        afterAll(async () => {
          await terminateLearningSnippetsTests();
          TreeWidgetTestUtils.terminate();
        });

        it("renders <ModelsTreeComponent />", async () => {
          const { imodelConnection } = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertPhysicalModelWithPartition({ txn, codeValue: "Test model X", partitionParentId: IModel.rootSubjectId });
              const category = insertSpatialCategory({ txn, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ txn, userLabel: `element`, modelId: model.id, categoryId: category.id });
              return { model };
            }),
          );
          const testViewport = getTestViewer(imodelConnection, true);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

          // __PUBLISH_EXTRACT_START__ TreeWidget.ModelsTreeExample
          function MyWidget() {
            return (
              <SharedTreeContextProvider>
                <ModelsTreeComponent
                  // label for the tree, used for accessibility purposes
                  treeLabel="Models tree"
                  // see "Creating unified selection storage" section for example implementation
                  selectionStorage={unifiedSelectionStorage}
                  headerButtons={[
                    (props) => <ModelsTreeComponent.ShowAllButton {...props} key={"ShowAllButton"} />,
                    (props) => <ModelsTreeComponent.HideAllButton {...props} key={"HideAllButton"} />,
                  ]}
                />
              </SharedTreeContextProvider>
            );
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText } = render(<MyWidget />);
          await waitFor(async () => getByText("Test model X"));
        });

        it("renders custom models tree", async function () {
          const { imodelConnection } = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
              const childSubject = insertSubject({
                txn,
                codeValue: "Test subject X",
                parentId: rootSubject.id,
              });
              const model = insertPhysicalModelWithPartition({ txn, codeValue: "model", partitionParentId: childSubject.id });
              insertPhysicalElement({
                txn,
                userLabel: `element`,
                modelId: model.id,
                categoryId: insertSpatialCategory({ txn, codeValue: "Test SpatialCategory" }).id,
              });
              return { model, childSubject };
            }),
          );
          const testViewport = getTestViewer(imodelConnection, true);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

          // __PUBLISH_EXTRACT_START__ TreeWidget.CustomModelsTreeExample
          type VisibilityTreeRendererProps = ComponentPropsWithoutRef<typeof VisibilityTreeRenderer>;
          type CustomModelsTreeRendererProps = Parameters<ComponentPropsWithoutRef<typeof VisibilityTree>["treeRenderer"]>[0];
          function CustomModelsTreeRenderer(props: CustomModelsTreeRendererProps) {
            const getTreeItemProps = props.getTreeItemProps;
            const getTreeItemPropsCallback = useCallback<Required<VisibilityTreeRendererProps>["getTreeItemProps"]>(
              (node) => {
                const nodeProps = getTreeItemProps(node);
                return {
                  ...nodeProps,
                  label: <>Custom node - {nodeProps.label}</>,
                  description: <>Sublabel - {node.label}</>,
                };
              },
              [getTreeItemProps],
            );
            return <VisibilityTreeRenderer {...props} treeLabel="Custom models tree" getTreeItemProps={getTreeItemPropsCallback} />;
          }

          interface CustomModelsTreeProps {
            imodel: IModelConnection;
            viewport: Viewport;
            selectionStorage: SelectionStorage;
          }

          function CustomModelsTree({ imodel, viewport, selectionStorage }: CustomModelsTreeProps) {
            const activeView = useMemo(() => createTreeWidgetViewport(viewport), [viewport]);
            const { buttonProps } = useModelsTreeButtonProps({ imodel, viewport: activeView });
            const { treeProps, getTreeItemProps } = useModelsTree({ activeView });

            return (
              <SelectableTree
                buttons={[
                  <ModelsTreeComponent.ShowAllButton {...buttonProps} key={"ShowAllButton"} />,
                  <ModelsTreeComponent.HideAllButton {...buttonProps} key={"HideAllButton"} />,
                ]}
              >
                <VisibilityTree
                  {...treeProps}
                  selectionStorage={selectionStorage}
                  imodel={imodel}
                  treeRenderer={(rendererProps) => (
                    <CustomModelsTreeRenderer {...rendererProps} getTreeItemProps={(node) => getTreeItemProps(node, rendererProps)} />
                  )}
                />
              </SelectableTree>
            );
          }

          function CustomModelsTreeComponent(props: CustomModelsTreeProps) {
            return (
              <SharedTreeContextProvider>
                <CustomModelsTree {...props} />
              </SharedTreeContextProvider>
            );
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText } = render(
            <CustomModelsTreeComponent imodel={imodelConnection} viewport={testViewport} selectionStorage={unifiedSelectionStorage} />,
          );
          await waitFor(() => {
            getByText("Test subject X");
            getByText("Sublabel - Test subject X");
          });
        });
      });
    });
  });
});

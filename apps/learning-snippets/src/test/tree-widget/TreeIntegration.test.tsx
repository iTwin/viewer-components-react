/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */

import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ TreeWidget.TreeWidgetViewportReactImports
import { useMemo } from "react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.TreeIntegrationCommonImports
import { ModelsTreeComponent, TreeWidgetContextProvider } from "@itwin/tree-widget-react";
import type { SelectionStorage } from "@itwin/unified-selection";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.TreeWidgetViewportExampleImports
import { createTreeWidgetViewport } from "@itwin/tree-widget-react";
import type { Viewport } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.CustomTreeWidgetViewportExampleImports
import type { TreeWidgetViewport } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.TreeWidgetContextExampleImports
import { CategoriesTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
import { createStorage } from "@itwin/unified-selection";
import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { withEditTxn } from "@itwin/core-backend";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { cleanup, getTestViewer, mockGetBoundingClientRect, render, TreeWidgetTestUtils, waitFor } from "./TestUtils.js";

describe("Tree widget", () => {
  mockGetBoundingClientRect();

  describe("Learning snippets", () => {
    describe("Tree integration", () => {
      beforeAll(async () => {
        await initializeLearningSnippetsTests();
        await TreeWidgetTestUtils.initialize();
      });

      afterAll(async () => {
        await terminateLearningSnippetsTests();
        TreeWidgetTestUtils.terminate();
      });

      it("uses an explicit Tree Widget viewport", async () => {
        const { imodelConnection } = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "Explicit viewport model" });
            const category = insertSpatialCategory({ txn, codeValue: "Explicit viewport category" });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
          }),
        );
        const testViewport = getTestViewer(imodelConnection);
        const unifiedSelectionStorage = createStorage();
        vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(undefined);
        vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

        // __PUBLISH_EXTRACT_START__ TreeWidget.TreeWidgetViewportExample
        interface ModelsTreeWithViewportProps {
          viewport: Viewport;
          selectionStorage: SelectionStorage;
        }

        function ModelsTreeWithViewport({ viewport, selectionStorage }: ModelsTreeWithViewportProps) {
          const treeViewport = useMemo(() => createTreeWidgetViewport(viewport), [viewport]);
          return (
            <TreeWidgetContextProvider localization={IModelApp.localization}>
              <ModelsTreeComponent treeLabel="Models tree" viewport={treeViewport} selectionStorage={selectionStorage} />
            </TreeWidgetContextProvider>
          );
        }
        // __PUBLISH_EXTRACT_END__

        using _ = { [Symbol.dispose]: cleanup };
        const { getByText } = render(<ModelsTreeWithViewport viewport={testViewport} selectionStorage={unifiedSelectionStorage} />);
        await waitFor(() => getByText("Explicit viewport model"));
      });

      it("uses a custom Tree Widget viewport", async () => {
        const { imodelConnection } = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "Custom viewport model" });
            const category = insertSpatialCategory({ txn, codeValue: "Custom viewport category" });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
          }),
        );
        const unifiedSelectionStorage = createStorage();
        vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(undefined);
        vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

        // __PUBLISH_EXTRACT_START__ TreeWidget.CustomTreeWidgetViewportExample
        interface CustomViewport extends TreeWidgetViewport {
          readonly viewType: "3d";
          // ...the custom viewport implements the remaining TreeWidgetViewport members.
        }

        function ModelsTreeWithCustomViewport({ viewport, selectionStorage }: { viewport: CustomViewport; selectionStorage: SelectionStorage }) {
          return (
            <TreeWidgetContextProvider localization={IModelApp.localization}>
              <ModelsTreeComponent treeLabel="Models tree" viewport={viewport} selectionStorage={selectionStorage} />
            </TreeWidgetContextProvider>
          );
        }
        // __PUBLISH_EXTRACT_END__

        using _ = { [Symbol.dispose]: cleanup };
        const customViewport: CustomViewport = {
          ...createTreeWidgetViewport(getTestViewer(imodelConnection)),
          viewType: "3d",
        };
        const { getByText } = render(<ModelsTreeWithCustomViewport viewport={customViewport} selectionStorage={unifiedSelectionStorage} />);
        await waitFor(() => getByText("Custom viewport model"));
      });

      it("shares tree caches between multiple trees", async () => {
        const { imodelConnection } = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "Shared context model" });
            const category = insertSpatialCategory({ txn, codeValue: "Shared context category" });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
          }),
        );
        const viewport = getTestViewer(imodelConnection);
        const unifiedSelectionStorage = createStorage();
        vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(viewport);
        vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

        // __PUBLISH_EXTRACT_START__ TreeWidget.TreeWidgetContextExample
        function TreesWithSharedContext({ selectionStorage }: { selectionStorage: SelectionStorage }) {
          return (
            <TreeWidgetContextProvider localization={IModelApp.localization}>
              <ModelsTreeComponent
                treeLabel="Models tree"
                selectionStorage={selectionStorage}
                headerButtons={[
                  (props) => <ModelsTreeComponent.ShowAllButton {...props} key="show-all" />,
                  (props) => <ModelsTreeComponent.HideAllButton {...props} key="hide-all" />,
                ]}
              />
              <CategoriesTreeComponent
                treeLabel="Categories tree"
                selectionStorage={selectionStorage}
                headerButtons={[
                  (props) => <CategoriesTreeComponent.ShowAllButton {...props} key="show-all" />,
                  (props) => <CategoriesTreeComponent.HideAllButton {...props} key="hide-all" />,
                ]}
              />
            </TreeWidgetContextProvider>
          );
        }
        // __PUBLISH_EXTRACT_END__

        using _ = { [Symbol.dispose]: cleanup };
        const { getByText, getAllByText } = render(<TreesWithSharedContext selectionStorage={unifiedSelectionStorage} />);
        await waitFor(() => getByText("Shared context model"));
        await waitFor(() => getAllByText("Shared context category"));
      });
    });
  });
});

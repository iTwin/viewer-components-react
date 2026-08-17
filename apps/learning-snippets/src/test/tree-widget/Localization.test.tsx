/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
import { IModel } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ TreeWidget.LocalizationRegisterNamespacesImports
import { LOCALIZATION_NAMESPACES } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.LocalizationCreateTreeWidgetImports
import { createTreeWidget, ModelsTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.LocalizationContextProviderImports
import { LocalizationContextProvider, SharedTreeContextProvider } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
import { UiItemsManager } from "@itwin/appui-react";
import { createStorage } from "@itwin/unified-selection";
import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { getTestViewer, mockGetBoundingClientRect, render, TreeWidgetTestUtils, waitFor } from "./TestUtils.js";

import type { Widget } from "@itwin/appui-react";
import { withEditTxn } from "@itwin/core-backend";

describe("Tree widget", () => {
  mockGetBoundingClientRect();
  describe("Learning snippets", () => {
    describe("Localization", () => {
      let imodelConnection: IModelConnection;

      beforeAll(async () => {
        await initializeLearningSnippetsTests();
        await TreeWidgetTestUtils.initialize();

        imodelConnection = (
          await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertPhysicalModelWithPartition({ txn, codeValue: "Test model X", partitionParentId: IModel.rootSubjectId });
              const category = insertSpatialCategory({ txn, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ txn, userLabel: `element`, modelId: model.id, categoryId: category.id });
              return { model };
            }),
          )
        ).imodelConnection;
      });

      afterAll(async () => {
        await terminateLearningSnippetsTests();
        TreeWidgetTestUtils.terminate();
      });

      it("registers localization namespaces", async () => {
        const registerNamespaceSpy = vi.spyOn(IModelApp.localization, "registerNamespace").mockResolvedValue();

        // __PUBLISH_EXTRACT_START__ TreeWidget.LocalizationRegisterNamespaces
        // Register localization namespaces with `i18next` based localization provider.
        for (const namespace of LOCALIZATION_NAMESPACES) {
          await IModelApp.localization.registerNamespace(namespace);
        }
        // __PUBLISH_EXTRACT_END__

        expect(registerNamespaceSpy).toHaveBeenCalled();
      });

      it("localizes strings when `localization` passed to `createTreeWidget`", async () => {
        const testViewport = getTestViewer(imodelConnection, true);
        const unifiedSelectionStorage = createStorage();
        vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
        vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);
        let createTreeWidgetFunction: (() => ReadonlyArray<Widget>) | undefined;
        vi.spyOn(UiItemsManager, "register").mockImplementation(({ id: _id, getWidgets }) => {
          createTreeWidgetFunction = getWidgets;
        });
        const getLocalizedStringSpy = vi.spyOn(IModelApp.localization, "getLocalizedString");

        // __PUBLISH_EXTRACT_START__ TreeWidget.LocalizationCreateTreeWidget
        // When using `createTreeWidget` pass `localization` object and `LocalizationContextProvider` will be added at the widget scope automatically.
        UiItemsManager.register({
          id: "tree-widget-provider",
          getWidgets: () =>
            [
              createTreeWidget({
                localization: IModelApp.localization,
                trees: [
                  {
                    id: ModelsTreeComponent.id,
                    getLabel: ({ standardLabels }) => ModelsTreeComponent.getLabel({ standardLabels }),
                    render: ({ treeLabel }) => <ModelsTreeComponent treeLabel={treeLabel} selectionStorage={unifiedSelectionStorage} />,
                  },
                ],
              }),
            ] as readonly Widget[],
        });
        // __PUBLISH_EXTRACT_END__

        expect(createTreeWidgetFunction).toBeDefined();
        const widgets = createTreeWidgetFunction!();
        expect(widgets).toBeDefined();
        const { getByText } = render(<>{widgets[0].content}</>);
        await waitFor(() => getByText("Test model X"));
        expect(getLocalizedStringSpy).toHaveBeenCalled();
      });

      it("localizes strings when components wrapped in <LocalizationContextProvider />", async () => {
        const testViewport = getTestViewer(imodelConnection, true);
        const unifiedSelectionStorage = createStorage();
        vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
        vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);
        const getLocalizedStringSpy = vi.spyOn(IModelApp.localization, "getLocalizedString");

        // __PUBLISH_EXTRACT_START__ TreeWidget.LocalizationContextProvider
        // When using tree components directly, wrap them with the shared tree and localization providers.
        function TreeComponent() {
          return (
            <SharedTreeContextProvider>
              <LocalizationContextProvider localization={IModelApp.localization}>
                <ModelsTreeComponent
                  treeLabel="Models tree"
                  selectionStorage={unifiedSelectionStorage}
                  headerButtons={[
                    (props) => <ModelsTreeComponent.ShowAllButton {...props} key={"ShowAllButton"} />,
                    (props) => <ModelsTreeComponent.HideAllButton {...props} key={"HideAllButton"} />,
                  ]}
                />
              </LocalizationContextProvider>
            </SharedTreeContextProvider>
          );
        }
        // __PUBLISH_EXTRACT_END__

        const { getByText } = render(<TreeComponent />);
        await waitFor(() => getByText("Test model X"));
        expect(getLocalizedStringSpy).toHaveBeenCalled();
      });
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
/* eslint-disable no-console */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
// __PUBLISH_EXTRACT_START__ TreeWidget.TelemetryTreeComponentExampleImports
import { IModelContentTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.TelemetryCustomTreeExampleImports
import { TelemetryContextProvider, useCategoriesTree, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__

import { IModelApp } from "@itwin/core-frontend";
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { getSchemaContext, getTestViewer, TreeWidgetTestUtils } from "../../utils/TreeWidgetTestUtils.js";

describe("Tree widget", () => {
  describe("Learning snippets", () => {
    describe("Telemetry", () => {
      describe("Usage tracking", () => {
        beforeAll(async () => {
          await initializeLearningSnippetsTests();
          await TreeWidgetTestUtils.initialize();
        });

        afterAll(async () => {
          await terminateLearningSnippetsTests();
          TreeWidgetTestUtils.terminate();
        });

        it("renders <IModelContentTreeComponent /> with telemetry", async () => {
          const { imodelConnection } = await buildIModel(async (imodel) => {
            const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
            return { category };
          });
          const testViewport = getTestViewer(imodelConnection);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);
          const consoleSpy = vi.spyOn(console, "log");

          // __PUBLISH_EXTRACT_START__ TreeWidget.TelemetryTreeComponentExample
          function MyWidget() {
            return (
              <IModelContentTreeComponent
                onPerformanceMeasured={(feature, elapsedTime) => {
                  console.log(`TreeWidget [${feature}] took ${elapsedTime} ms`);
                }}
                onFeatureUsed={(feature) => {
                  console.log(`TreeWidget [${feature}] used`);
                }}
                getSchemaContext={getSchemaContext}
                selectionStorage={unifiedSelectionStorage}
              />
            );
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          render(<MyWidget />);
          await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledOnce();
          });
        });

        it("renders custom categories tree with telemetry", async () => {
          const { imodelConnection } = await buildIModel(async (imodel) => {
            const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ imodel, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
            return { category };
          });
          const viewport = getTestViewer(imodelConnection);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(viewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);
          const consoleSpy = vi.spyOn(console, "log");

          // __PUBLISH_EXTRACT_START__ TreeWidget.TelemetryCustomTreeExample
          function MyWidget() {
            return (
              <TelemetryContextProvider
                componentIdentifier="MyTree"
                onPerformanceMeasured={(feature, elapsedTime) => {
                  console.log(`TreeWidget [${feature}] took ${elapsedTime} ms`);
                }}
                onFeatureUsed={(feature) => {
                  console.log(`TreeWidget [${feature}] used`);
                }}
              >
                <MyTree />
              </TelemetryContextProvider>
            );
          }

          function MyTree() {
            const { categoriesTreeProps, rendererProps } = useCategoriesTree({ activeView: viewport, filter: "" });
            return (
              // VisibilityTree will use provided telemetry context to report used features and their performance
              <VisibilityTree
                {...categoriesTreeProps}
                getSchemaContext={getSchemaContext}
                selectionStorage={unifiedSelectionStorage}
                imodel={imodelConnection}
                treeRenderer={(props) => <VisibilityTreeRenderer {...props} {...rendererProps} />}
              />
            );
            // see "Custom trees" section for more example implementations
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          render(<MyWidget />);
          await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledOnce();
          });
        });
      });
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
/* eslint-disable no-console */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
// __PUBLISH_EXTRACT_START__ TreeWidget.TelemetryTreeComponentExampleImports
import { IModelContentTreeComponent, SharedTreeContextProvider } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.TelemetryCustomTreeExampleImports
import { createTreeWidgetViewport, TelemetryContextProvider, useCategoriesTree, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__

import { useMemo } from "react";

import type { Viewport } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { createStorage } from "@itwin/unified-selection";
import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { cleanup, getTestViewer, render, TreeWidgetTestUtils, waitFor } from "./TestUtils.js";
import { withEditTxn } from "@itwin/core-backend";

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
                treeLabel="IModel content tree"
                selectionStorage={unifiedSelectionStorage}
              />
            );
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          render(<MyWidget />);
          await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
          });
        });

        it("renders custom categories tree with telemetry", async () => {
          const { imodelConnection } = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
              const category = insertSpatialCategory({ txn, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });
              return { category };
            }),
          );
          const activeViewport = getTestViewer(imodelConnection);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(activeViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);
          const consoleSpy = vi.spyOn(console, "log");

          // __PUBLISH_EXTRACT_START__ TreeWidget.TelemetryCustomTreeExample
          function MyWidget({ viewport }: { viewport: Viewport }) {
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
                <SharedTreeContextProvider>
                  <MyTree viewport={viewport} />
                </SharedTreeContextProvider>
              </TelemetryContextProvider>
            );
          }

          function MyTree({ viewport }: { viewport: Viewport }) {
            const activeView = useMemo(() => createTreeWidgetViewport(viewport), [viewport]);
            const { treeProps, getTreeItemProps } = useCategoriesTree({ activeView });
            return (
              // VisibilityTree will use provided telemetry context to report used features and their performance
              <VisibilityTree
                {...treeProps}
                selectionStorage={unifiedSelectionStorage}
                imodel={imodelConnection}
                treeRenderer={(rendererProps) => (
                  <VisibilityTreeRenderer {...rendererProps} treeLabel="My tree" getTreeItemProps={(node) => getTreeItemProps(node, rendererProps)} />
                )}
              />
            );
            // see "Custom trees" section for more example implementations
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          render(<MyWidget viewport={activeViewport} />);
          await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
          });
        });
      });
    });
  });
});

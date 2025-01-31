/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
/* eslint-disable no-console */
/* eslint-disable unused-imports/no-unused-vars */

import { expect } from "chai";
import sinon from "sinon";
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
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { getSchemaContext, getTestViewer, TreeWidgetTestUtils } from "../../utils/TreeWidgetTestUtils.js";

describe("Tree widget", () => {
  describe("Learning snippets", () => {
    describe("Telemetry", () => {
      describe("Usage tracking", () => {
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

        it("renders <IModelContentTreeComponent /> with telemetry", async function () {
          const testImodel = (
            await buildIModel(this, async (builder) => {
              const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
              const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
              return { category };
            })
          ).imodel;
          const testViewport = getTestViewer(testImodel);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(testImodel);
          const consoleSpy = sinon.spy(console, "log");

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
            expect(consoleSpy).to.be.calledOnce;
          });
        });

        it("renders custom categories tree with telemetry", async function () {
          const imodel = (
            await buildIModel(this, async (builder) => {
              const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
              const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
              return { category };
            })
          ).imodel;
          const viewport = getTestViewer(imodel);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => imodel);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel);
          const consoleSpy = sinon.spy(console, "log");

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
                imodel={imodel}
                treeRenderer={(props) => <VisibilityTreeRenderer {...props} {...rendererProps} />}
              />
            );
            // see "Custom trees" section for more example implementations
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          render(<MyWidget />);
          await waitFor(() => {
            expect(consoleSpy).to.be.calledOnce;
          });
        });
      });
    });
  });
});

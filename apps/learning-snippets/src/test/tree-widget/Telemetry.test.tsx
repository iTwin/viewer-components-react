/* eslint-disable no-console */
import type { Widget } from "@itwin/appui-react";
import { expect } from "chai";
import { join } from "path";
import React from "react";
import sinon from "sinon";
import { UiFramework, UiItemsManager } from "@itwin/appui-react";
import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import {
  CategoriesTreeComponent,
  createTreeWidget,
  ModelsTreeComponent,
  TelemetryContextProvider,
  TreeWithHeader,
  useCategoriesTree,
  useCategoriesTreeButtonProps,
  VisibilityTree,
  VisibilityTreeRenderer,
} from "@itwin/tree-widget-react";
import { createStorage } from "@itwin/unified-selection";
import { render, waitFor } from "@testing-library/react";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils";
import { getSchemaContext, getTestViewer, TestUtils } from "../../utils/TestUtils";

// __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Typical-example-imports

// __PUBLISH_EXTRACT_END__
describe("Tree-widget", () => {
  describe("Learning-snippets", () => {
    describe("Telemetry", () => {
      describe("Usage tracking", () => {
        let createTreeWidgetFunction: (() => ReadonlyArray<Widget>) | undefined;

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
          await TestUtils.initialize();
          sinon.stub(UiItemsManager, "register").callsFake(({ id: _id, getWidgets }) => {
            createTreeWidgetFunction = getWidgets;
          });
        });

        afterEach(async () => {
          TestUtils.terminate();
          await IModelApp.shutdown();
          sinon.restore();
        });

        it("Telemetry learning snippet", async function () {
          const imodel = (
            await buildIModel(this, async (builder) => {
              const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
              const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
              return { category };
            })
          ).imodel;
          const testViewport = getTestViewer(imodel);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel);
          const consoleSpy = sinon.spy(console, "log");

          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Telemetry-usage-example
          UiItemsManager.register({
            id: "tree-widget-provider",
            getWidgets: () => [
              createTreeWidget({
                trees: [
                  {
                    id: ModelsTreeComponent.id,
                    getLabel: () => ModelsTreeComponent.getLabel(),
                    render: (_props: any) => (
                      <CategoriesTreeComponent
                        // see "Categories tree" section for details regarding `getSchemaContext` and `selectionStorage` props
                        getSchemaContext={getSchemaContext}
                        selectionStorage={unifiedSelectionStorage}
                        selectionMode={"extended"}
                        onPerformanceMeasured={(feature, elapsedTime) => {
                          console.log(`TreeWidget [${feature}] took ${elapsedTime} ms`);
                        }}
                        onFeatureUsed={(feature) => {
                          console.log(`TreeWidget [${feature}] used`);
                        }}
                      />
                    ),
                  },
                ],
              }),
            ],
          });
          // __PUBLISH_EXTRACT_END__
          expect(createTreeWidgetFunction).to.not.be.undefined;
          const widgets = createTreeWidgetFunction!();
          expect(widgets).to.not.be.undefined;
          render(<>{widgets[0].content}</>);
          await waitFor(() => {
            expect(consoleSpy).to.be.calledOnce;
          });
        });

        it("Telemetry for individual tree components learning snippet", async function () {
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

          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Telemetry-tree-component-example
          function MyWidget() {
            return (
              <CategoriesTreeComponent
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

          render(<MyWidget />);
          await waitFor(() => {
            expect(consoleSpy).to.be.calledOnce;
          });
        });

        it("Telemetry for custom components learning snippet", async function () {
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

          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Telemetry-custom-tree-example
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
            const buttonProps = useCategoriesTreeButtonProps({ viewport });
            const { categoriesTreeProps, rendererProps } = useCategoriesTree({ activeView: viewport, filter: "" });

            return (
              <TreeWithHeader
                buttons={[
                  <CategoriesTreeComponent.ShowAllButton {...buttonProps} key={"ShowAllButton"} />,
                  <CategoriesTreeComponent.HideAllButton {...buttonProps} key={"HideAllButton"} />,
                ]}
              >
                <VisibilityTree
                  {...categoriesTreeProps}
                  getSchemaContext={getSchemaContext}
                  selectionStorage={unifiedSelectionStorage}
                  imodel={imodel}
                  treeRenderer={(props) => <VisibilityTreeRenderer {...props} {...rendererProps} />}
                />
              </TreeWithHeader>
            );
            // see "Custom trees" section for more example implementations
          }
          // __PUBLISH_EXTRACT_END__
          render(<MyWidget />);
          await waitFor(() => {
            expect(consoleSpy).to.be.calledOnce;
          });
        });
      });
    });
  });
});

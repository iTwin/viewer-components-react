/* eslint-disable @typescript-eslint/no-shadow */
import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
// __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Categories-tree-example-imports
import {
  CategoriesTreeComponent,
  TreeWithHeader,
  useCategoriesTree,
  useCategoriesTreeButtonProps,
  VisibilityTree,
  VisibilityTreeRenderer,
} from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
import sinon from "sinon";
import { getSchemaContext, getTestViewer, TestUtils } from "../../utils/TestUtils";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { join } from "path";
import { UiFramework } from "@itwin/appui-react";
import type { SelectionStorage } from "@itwin/unified-selection";
import { createStorage } from "@itwin/unified-selection";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils";
import { render, waitFor } from "@testing-library/react";
import { expect } from "chai";
import type { ComponentPropsWithoutRef } from "react";
import { useCallback } from "react";
import type { SchemaContext } from "@itwin/ecschema-metadata";

describe("Tree-widget", () => {
  describe("Learning-snippets", () => {
    describe("Components", () => {
      describe("Categories tree", () => {
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
        });

        afterEach(async () => {
          TestUtils.terminate();
          await IModelApp.shutdown();
          sinon.restore();
        });

        it("Categories tree snippet", async function () {
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

          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Categories-tree-example
          function MyWidget() {
            return (
              <CategoriesTreeComponent
                // see "Creating schema context" section for example implementation
                getSchemaContext={getSchemaContext}
                selectionMode={"extended"}
                // see "Creating unified selection storage" section for example implementation
                selectionStorage={unifiedSelectionStorage}
                headerButtons={[
                  (props) => <CategoriesTreeComponent.ShowAllButton {...props} />,
                  (props) => <CategoriesTreeComponent.HideAllButton {...props} />,
                  // (props) => <MyCustomButton />,
                ]}
              />
            );
          }
          // __PUBLISH_EXTRACT_END__

          const result = render(<MyWidget />);
          await waitFor(() => expect(result.getByText("Test SpatialCategory")).to.not.be.null, { timeout: 5000 });
        });

        it("Custom categories tree snippet", async function () {
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

          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Categories-tree-example
          type VisibilityTreeRendererProps = ComponentPropsWithoutRef<typeof VisibilityTreeRenderer>;
          type CustomCategoriesTreeRendererProps = Parameters<ComponentPropsWithoutRef<typeof VisibilityTree>["treeRenderer"]>[0];

          function CustomCategoriesTreeRenderer(props: CustomCategoriesTreeRendererProps) {
            const getLabel = props.getLabel;
            const getLabelCallback = useCallback<Required<VisibilityTreeRendererProps>["getLabel"]>(
              (node) => {
                const originalLabel = getLabel(node);
                return <>Custom node - {originalLabel}</>;
              },
              [getLabel],
            );

            const getSublabel = useCallback<Required<VisibilityTreeRendererProps>["getSublabel"]>(() => {
              return <>Custom sub label</>;
            }, []);

            return <VisibilityTreeRenderer {...props} getLabel={getLabelCallback} getSublabel={getSublabel} />;
          }

          interface CustomCategoriesTreeProps {
            imodel: IModelConnection;
            viewport: Viewport;
            getSchemaContext: (imodel: IModelConnection) => SchemaContext;
            selectionStorage: SelectionStorage;
          }

          function CustomCategoriesTreeComponent({ imodel, viewport, getSchemaContext, selectionStorage }: CustomCategoriesTreeProps) {
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
                  selectionStorage={selectionStorage}
                  imodel={imodel}
                  treeRenderer={(props) => <CustomCategoriesTreeRenderer {...props} {...rendererProps} />}
                />
              </TreeWithHeader>
            );
          }
          // __PUBLISH_EXTRACT_END__

          const result = render(
            <CustomCategoriesTreeComponent
              imodel={imodelConnection}
              viewport={testViewport}
              getSchemaContext={getSchemaContext}
              selectionStorage={unifiedSelectionStorage}
            />,
          );
          await waitFor(() => expect(result.getByText("Test SpatialCategory")).to.not.be.null, { timeout: 5000 });
        });
      });
    });
  });
});

import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { render, waitFor } from "@testing-library/react";
import { getSchemaContext, getTestViewer, TestUtils } from "../../utils/TestUtils";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import type { InstanceKey } from "@itwin/presentation-common";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";

// __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Typical-example-imports
import { ModelsTreeComponent, TreeWithHeader, useModelsTree, useModelsTreeButtonProps, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import type { SelectionStorage } from "@itwin/unified-selection";
import { createStorage } from "@itwin/unified-selection";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory, insertSubject } from "../../utils/IModelUtils";
import { IModel, IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";

import { join } from "path";
import { expect } from "chai";
import type { SchemaContext } from "@itwin/ecschema-metadata";
import type { ComponentPropsWithoutRef } from "react";
import { useCallback } from "react";

// __PUBLISH_EXTRACT_END__
describe("Tree-widget", () => {
  describe("Learning-snippets", () => {
    describe("Components", () => {
      describe("Models tree", () => {
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

        it("Models tree learning snippet", async function () {
          const imodel = (
            await buildIModel(this, async (builder) => {
              const model = insertPhysicalModelWithPartition({ builder, codeValue: "model", partitionParentId: IModel.rootSubjectId });
              const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ builder, userLabel: `element`, modelId: model.id, categoryId: category.id });
              return { model, category };
            })
          ).imodel;
          const testViewport = getTestViewer(imodel);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel);

          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Models-tree-example
          function MyWidget() {
            return (
              <ModelsTreeComponent
                // see "Creating schema context" section for example implementation
                getSchemaContext={getSchemaContext}
                // see "Creating unified selection storage" section for example implementation
                selectionStorage={unifiedSelectionStorage}
                headerButtons={[
                  (props) => <ModelsTreeComponent.ShowAllButton {...props} key={"ShowAllButton"} />,
                  (props) => <ModelsTreeComponent.HideAllButton {...props} key={"HideAllButton"} />,
                ]}
                selectionMode={"extended"}
                hierarchyConfig={{
                  elementClassGrouping: "enable",
                }}
              />
            );
          }
          // __PUBLISH_EXTRACT_END__

          const result = render(<MyWidget />);

          await waitFor(() => expect(result.getByText("tree-widget-learning-snippets-components-models-tree")).to.not.be.null);

          // const result = render(MyWidget());
        });

        it("Custom models tree", async function () {
          const testImodel = (
            await buildIModel(this, async (builder) => {
              const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });
              const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
              const childSubject = insertSubject({
                builder,
                codeValue: "test subject",
                parentId: rootSubject.id,
              });
              return { model, childSubject };
            })
          ).imodel;
          const testViewport = getTestViewer(testImodel);
          const unifiedSelectionStorage = createStorage();
          const getSublabel = () => <>Sub label</>;
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(testImodel);

          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Custom-models-tree-example
          type VisibilityTreeRendererProps = ComponentPropsWithoutRef<typeof VisibilityTreeRenderer>;
          type CustomModelsTreeRendererProps = Parameters<ComponentPropsWithoutRef<typeof VisibilityTree>["treeRenderer"]>[0];
          function CustomModelsTreeRenderer(props: CustomModelsTreeRendererProps) {
            const getLabel = props.getLabel;
            const getLabelCallback = useCallback<Required<VisibilityTreeRendererProps>["getLabel"]>(
              (node: any) => {
                const originalLabel = getLabel(node);
                return <>Custom node - {originalLabel}</>;
              },
              [getLabel],
            );
            return <VisibilityTreeRenderer {...props} getLabel={getLabelCallback} getSublabel={getSublabel} />;
          }

          interface CustomModelsTreeProps {
            imodel: IModelConnection;
            viewport: Viewport;
            getSchema: (imodel: IModelConnection) => SchemaContext;
            selectionStorage: SelectionStorage;
          }

          function CustomModelsTreeComponent({ imodel, viewport, getSchema, selectionStorage }: CustomModelsTreeProps) {
            const buttonProps = useModelsTreeButtonProps({ imodel, viewport });
            const { modelsTreeProps, rendererProps } = useModelsTree({ activeView: viewport });

            return (
              <TreeWithHeader
                buttons={[
                  <ModelsTreeComponent.ShowAllButton {...buttonProps} key={"ShowAllButton"} />,
                  <ModelsTreeComponent.HideAllButton {...buttonProps} key={"HideAllButton"} />,
                ]}
              >
                <VisibilityTree
                  {...modelsTreeProps}
                  getSchemaContext={getSchema}
                  selectionStorage={selectionStorage}
                  imodel={imodel}
                  treeRenderer={(props) => <CustomModelsTreeRenderer {...props} {...rendererProps} />}
                />
              </TreeWithHeader>
            );
          }
          // __PUBLISH_EXTRACT_END__

          const { getByText } = render(
            <CustomModelsTreeComponent imodel={testImodel} viewport={testViewport} getSchema={getSchemaContext} selectionStorage={unifiedSelectionStorage} />,
          );

          await waitFor(() => {
            expect(getByText("tree-widget-learning-snippets-components-models-tree-custom-models-tree")).to.not.be.null;
            expect(getByText("Sub label")).to.not.be.null;
          });
        });
      });
    });
  });
});

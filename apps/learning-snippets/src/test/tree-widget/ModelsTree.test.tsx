/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
import { join } from "path";
import { useCallback } from "react";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { IModel, IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import {
  HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
// __PUBLISH_EXTRACT_START__ Presentation.TreeWidget.ModelsTreeExampleImports
import { ModelsTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ Presentation.TreeWidget.CustomModelsTreeExampleImports
import {
 TreeWithHeader, useModelsTree, useModelsTreeButtonProps, VisibilityTree, VisibilityTreeRenderer,
} from "@itwin/tree-widget-react";
import type { SelectionStorage } from "@itwin/unified-selection";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { SchemaContext } from "@itwin/ecschema-metadata";
import type { ComponentPropsWithoutRef } from "react";
// __PUBLISH_EXTRACT_END__
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory, insertSubject } from "../../utils/IModelUtils";
import { getSchemaContext as getTestSchemaContext, getTestViewer, mockGetBoundingClientRect, TestUtils } from "../../utils/TestUtils";

import type { InstanceKey } from "@itwin/presentation-common";

describe("Tree widget", () => {
  describe("Learning snippets", () => {
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

        it("Renders <ModelsTreeComponent />", async function () {
          const imodel = (
            await buildIModel(this, async (builder) => {
              const model = insertPhysicalModelWithPartition({ builder, codeValue: "model", partitionParentId: IModel.rootSubjectId });
              const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ builder, userLabel: `element`, modelId: model.id, categoryId: category.id });
              return { model };
            })
          ).imodel;
          const testViewport = getTestViewer(imodel, true);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel);
          mockGetBoundingClientRect();
          const getSchemaContext = getTestSchemaContext;

          // __PUBLISH_EXTRACT_START__ Presentation.TreeWidget.ModelsTreeExample
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
              />
            );
          }
          // __PUBLISH_EXTRACT_END__
          const { getByText } = render(<MyWidget />);

          // eslint-disable-next-line no-console
          await waitFor(async () => getByText("tree-widget-learning-snippets-components-models-tree-renders-modelstreecomponent-"));
          cleanup();
        });

        it("Renders custom models tree", async function () {
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
          const testViewport = getTestViewer(testImodel, true);
          const unifiedSelectionStorage = createStorage();
          const getSublabel = () => <>Sub label</>;
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(testImodel);
          mockGetBoundingClientRect();

          // __PUBLISH_EXTRACT_START__ Presentation.TreeWidget.CustomModelsTreeExample
          type VisibilityTreeRendererProps = ComponentPropsWithoutRef<typeof VisibilityTreeRenderer>;
          type CustomModelsTreeRendererProps = Parameters<ComponentPropsWithoutRef<typeof VisibilityTree>["treeRenderer"]>[0];
          function CustomModelsTreeRenderer(props: CustomModelsTreeRendererProps) {
            const getLabel = props.getLabel;
            const getLabelCallback = useCallback<Required<VisibilityTreeRendererProps>["getLabel"]>(
              (node) => {
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
            getSchemaContext: (imodel: IModelConnection) => SchemaContext;
            selectionStorage: SelectionStorage;
          }

          function CustomModelsTreeComponent({ imodel, viewport, getSchemaContext, selectionStorage }: CustomModelsTreeProps) {
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
                  getSchemaContext={getSchemaContext}
                  selectionStorage={selectionStorage}
                  imodel={imodel}
                  treeRenderer={(props) => <CustomModelsTreeRenderer {...props} {...rendererProps} />}
                />
              </TreeWithHeader>
            );
          }
          // __PUBLISH_EXTRACT_END__
          const { getByText } = render(
            <CustomModelsTreeComponent imodel={testImodel} viewport={testViewport} getSchemaContext={getTestSchemaContext} selectionStorage={unifiedSelectionStorage} />,
          );

          await waitFor(() => {
            getByText("tree-widget-learning-snippets-components-models-tree-renders-custom-models-tree");
            getByText("Sub label");
          });
          cleanup();
        });
      });
    });
  });
});

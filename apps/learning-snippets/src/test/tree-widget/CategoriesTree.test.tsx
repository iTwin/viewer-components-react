/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-shadow */

import { useCallback } from "react";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ TreeWidget.CategoriesTreeExampleImports
import { CategoriesTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ TreeWidget.CustomCategoriesTreeExampleImports
import { TreeWithHeader, useCategoriesTree, useCategoriesTreeButtonProps, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { SelectionStorage } from "@itwin/unified-selection";
import type { SchemaContext } from "@itwin/ecschema-metadata";
import type { ComponentPropsWithoutRef } from "react";
// __PUBLISH_EXTRACT_END__
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { getSchemaContext, getTestViewer, mockGetBoundingClientRect, TreeWidgetTestUtils } from "../../utils/TreeWidgetTestUtils.js";

describe("Tree widget", () => {
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("Categories tree", () => {
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

        it("renders <CategoriesTreeComponent />", async function () {
          const { imodel } = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            return { category };
          });
          const testViewport = getTestViewer(imodel);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel);
          mockGetBoundingClientRect();

          // __PUBLISH_EXTRACT_START__ TreeWidget.CategoriesTreeExample
          function MyWidget() {
            return (
              <CategoriesTreeComponent
                // see "Creating schema context" section for example implementation
                getSchemaContext={getSchemaContext}
                // see "Creating unified selection storage" section for example implementation
                selectionStorage={unifiedSelectionStorage}
                headerButtons={[
                  (props) => <CategoriesTreeComponent.ShowAllButton {...props} />,
                  (props) => <CategoriesTreeComponent.HideAllButton {...props} />,
                ]}
              />
            );
          }
          // __PUBLISH_EXTRACT_END__

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText } = render(<MyWidget />);
          await waitFor(() => getByText("Test SpatialCategory"));
        });

        it("renders custom categories tree", async function () {
          const { imodel } = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            return { category };
          });
          const testViewport = getTestViewer(imodel);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel);
          mockGetBoundingClientRect();

          // __PUBLISH_EXTRACT_START__ TreeWidget.CustomCategoriesTreeExample
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
            const { buttonProps } = useCategoriesTreeButtonProps({ viewport });
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

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText } = render(
            <CustomCategoriesTreeComponent
              imodel={imodel}
              viewport={testViewport}
              getSchemaContext={getSchemaContext}
              selectionStorage={unifiedSelectionStorage}
            />,
          );
          await waitFor(() => {
            getByText("Test SpatialCategory");
            getByText("Custom sub label");
          });
        });
      });
    });
  });
});

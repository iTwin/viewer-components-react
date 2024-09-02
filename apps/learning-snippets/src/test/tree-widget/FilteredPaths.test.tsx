/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-shadow */
import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import {
  HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { useModelsTree, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils";
import { getSchemaContext, getTestViewer, mockGetBoundingClientRect, TestUtils } from "../../utils/TestUtils";

import type { SelectionStorage } from "@itwin/unified-selection";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";

// __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Get-filtered-paths-component-example
type useModelsTreeProps = Parameters<typeof useModelsTree>[0];

interface CustomCategoriesTreeProps {
  getFilteredPaths: useModelsTreeProps["getFilteredPaths"];
  viewport: Viewport;
  selectionStorage: SelectionStorage;
  imodel: IModelConnection;
}

function CustomModelsTreeComponent({ getFilteredPaths, viewport, selectionStorage, imodel }: CustomCategoriesTreeProps) {
  const { modelsTreeProps, rendererProps } = useModelsTree({ activeView: viewport, getFilteredPaths });

  return (
    <VisibilityTree
      {...modelsTreeProps}
      getSchemaContext={getSchemaContext}
      selectionStorage={selectionStorage}
      imodel={imodel}
      treeRenderer={(props) => <VisibilityTreeRenderer {...props} {...rendererProps} />}
    />
  );
}
// __PUBLISH_EXTRACT_END__

describe("Tree-widget", () => {
  describe("Learning-snippets", () => {
    describe("Components", () => {
      describe("Filtered paths", () => {
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
          cleanup();
        });

        it("Filtered paths snippet", async function () {
          const imodel = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const physicalModel2 = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel 2" });
            const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const category2 = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory 2" });
            insertPhysicalElement({ builder, modelId: physicalModel2.id, categoryId: category2.id });
            return { physicalModel, physicalModel2 };
          });
          const testViewport = getTestViewer(imodel.imodel);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel.imodel);
          mockGetBoundingClientRect();

          const { getByText, queryByText } = render(
            // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Get-filtered-paths-example
            <CustomModelsTreeComponent
              selectionStorage={unifiedSelectionStorage}
              imodel={imodel.imodel}
              viewport={testViewport}
              getFilteredPaths={async ({ createInstanceKeyPaths }) => {
                return createInstanceKeyPaths({
                  // list of instance keys representing nodes that should be displayed in the hierarchy
                  targetItems: [imodel.physicalModel],
                });
              }}
            />,
            // __PUBLISH_EXTRACT_END__
          );

          await waitFor(() => {
            getByText("TestPhysicalModel");
            expect(queryByText("TestPhysicalModel 2")).to.be.null;
          });
        });

        it("Custom Filtered paths snippet", async function () {
          const imodel = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const physicalModel2 = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel 2" });
            const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const category2 = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory 2" });
            insertPhysicalElement({ builder, modelId: physicalModel2.id, categoryId: category2.id });
            return { physicalModel, physicalModel2 };
          });
          const testViewport = getTestViewer(imodel.imodel);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel.imodel);
          mockGetBoundingClientRect();

          const { getByText, queryByText } = render(
            // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Get-filtered-paths-with-options-example
            <CustomModelsTreeComponent
              selectionStorage={unifiedSelectionStorage}
              imodel={imodel.imodel}
              viewport={testViewport}
              getFilteredPaths={async ({ createInstanceKeyPaths }) => {
                const paths = await createInstanceKeyPaths({ targetItems: [imodel.physicalModel] });
                const finalPaths =  paths?.map((path) => ({ path: Array.isArray(path) ? path : path.path, options: { autoExpand: false } }));
                // eslint-disable-next-line no-console
                console.log(finalPaths);
                return finalPaths
                // disable auto-expansion
                return paths?.map((path) => ({ ...path, options: { autoExpand: false } }));
              }}
              // __PUBLISH_EXTRACT_END__
            />,
          );

          await waitFor(() => {
            getByText("TestPhysicalModel");
            expect(queryByText("TestPhysicalModel 2")).to.be.null;
          });
        });
      });
    });
  });
});

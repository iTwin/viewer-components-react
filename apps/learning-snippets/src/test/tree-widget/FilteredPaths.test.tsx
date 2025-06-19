/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-shadow */

import { expect } from "chai";
import { useCallback } from "react";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { QueryRowFormat } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import { useModelsTree, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import { createStorage } from "@itwin/unified-selection";
import { cleanup, render, waitFor } from "@testing-library/react";
import {
  buildIModel,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
} from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { getSchemaContext, getTestViewer, mockGetBoundingClientRect, TreeWidgetTestUtils } from "../../utils/TreeWidgetTestUtils.js";

import type { SelectionStorage } from "@itwin/unified-selection";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";

// __PUBLISH_EXTRACT_START__ TreeWidget.GetFilteredPathsComponentWithTargetItemsExample
type UseModelsTreeProps = Parameters<typeof useModelsTree>[0];
type GetFilteredPathsType = Exclude<UseModelsTreeProps["getFilteredPaths"], undefined>;

function CustomModelsTreeComponentWithTargetItems({
  viewport,
  selectionStorage,
  imodel,
  targetItems,
}: {
  viewport: Viewport;
  selectionStorage: SelectionStorage;
  imodel: IModelConnection;
  targetItems: InstanceKey[];
}) {
  const getFilteredPaths = useCallback<GetFilteredPathsType>(
    async ({ createInstanceKeyPaths }) => {
      return createInstanceKeyPaths({
        // list of instance keys representing nodes that should be displayed in the hierarchy
        targetItems,
      });
    },
    [targetItems],
  );

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

// __PUBLISH_EXTRACT_START__ TreeWidget.GetFilteredPathsComponentWithPostProcessingExample
function CustomModelsTreeComponentWithPostProcessing({
  viewport,
  selectionStorage,
  imodel,
}: {
  viewport: Viewport;
  selectionStorage: SelectionStorage;
  imodel: IModelConnection;
}) {
  const getFilteredPaths = useCallback<GetFilteredPathsType>(async ({ createInstanceKeyPaths, filter }) => {
    const defaultPaths = await createInstanceKeyPaths({ label: filter ?? "test" });
    const result = new Array<HierarchyFilteringPath>();
    for (const path of defaultPaths) {
      const normalizedPath = HierarchyFilteringPath.normalize(path);
      if (normalizedPath.path.length < 5) {
        normalizedPath.options = { autoExpand: true };
        result.push(normalizedPath);
      }
    }
    return result;
  }, []);

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

// __PUBLISH_EXTRACT_START__ TreeWidget.GetFilteredPathsComponentWithFilterAndTargetItemsExample
function CustomModelsTreeComponentWithFilterAndTargetItems({
  viewport,
  selectionStorage,
  imodel,
}: {
  viewport: Viewport;
  selectionStorage: SelectionStorage;
  imodel: IModelConnection;
}) {
  const getFilteredPaths = useCallback<GetFilteredPathsType>(
    async ({ createInstanceKeyPaths, filter }) => {
      const targetItems = new Array<InstanceKey>();
      for await (const row of imodel.createQueryReader(`
          SELECT ec_classname(e.ECClassId, 's.c') className, e.ECInstanceId id
          FROM BisCore.Element e
          WHERE UserLabel LIKE '%${filter ?? ""}%'
        `,
        undefined,
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      )) {
        targetItems.push({ id: row.id, className: row.className });
      }
      return createInstanceKeyPaths({ targetItems });
    },
    [imodel],
  );

  const { modelsTreeProps, rendererProps } = useModelsTree({ activeView: viewport, getFilteredPaths, filter: "test" });

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

describe("Tree widget", () => {
  mockGetBoundingClientRect();
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("Filtered paths", () => {
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

        it("renders custom models tree component with filtered paths using targetItems", async function () {
          const imodel = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const physicalModel2 = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel 2" });
            const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            const category2 = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory 2" });
            insertPhysicalElement({ builder, modelId: physicalModel2.id, categoryId: category2.id });
            return { physicalModel, physicalModel2 };
          });
          const testViewport = getTestViewer(imodel.imodel, true);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel.imodel);

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText, queryByText } = render(
            <CustomModelsTreeComponentWithTargetItems
              selectionStorage={unifiedSelectionStorage}
              imodel={imodel.imodel}
              viewport={testViewport}
              targetItems={[imodel.physicalModel]}
            />,
          );

          await waitFor(() => {
            getByText("TestPhysicalModel");
            expect(queryByText("TestPhysicalModel 2")).to.be.null;
          });
        });

        it("renders custom models tree component with filtered paths when they are modified", async function () {
          const imodel = await buildIModel(this, async (builder, testSchema) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "PhysicalModel" });
            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id, userLabel: "test element 1" });
            insertPhysicalModelWithPartition({ builder, codeValue: "PhysicalModel2" });
            const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory 2" });
            const element2 = insertPhysicalElement({
              builder,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              userLabel: `element 2`,
              modelId: physicalModel.id,
              categoryId: category2.id,
            });
            const subModel = insertPhysicalSubModel({ builder, modeledElementId: element2.id });
            insertPhysicalElement({ builder, userLabel: `test modeling element`, modelId: subModel.id, categoryId: category.id });
          });
          const testViewport = getTestViewer(imodel.imodel, true);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel.imodel);

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText, queryByText } = render(
            <CustomModelsTreeComponentWithPostProcessing selectionStorage={unifiedSelectionStorage} imodel={imodel.imodel} viewport={testViewport} />,
          );

          await waitFor(() => {
            getByText("PhysicalModel");
            expect(queryByText("PhysicalModel2")).to.be.null;
          });
        });

        it("renders custom models tree component with filtered paths when filtered paths are created using filter", async function () {
          const imodel = await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "PhysicalModel" });
            const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
            const physicalModel2 = insertPhysicalModelWithPartition({ builder, codeValue: "PhysicalModel2" });
            const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id, userLabel: "test element 1" });
            insertPhysicalElement({ builder, modelId: physicalModel2.id, categoryId: category2.id, userLabel: "element 2" });
            return { physicalModel, category };
          });
          const testViewport = getTestViewer(imodel.imodel, true);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel.imodel);

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText, queryByText } = render(
            <CustomModelsTreeComponentWithFilterAndTargetItems selectionStorage={unifiedSelectionStorage} imodel={imodel.imodel} viewport={testViewport} />,
          );

          await waitFor(() => {
            getByText("PhysicalModel");
            expect(queryByText("PhysicalModel2")).to.be.null;
          });
        });
      });
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { useCallback } from "react";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { IModel, QueryRowFormat } from "@itwin/core-common";
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
  insertSubject,
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
  filter,
}: {
  viewport: Viewport;
  selectionStorage: SelectionStorage;
  imodel: IModelConnection;
  filter: string | undefined;
}) {
  const getFilteredPaths = useCallback<GetFilteredPathsType>(
    async ({ createInstanceKeyPaths, filter: activeFilter }) => {
      if (!activeFilter) {
        // if filter is not defined, return `undefined` to avoid applying empty filter
        return undefined;
      }
      const targetItems = new Array<InstanceKey>();
      for await (const row of imodel.createQueryReader(
        `
          SELECT ClassName, Id
          FROM (
            SELECT
              ec_classname(e.ECClassId, 's.c') ClassName,
              e.ECInstanceId Id,
              COALESCE(e.UserLabel, e.CodeValue) Label
            FROM BisCore.Subject e

            UNION ALL

            SELECT
              ec_classname(m.ECClassId, 's.c') ClassName,
              m.ECInstanceId Id,
              COALESCE(e.UserLabel, e.CodeValue) Label
            FROM BisCore.GeometricModel3d m
            JOIN BisCore.Element e ON e.ECInstanceId = m.ModeledElement.Id
            WHERE NOT m.IsPrivate
              AND EXISTS (SELECT 1 FROM BisCore.Element WHERE Model.Id = m.ECInstanceId)
              AND json_extract(e.JsonProperties, '$.PhysicalPartition.Model.Content') IS NULL
              AND json_extract(e.JsonProperties, '$.GraphicalPartition3d.Model.Content') IS NULL
          )
          WHERE Label LIKE '%${activeFilter.replaceAll(/[%_\\]/g, "\\$&")}%' ESCAPE '\\'
        `,
        undefined,
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      )) {
        targetItems.push({ id: row.Id, className: row.ClassName });
      }
      // `createInstanceKeyPaths` doesn't automatically set the `autoExpand` flag - set it here
      const paths = await createInstanceKeyPaths({ targetItems });
      return paths.map((path) => ({ ...path, options: { autoExpand: true } }));
    },
    [imodel],
  );

  const { modelsTreeProps, rendererProps } = useModelsTree({ activeView: viewport, getFilteredPaths, filter });
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

        it("renders custom models tree component with filtered paths when the paths are created using filter", async function () {
          const { imodel } = await buildIModel(this, async (builder) => {
            const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };

            // category label will match our filter
            const category = insertSpatialCategory({ builder, codeValue: "category match" });

            // will match childSubject1
            const childSubject1 = insertSubject({ builder, codeValue: "subject 1 match", parentId: rootSubject.id });
            const model1 = insertPhysicalModelWithPartition({ builder, codeValue: `model 1`, partitionParentId: childSubject1.id });
            insertPhysicalElement({ builder, userLabel: `element 1 match`, modelId: model1.id, categoryId: category.id });

            // will match model3
            const childSubject2 = insertSubject({ builder, codeValue: "subject 2", parentId: rootSubject.id });
            const childSubject3 = insertSubject({ builder, codeValue: "subject 3", parentId: childSubject2.id });
            const model3 = insertPhysicalModelWithPartition({ builder, codeValue: `model 3 match`, partitionParentId: childSubject3.id });
            insertPhysicalElement({ builder, userLabel: `element 3 match`, modelId: model3.id, categoryId: category.id });

            // will try & fail to match the element
            const childSubject4 = insertSubject({ builder, codeValue: "subject 4", parentId: rootSubject.id });
            const model4 = insertPhysicalModelWithPartition({ builder, codeValue: `model 4`, partitionParentId: childSubject4.id });
            insertPhysicalElement({ builder, userLabel: `element 4 match`, modelId: model4.id, categoryId: category.id });

            return { rootSubject, childSubject1, model1, childSubject3, model3, childSubject4, model4 };
          });

          const testViewport = getTestViewer(imodel, true);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel);

          using _ = { [Symbol.dispose]: cleanup };

          const { getByText, queryByText, rerender } = render(
            <CustomModelsTreeComponentWithFilterAndTargetItems
              selectionStorage={unifiedSelectionStorage}
              imodel={imodel}
              viewport={testViewport}
              filter={undefined}
            />,
          );
          await waitFor(() => {
            getByText("subject 1", { exact: false });
            expect(queryByText("model 1", { exact: false })).to.be.null;
            getByText("subject 2", { exact: false });
            expect(queryByText("subject 3", { exact: false })).to.be.null;
            expect(queryByText("model 3", { exact: false })).to.be.null;
            getByText("subject 4", { exact: false });
            expect(queryByText("model 4", { exact: false })).to.be.null;
            expect(queryByText("category", { exact: false })).to.be.null;
            expect(queryByText("element 1", { exact: false })).to.be.null;
            expect(queryByText("element 3", { exact: false })).to.be.null;
            expect(queryByText("element 4", { exact: false })).to.be.null;
          });

          rerender(
            <CustomModelsTreeComponentWithFilterAndTargetItems
              selectionStorage={unifiedSelectionStorage}
              imodel={imodel}
              viewport={testViewport}
              filter="match"
            />,
          );
          await waitFor(() => {
            getByText("subject 1", { exact: false });
            getByText("subject 2", { exact: false });
            getByText("subject 3", { exact: false });
            getByText("model 3", { exact: false });
            expect(queryByText("category", { exact: false })).to.be.null;
            expect(queryByText("element 1", { exact: false })).to.be.null;
            expect(queryByText("element 3", { exact: false })).to.be.null;
            expect(queryByText("element 4", { exact: false })).to.be.null;
          });
        });
      });
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { useCallback, useMemo } from "react";
import { UiFramework } from "@itwin/appui-react";
import { IModel, QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { createTreeWidgetViewport, TreeWidgetContextProvider, useModelsTree, VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import { createStorage } from "@itwin/unified-selection";
import { insertPhysicalElement, insertPhysicalModelWithPartition, insertPhysicalSubModel, insertSpatialCategory, insertSubject } from "test-utilities";
import { buildIModel } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { cleanup, getTestViewer, mockGetBoundingClientRect, render, TreeWidgetTestUtils, waitFor } from "./TestUtils.js";

import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { SelectionStorage } from "@itwin/unified-selection";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-shared";
import { withEditTxn } from "@itwin/core-backend";

// __PUBLISH_EXTRACT_START__ TreeWidget.GetFilteredPathsComponentWithTargetItemsExample
type UseModelsTreeProps = Parameters<typeof useModelsTree>[0];
type GetSearchPathsType = Exclude<UseModelsTreeProps["getSearchPaths"], undefined>;

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
  const getSearchPaths = useCallback<GetSearchPathsType>(
    async ({ createInstanceKeyPaths }) => {
      return createInstanceKeyPaths({
        // list of instance keys representing nodes that should be displayed in the hierarchy
        targetItems,
      });
    },
    [targetItems],
  );

  const activeView = useMemo(() => createTreeWidgetViewport(viewport), [viewport]);
  const { treeProps, getTreeItemProps } = useModelsTree({ activeView, getSearchPaths });

  return (
    <VisibilityTree
      {...treeProps}
      selectionStorage={selectionStorage}
      imodel={imodel}
      treeRenderer={(rendererProps) => (
        <VisibilityTreeRenderer {...rendererProps} treeLabel="Custom models tree" getTreeItemProps={(node) => getTreeItemProps(node, rendererProps)} />
      )}
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
  const getSearchPaths = useCallback<GetSearchPathsType>(async ({ createInstanceKeyPaths, searchText }) => {
    const searchTree = await createInstanceKeyPaths({ label: searchText ?? "test" });
    // post-process the search tree - e.g. limit displayed depth and auto-expand the remaining nodes
    const limitDepthAndAutoExpand = (entries: HierarchySearchTree[], depth: number): HierarchySearchTree[] => {
      if (depth >= 5) {
        return [];
      }
      const result = new Array<HierarchySearchTree>();
      for (const entry of entries) {
        const children = entry.children ? limitDepthAndAutoExpand(entry.children, depth + 1) : undefined;
        result.push({ ...entry, options: { autoExpand: true }, children });
      }
      return result;
    };
    return limitDepthAndAutoExpand(searchTree, 1);
  }, []);

  const activeView = useMemo(() => createTreeWidgetViewport(viewport), [viewport]);
  const { treeProps, getTreeItemProps } = useModelsTree({ activeView, getSearchPaths });

  return (
    <VisibilityTree
      {...treeProps}
      selectionStorage={selectionStorage}
      imodel={imodel}
      treeRenderer={(rendererProps) => (
        <VisibilityTreeRenderer {...rendererProps} treeLabel="Custom models tree" getTreeItemProps={(node) => getTreeItemProps(node, rendererProps)} />
      )}
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
  const getSearchPaths = useCallback<GetSearchPathsType>(
    async ({ createInstanceKeyPaths, searchText }) => {
      if (!searchText) {
        // if search text is not defined, return `undefined` to avoid applying empty filter
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
          WHERE Label LIKE '%' || ? || '%' ESCAPE '\\'
        `,
        QueryBinder.from([searchText]),
        { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes },
      )) {
        targetItems.push({ id: row[1], className: row[0] });
      }
      // `createInstanceKeyPaths` doesn't automatically set the `autoExpand` flag - set it here
      const searchTree = await createInstanceKeyPaths({ targetItems });
      return searchTree.map((entry) => ({ ...entry, options: { autoExpand: true } }));
    },
    [imodel],
  );

  const activeView = useMemo(() => createTreeWidgetViewport(viewport), [viewport]);
  const { treeProps, getTreeItemProps } = useModelsTree({ activeView, getSearchPaths, searchText: filter });
  return (
    <VisibilityTree
      {...treeProps}
      selectionStorage={selectionStorage}
      imodel={imodel}
      treeRenderer={(rendererProps) => (
        <VisibilityTreeRenderer {...rendererProps} treeLabel="Custom models tree" getTreeItemProps={(node) => getTreeItemProps(node, rendererProps)} />
      )}
    />
  );
}
// __PUBLISH_EXTRACT_END__

describe("Tree widget", () => {
  mockGetBoundingClientRect();
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("Search paths", () => {
        beforeAll(async () => {
          await initializeLearningSnippetsTests();
          await TreeWidgetTestUtils.initialize();
        });

        afterAll(async () => {
          await terminateLearningSnippetsTests();
          TreeWidgetTestUtils.terminate();
        });

        it("renders custom models tree component with search paths using targetItems", async () => {
          const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
              const physicalModel2 = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel 2" });
              const category = insertSpatialCategory({ txn, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });
              const category2 = insertSpatialCategory({ txn, codeValue: "Test SpatialCategory 2" });
              insertPhysicalElement({ txn, modelId: physicalModel2.id, categoryId: category2.id });
              return { physicalModel, physicalModel2 };
            }),
          );
          const testViewport = getTestViewer(imodelConnection, true);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText, queryByText } = render(
            <TreeWidgetContextProvider localization={IModelApp.localization}>
              <CustomModelsTreeComponentWithTargetItems
                selectionStorage={unifiedSelectionStorage}
                imodel={imodelConnection}
                viewport={testViewport}
                targetItems={[keys.physicalModel]}
              />
            </TreeWidgetContextProvider>,
          );

          await waitFor(() => {
            getByText("TestPhysicalModel");
            expect(queryByText("TestPhysicalModel 2")).toBeNull();
          });
        });

        it("renders custom models tree component with filtered paths when they are modified", async () => {
          const { imodelConnection } = await buildIModel(async (imodel, testSchema) =>
            withEditTxn(imodel, (txn) => {
              const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "PhysicalModel" });
              const category = insertSpatialCategory({ txn, codeValue: "SpatialCategory" });
              insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id, userLabel: "test element 1" });
              insertPhysicalModelWithPartition({ txn, codeValue: "PhysicalModel2" });
              const category2 = insertSpatialCategory({ txn, codeValue: "SpatialCategory 2" });
              const element2 = insertPhysicalElement({
                txn,
                classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
                userLabel: `element 2`,
                modelId: physicalModel.id,
                categoryId: category2.id,
              });
              const subModel = insertPhysicalSubModel({ txn, modeledElementId: element2.id });
              insertPhysicalElement({ txn, userLabel: `test modeling element`, modelId: subModel.id, categoryId: category.id });
            }),
          );
          const testViewport = getTestViewer(imodelConnection, true);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

          using _ = { [Symbol.dispose]: cleanup };
          const { getByText, queryByText } = render(
            <TreeWidgetContextProvider localization={IModelApp.localization}>
              <CustomModelsTreeComponentWithPostProcessing selectionStorage={unifiedSelectionStorage} imodel={imodelConnection} viewport={testViewport} />
            </TreeWidgetContextProvider>,
          );

          await waitFor(() => {
            getByText("PhysicalModel");
            expect(queryByText("PhysicalModel2")).toBeNull();
          });
        });

        it("renders custom models tree component with filtered paths when the paths are created using filter", async () => {
          const { imodelConnection } = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };

              // category label will match our filter
              const category = insertSpatialCategory({ txn, codeValue: "category match" });

              // will match childSubject1
              const childSubject1 = insertSubject({ txn, codeValue: "subject 1 match", parentId: rootSubject.id });
              const model1 = insertPhysicalModelWithPartition({ txn, codeValue: `model 1`, partitionParentId: childSubject1.id });
              insertPhysicalElement({ txn, userLabel: `element 1 match`, modelId: model1.id, categoryId: category.id });

              // will match model3
              const childSubject2 = insertSubject({ txn, codeValue: "subject 2", parentId: rootSubject.id });
              const childSubject3 = insertSubject({ txn, codeValue: "subject 3", parentId: childSubject2.id });
              const model3 = insertPhysicalModelWithPartition({ txn, codeValue: `model 3 match`, partitionParentId: childSubject3.id });
              insertPhysicalElement({ txn, userLabel: `element 3 match`, modelId: model3.id, categoryId: category.id });

              // will try & fail to match the element
              const childSubject4 = insertSubject({ txn, codeValue: "subject 4", parentId: rootSubject.id });
              const model4 = insertPhysicalModelWithPartition({ txn, codeValue: `model 4`, partitionParentId: childSubject4.id });
              insertPhysicalElement({ txn, userLabel: `element 4 match`, modelId: model4.id, categoryId: category.id });

              return { rootSubject, childSubject1, model1, childSubject3, model3, childSubject4, model4 };
            }),
          );

          const testViewport = getTestViewer(imodelConnection, true);
          const unifiedSelectionStorage = createStorage();
          vi.spyOn(IModelApp.viewManager, "selectedView", "get").mockReturnValue(testViewport);
          vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodelConnection);

          using _ = { [Symbol.dispose]: cleanup };

          const { getByText, queryByText, rerender } = render(
            <TreeWidgetContextProvider localization={IModelApp.localization}>
              <CustomModelsTreeComponentWithFilterAndTargetItems
                selectionStorage={unifiedSelectionStorage}
                imodel={imodelConnection}
                viewport={testViewport}
                filter={undefined}
              />
            </TreeWidgetContextProvider>,
          );
          await waitFor(() => {
            getByText("subject 1", { exact: false });
            expect(queryByText("model 1", { exact: false })).toBeNull();
            getByText("subject 2", { exact: false });
            expect(queryByText("subject 3", { exact: false })).toBeNull();
            expect(queryByText("model 3", { exact: false })).toBeNull();
            getByText("subject 4", { exact: false });
            expect(queryByText("model 4", { exact: false })).toBeNull();
            expect(queryByText("category", { exact: false })).toBeNull();
            expect(queryByText("element 1", { exact: false })).toBeNull();
            expect(queryByText("element 3", { exact: false })).toBeNull();
            expect(queryByText("element 4", { exact: false })).toBeNull();
          });

          rerender(
            <TreeWidgetContextProvider localization={IModelApp.localization}>
              <CustomModelsTreeComponentWithFilterAndTargetItems
                selectionStorage={unifiedSelectionStorage}
                imodel={imodelConnection}
                viewport={testViewport}
                filter="match"
              />
            </TreeWidgetContextProvider>,
          );
          await waitFor(() => {
            getByText("subject 1", { exact: false });
            getByText("subject 2", { exact: false });
            getByText("subject 3", { exact: false });
            getByText("model 3", { exact: false });
            expect(queryByText("category", { exact: false })).toBeNull();
            expect(queryByText("element 1", { exact: false })).toBeNull();
            expect(queryByText("element 3", { exact: false })).toBeNull();
            expect(queryByText("element 4", { exact: false })).toBeNull();
          });
        });
      });
    });
  });
});

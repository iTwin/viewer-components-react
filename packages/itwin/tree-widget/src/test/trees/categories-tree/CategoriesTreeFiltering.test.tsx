/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { act, renderHook } from "@testing-library/react";
import { defaultHierarchyConfiguration } from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import { useCategoriesTree } from "../../../tree-widget-react/components/trees/categories-tree/UseCategoriesTree.js";
import { SharedTreeContextProvider } from "../../../tree-widget-react/components/trees/common/SharedTreeContextProvider.js";
import {
  buildIModel,
  insertDefinitionContainer,
  insertDrawingCategory,
  insertDrawingGraphic,
  insertDrawingModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubCategory,
  insertSubModel,
} from "../../IModelUtils.js";
import { createFakeSinonViewport, createIModelAccess } from "../Common.js";
import { CLASS_NAME_DefinitionModel } from "../TreeUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { Props } from "@itwin/presentation-shared";

// cspell:words egory
// cspell complains about Cat_egory and Cat%egory

describe("Categories tree", () => {
  describe("Hierarchy search", () => {
    before(async function () {
      await initializePresentationTesting({
        backendProps: {
          caching: {
            hierarchies: {
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async function () {
      await terminatePresentationTesting();
    });

    it("finds definition container by label", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer", userLabel: "Test" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        { identifier: keys.definitionContainer, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);
    });

    it("aborts when abort signal fires", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer", userLabel: "Test" });
        const definitionModel = insertSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        return { definitionContainer };
      });
      const { imodel, ...ids } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);

      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });

      const abortController1 = new AbortController();
      const pathsPromiseAborted = act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: abortController1.signal }));
      abortController1.abort();
      expect(await pathsPromiseAborted).to.deep.eq([]);

      const abortController2 = new AbortController();
      const pathsPromise = act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: abortController2.signal }));
      expect(await pathsPromise).to.deep.eq([
        {
          identifier: { className: "BisCore.DefinitionContainer", id: ids.definitionContainer.id },
          options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
        },
      ]);
    });

    it("finds definition container by label when it is contained by another definition container", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const definitionContainerChild = insertDefinitionContainer({
          builder,
          codeValue: "DefinitionContainerChild",
          userLabel: "Test",
          modelId: definitionModel.id,
        });
        const definitionModelChild = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, definitionContainerChild };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        {
          identifier: keys.definitionContainer,
          options: { autoExpand: true },
          children: [{ identifier: keys.definitionContainerChild, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);
    });

    it("does not find definition container by label when it doesn't contain categories", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer", userLabel: "Test" });
        insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
      });
      const { imodel } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([]);
    });

    it("finds category by label when it is contained by definition container", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", userLabel: "Test", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { definitionContainer, category };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        {
          identifier: keys.definitionContainer,
          options: { autoExpand: true },
          children: [{ identifier: keys.category, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);
    });

    it("finds subCategory by label when its parent category is contained by definition container", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainer" });
        const definitionModel = insertSubModel({ builder, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", modelId: definitionModel.id });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
        const subCategory1 = insertSubCategory({ builder, codeValue: "SubCategory1", parentCategoryId: category.id, modelId: definitionModel.id });

        return { definitionContainer, category, subCategory1 };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "SubCategory1",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        {
          identifier: keys.definitionContainer,
          options: { autoExpand: true },
          children: [
            {
              identifier: keys.category,
              options: { autoExpand: true },
              children: [{ identifier: keys.subCategory1, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
            },
          ],
        },
      ]);
    });

    it("finds 3d categories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category1 = insertSpatialCategory({ builder, codeValue: "Test SpatialCat_egory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category1.id });

        const category2 = insertSpatialCategory({ builder, codeValue: "Test SpatialCat%egory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id });

        return { category1, category2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "_",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        { identifier: keys.category1, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);

      hook.rerender({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "%",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        { identifier: keys.category2, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);
    });

    it("finds 3d subcategories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "SubCat_egory1" });
        const subCategory2 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "SubCat%egory2" });

        return { category, subCategory1, subCategory2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "_",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory1, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);

      hook.rerender({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "%",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory2, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);
    });

    it("finds 3d categories by label when subCategory count is 1 and labels of category and subCategory differ", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        // SubCategory gets inserted by default
        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", userLabel: "Test" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        return { category };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });

      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        { identifier: keys.category, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);

      hook.rerender({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "SpatialCategory",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([]);
    });

    it("finds 3d categories and subCategories by label when subCategory count is > 1", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });

        const category = insertSpatialCategory({ builder, codeValue: "SpatialCategory", userLabel: "Test" });
        insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ builder, codeValue: "SubCategory1", parentCategoryId: category.id });

        const subCategory2 = insertSubCategory({ builder, codeValue: "SubCategory2", parentCategoryId: category.id });

        return { category, subCategory1, subCategory2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });

      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        { identifier: keys.category, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);

      hook.rerender({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "SubCategory1",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory1, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);

      hook.rerender({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "SubCategory2",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory2, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);
    });

    it("finds 2d categories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "TestDrawingModel" });

        const category1 = insertDrawingCategory({ builder, codeValue: "Test Drawing Cat_egory" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category1.id });

        const category2 = insertDrawingCategory({ builder, codeValue: "Test Drawing Cat%egory" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category2.id });

        return { category1, category2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "_",
        viewType: "2d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        { identifier: keys.category1, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);

      hook.rerender({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "%",
        viewType: "2d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        { identifier: keys.category2, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);
    });

    it("finds 2d subcategories by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "TestDrawingModel" });

        const category = insertDrawingCategory({ builder, codeValue: "Test Drawing Category" });
        insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: category.id });

        const subCategory1 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test Drawing SubCat_egory" });
        const subCategory2 = insertSubCategory({ builder, parentCategoryId: category.id, codeValue: "Test Drawing SubCat%egory" });

        return { category, subCategory1, subCategory2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using hook = renderUseCategoriesTreeHook({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "_",
        viewType: "2d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory1, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);

      hook.rerender({
        imodel,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "%",
        viewType: "2d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).to.deep.eq([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory2, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);
    });
  });
});

function renderUseCategoriesTreeHook(props: Omit<Props<typeof useCategoriesTree>, "activeView"> & { imodel: IModelConnection; viewType: "2d" | "3d" }) {
  const result = renderHook(
    (hookProps) => useCategoriesTree({ activeView: createFakeSinonViewport({ iModel: props.imodel, viewType: props.viewType }), ...hookProps }),
    {
      initialProps: props,
      wrapper: ({ children }) => <SharedTreeContextProvider>{children}</SharedTreeContextProvider>,
    },
  );
  return { ...result, [Symbol.dispose]: () => result.unmount() };
}

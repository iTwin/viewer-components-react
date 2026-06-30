/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  HierarchyCacheMode,
  initializeCore,
  insertDefinitionContainer,
  insertDrawingCategory,
  insertDrawingGraphic,
  insertDrawingModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubCategory,
  insertSubModel,
  terminateCore,
} from "test-utilities";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { Id64 } from "@itwin/core-bentley";
import { IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { act, renderHook } from "@testing-library/react";
import { defaultHierarchyConfiguration } from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
import { useCategoriesTree } from "../../../tree-widget-react/components/trees/categories-tree/UseCategoriesTree.js";
import {
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
} from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { getClassesByView } from "../../../tree-widget-react/components/trees/common/internal/Utils.js";
import { SharedTreeContextProvider } from "../../../tree-widget-react/components/trees/common/SharedTreeContextProvider.js";
import { buildIModel } from "../../IModelUtils.js";
import { createFakeViewport, createIModelAccess } from "../Common.js";
import { CLASS_NAME_DefinitionModel } from "../TreeUtils.js";
import { getInsertFunctionByViewType } from "./internal/Utils.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { EC, Props } from "@itwin/presentation-shared";
import type { CategoryInfo } from "../../../tree-widget-react/components/trees/common/CategoriesVisibilityUtils.js";

// cspell:words egory
// cspell complains about Cat_egory and Cat%egory

describe("Categories tree", () => {
  describe("Hierarchy search", () => {
    beforeAll(async () => {
      await initializeCore({
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

    afterAll(async () => {
      await terminateCore();
    });

    it("finds definition container by label", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "DefinitionContainer", userLabel: "Test" });
          const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ txn, codeValue: "SpatialCategory", modelId: definitionModel.id });
          insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });

          return { definitionContainer };
        }),
      );
      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        { identifier: keys.definitionContainer, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);
    });

    it("does not return definition container with only empty categories when `showEmptyCategories` is false", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "DefinitionContainer", userLabel: "Test" });
          const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
          insertSpatialCategory({ txn, codeValue: "SpatialCategory", modelId: definitionModel.id });
          return { definitionContainer };
        }),
      );
      const { imodelConnection } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([]);
    });

    it("returns definition container with only empty categories when `showEmptyCategories` is true", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "DefinitionContainer", userLabel: "Test" });
          const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
          insertSpatialCategory({ txn, codeValue: "SpatialCategory", modelId: definitionModel.id });
          return { definitionContainer };
        }),
      );
      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: { ...defaultHierarchyConfiguration, showEmptyCategories: true },
        searchText: "Test",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        { identifier: keys.definitionContainer, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);
    });

    it("aborts when abort signal fires", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "DefinitionContainer", userLabel: "Test" });
          const definitionModel = insertSubModel({ txn, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ txn, codeValue: "SpatialCategory", modelId: definitionModel.id });
          insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });
          return { definitionContainer };
        }),
      );
      const { imodelConnection, ...ids } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);

      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });

      const abortController1 = new AbortController();
      const pathsPromiseAborted = act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: abortController1.signal }));
      abortController1.abort();
      expect(await pathsPromiseAborted).toEqual([]);

      const abortController2 = new AbortController();
      const pathsPromise = act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: abortController2.signal }));
      expect(await pathsPromise).toEqual([
        {
          identifier: { className: "BisCore.DefinitionContainer", id: ids.definitionContainer.id },
          options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
        },
      ]);
    });

    it("finds definition container by label when it is contained by another definition container", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "DefinitionContainer" });
          const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
          const definitionContainerChild = insertDefinitionContainer({
            txn,
            codeValue: "DefinitionContainerChild",
            userLabel: "Test",
            modelId: definitionModel.id,
          });
          const definitionModelChild = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainerChild.id });
          const category = insertSpatialCategory({ txn, codeValue: "SpatialCategory", modelId: definitionModelChild.id });
          insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });

          return { definitionContainer, definitionContainerChild };
        }),
      );
      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        {
          identifier: keys.definitionContainer,
          options: { autoExpand: true },
          children: [{ identifier: keys.definitionContainerChild, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);
    });

    it("does not find definition container by label when it doesn't contain categories", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "DefinitionContainer", userLabel: "Test" });
          insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ txn, codeValue: "SpatialCategory" });
          insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });
        }),
      );
      const { imodelConnection } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([]);
    });

    it("finds category by label when it is contained by definition container", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "DefinitionContainer" });
          const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ txn, codeValue: "SpatialCategory", userLabel: "Test", modelId: definitionModel.id });
          insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });

          return { definitionContainer, category };
        }),
      );
      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        {
          identifier: keys.definitionContainer,
          options: { autoExpand: true },
          children: [{ identifier: keys.category, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);
    });

    it("finds subCategory by label when its parent category is contained by definition container", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "DefinitionContainer" });
          const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ txn, codeValue: "SpatialCategory", modelId: definitionModel.id });
          insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });
          const subCategory1 = insertSubCategory({ txn, codeValue: "SubCategory1", parentCategoryId: category.id, modelId: definitionModel.id });

          return { definitionContainer, category, subCategory1 };
        }),
      );
      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "SubCategory1",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
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

    it("finds 3d categories by label containing special SQLite characters", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });

          const category1 = insertSpatialCategory({ txn, codeValue: "Test SpatialCat_egory" });
          insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category1.id });

          const category2 = insertSpatialCategory({ txn, codeValue: "Test SpatialCat%egory" });
          insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category2.id });

          return { category1, category2 };
        }),
      );

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "_",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        { identifier: keys.category1, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);

      hook.rerender({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "%",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        { identifier: keys.category2, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);
    });

    it("finds 3d subcategories by label containing special SQLite characters", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });

          const category = insertSpatialCategory({ txn, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });

          const subCategory1 = insertSubCategory({ txn, parentCategoryId: category.id, codeValue: "SubCat_egory1" });
          const subCategory2 = insertSubCategory({ txn, parentCategoryId: category.id, codeValue: "SubCat%egory2" });

          return { category, subCategory1, subCategory2 };
        }),
      );

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "_",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory1, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);

      hook.rerender({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "%",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory2, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);
    });

    it("finds 3d categories by label when subCategory count is 1 and labels of category and subCategory differ", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
          // SubCategory gets inserted by default
          const category = insertSpatialCategory({ txn, codeValue: "SpatialCategory", userLabel: "Test" });
          insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });

          return { category };
        }),
      );

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });

      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        { identifier: keys.category, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);

      hook.rerender({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "SpatialCategory",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([]);
    });

    it("finds 3d categories and subCategories by label when subCategory count is > 1", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });

          const category = insertSpatialCategory({ txn, codeValue: "SpatialCategory", userLabel: "Test" });
          insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });

          const subCategory1 = insertSubCategory({ txn, codeValue: "SubCategory1", parentCategoryId: category.id });

          const subCategory2 = insertSubCategory({ txn, codeValue: "SubCategory2", parentCategoryId: category.id });

          return { category, subCategory1, subCategory2 };
        }),
      );

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "Test",
        viewType: "3d",
      });

      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        { identifier: keys.category, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);

      hook.rerender({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "SubCategory1",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory1, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);

      hook.rerender({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "SubCategory2",
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory2, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);
    });

    it("finds 2d categories by label containing special SQLite characters", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const drawingModel = insertDrawingModelWithPartition({ txn, codeValue: "TestDrawingModel" });

          const category1 = insertDrawingCategory({ txn, codeValue: "Test Drawing Cat_egory" });
          insertDrawingGraphic({ txn, modelId: drawingModel.id, categoryId: category1.id });

          const category2 = insertDrawingCategory({ txn, codeValue: "Test Drawing Cat%egory" });
          insertDrawingGraphic({ txn, modelId: drawingModel.id, categoryId: category2.id });

          return { category1, category2 };
        }),
      );

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "_",
        viewType: "2d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        { identifier: keys.category1, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);

      hook.rerender({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "%",
        viewType: "2d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        { identifier: keys.category2, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
      ]);
    });

    it("finds 2d subcategories by label containing special SQLite characters", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const drawingModel = insertDrawingModelWithPartition({ txn, codeValue: "TestDrawingModel" });

          const category = insertDrawingCategory({ txn, codeValue: "Test Drawing Category" });
          insertDrawingGraphic({ txn, modelId: drawingModel.id, categoryId: category.id });

          const subCategory1 = insertSubCategory({ txn, parentCategoryId: category.id, codeValue: "Test Drawing SubCat_egory" });
          const subCategory2 = insertSubCategory({ txn, parentCategoryId: category.id, codeValue: "Test Drawing SubCat%egory" });

          return { category, subCategory1, subCategory2 };
        }),
      );

      const { imodelConnection, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "_",
        viewType: "2d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory1, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);

      hook.rerender({
        imodelConnection,
        hierarchyConfig: defaultHierarchyConfiguration,
        searchText: "%",
        viewType: "2d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        {
          identifier: keys.category,
          options: { autoExpand: true },
          children: [{ identifier: keys.subCategory2, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
        },
      ]);
    });

    it("finds 3d element by base36 ECInstanceId suffix", async function () {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel" });
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "TestDefinitionContainer" });
          const definitionModel = insertSubModel({ txn, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
          const category = insertSpatialCategory({ txn, codeValue: "SpatialCategory", modelId: definitionModel.id });
          const element = insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: category.id });

          return { definitionContainer, element, category };
        }),
      );
      const { imodelConnection, ...keys } = buildIModelResult;

      const briefcaseId = Id64.getBriefcaseId(keys.element.id).toString(36).toLocaleUpperCase();
      const localId = Id64.getLocalId(keys.element.id).toString(36).toLocaleUpperCase();
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: { ...defaultHierarchyConfiguration, showElements: true },
        searchText: `[${briefcaseId}-${localId}]`,
        viewType: "3d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        {
          identifier: keys.definitionContainer,
          options: { autoExpand: true },
          children: [
            {
              identifier: keys.category,
              options: { autoExpand: true },
              children: [
                {
                  identifier: { ...keys.element, className: CLASS_NAME_GeometricElement3d },
                  options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                },
              ],
            },
          ],
        },
      ]);
    });

    it("finds 2d element by base36 ECInstanceId suffix", async function () {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const definitionContainer = insertDefinitionContainer({ txn, codeValue: "TestDefinitionContainer" });
          const definitionModel = insertSubModel({ txn, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
          const drawingModel = insertDrawingModelWithPartition({ txn, codeValue: "TestDrawingModel" });

          const category = insertDrawingCategory({ txn, codeValue: "Test Drawing Category", modelId: definitionModel.id });
          const element = insertDrawingGraphic({ txn, modelId: drawingModel.id, categoryId: category.id });

          return { definitionContainer, element, category };
        }),
      );
      const { imodelConnection, ...keys } = buildIModelResult;

      const briefcaseId = Id64.getBriefcaseId(keys.element.id).toString(36).toLocaleUpperCase();
      const localId = Id64.getLocalId(keys.element.id).toString(36).toLocaleUpperCase();
      const imodelAccess = createIModelAccess(imodelConnection);
      using hook = renderUseCategoriesTreeHook({
        imodelConnection,
        hierarchyConfig: { ...defaultHierarchyConfiguration, showElements: true },
        searchText: `[${briefcaseId}-${localId}]`,
        viewType: "2d",
      });
      expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
        {
          identifier: keys.definitionContainer,
          options: { autoExpand: true },
          children: [
            {
              identifier: keys.category,
              options: { autoExpand: true },
              children: [
                {
                  identifier: { ...keys.element, className: CLASS_NAME_GeometricElement2d },
                  options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                },
              ],
            },
          ],
        },
      ]);
    });
    ["2d" as const, "3d" as const].forEach((viewType) => {
      const { insertCategory, insertElement, insertElementsModel, insertElementsSubModel, insertModeledElement } = getInsertFunctionByViewType(viewType);
      describe(`intermediate ${viewType} categories`, () => {
        const showElementsConfig = { ...defaultHierarchyConfiguration, showElements: true };
        const { elementClass, modelClass } = getClassesByView(viewType);
        it("finds child element with different category than parent (intermediate category in path)", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "TestModel" });
              const categoryA = insertCategory({ txn, codeValue: "category-a" });
              const categoryB = insertCategory({ txn, codeValue: "category-b" });
              const parentElement = insertElement({ txn, userLabel: "parent element", modelId: model.id, categoryId: categoryA.id });
              const childElement = insertElement({
                txn,
                userLabel: "child",
                modelId: model.id,
                categoryId: categoryB.id,
                parentId: parentElement.id,
              });
              return { categoryA, categoryB, parentElement, childElement };
            }),
          );
          const { imodelConnection, ...keys } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: showElementsConfig,
            searchText: "child",
            viewType,
          });
          expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
            {
              identifier: keys.categoryA,
              options: { autoExpand: true },
              children: [
                {
                  identifier: { className: elementClass, id: keys.parentElement.id },
                  options: { autoExpand: true },
                  children: [
                    {
                      identifier: keys.categoryB,
                      options: { autoExpand: true },
                      children: [
                        {
                          identifier: { className: elementClass, id: keys.childElement.id },
                          options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ]);
        });

        it("finds child element with same category as parent (no intermediate category in path)", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "TestModel" });
              const category = insertCategory({ txn, codeValue: "category" });
              const parentElement = insertElement({ txn, userLabel: "parent element", modelId: model.id, categoryId: category.id });
              const childElement = insertElement({
                txn,
                userLabel: "child",
                modelId: model.id,
                categoryId: category.id,
                parentId: parentElement.id,
              });
              return { category, parentElement, childElement };
            }),
          );
          const { imodelConnection, ...keys } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: showElementsConfig,
            searchText: "child",
            viewType,
          });
          expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
            {
              identifier: keys.category,
              options: { autoExpand: true },
              children: [
                {
                  identifier: { className: elementClass, id: keys.parentElement.id },
                  options: { autoExpand: true },
                  children: [
                    {
                      identifier: { className: elementClass, id: keys.childElement.id },
                      options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                    },
                  ],
                },
              ],
            },
          ]);
        });

        it("finds category that appears as intermediate category", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "TestModel" });
              const categoryA = insertCategory({ txn, codeValue: "category-a" });
              const categoryB = insertCategory({ txn, codeValue: "category-b" });
              const parentElement = insertElement({ txn, userLabel: "parent element", modelId: model.id, categoryId: categoryA.id });
              insertElement({
                txn,
                userLabel: "child element",
                modelId: model.id,
                categoryId: categoryB.id,
                parentId: parentElement.id,
              });
              return { categoryA, categoryB, parentElement };
            }),
          );
          const { imodelConnection, ...keys } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: showElementsConfig,
            searchText: "category-b",
            viewType,
          });
          const paths = await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }));
          // Should find the category as an intermediate category path (under parentElement)
          expect(paths).toEqual([
            {
              identifier: keys.categoryA,
              options: { autoExpand: true },
              children: [
                {
                  identifier: { className: elementClass, id: keys.parentElement.id },
                  options: { autoExpand: true },
                  children: [{ identifier: keys.categoryB, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
                },
              ],
            },
            {
              identifier: keys.categoryB,
              options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
            },
          ]);
        });

        it("finds sub-model element with different category than modeled element (intermediate category in path)", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "TestModel" });
              const categoryA = insertCategory({ txn, codeValue: "category-a" });
              const categoryB = insertCategory({ txn, codeValue: "category-b" });
              const modeledElement = insertModeledElement({
                txn,
                userLabel: "modeled element",
                modelId: model.id,
                categoryId: categoryA.id,
              });
              const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
              const modelingElement = insertElement({
                txn,
                userLabel: "modeling element",
                modelId: subModel.id,
                categoryId: categoryB.id,
              });
              return { categoryA, categoryB, modeledElement, subModel, modelingElement };
            }),
          );
          const { imodelConnection, ...keys } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: showElementsConfig,
            searchText: "modeling element",
            viewType,
          });
          expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
            {
              identifier: keys.categoryA,
              options: { autoExpand: true },
              children: [
                {
                  identifier: { className: elementClass, id: keys.modeledElement.id },
                  options: { autoExpand: true },
                  children: [
                    {
                      identifier: { className: modelClass, id: keys.subModel.id },
                      options: { autoExpand: true },
                      children: [
                        {
                          identifier: keys.categoryB,
                          options: { autoExpand: true },
                          children: [
                            {
                              identifier: { className: elementClass, id: keys.modelingElement.id },
                              options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ]);
        });

        it("finds sub-model element with same category as modeled element (no intermediate category in path)", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "TestModel" });
              const category = insertCategory({ txn, codeValue: "category" });
              const modeledElement = insertModeledElement({
                txn,
                userLabel: "modeled element",
                modelId: model.id,
                categoryId: category.id,
              });
              const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
              const modelingElement = insertElement({
                txn,
                userLabel: "modeling element",
                modelId: subModel.id,
                categoryId: category.id,
              });
              return { category, modeledElement, subModel, modelingElement };
            }),
          );
          const { imodelConnection, ...keys } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: showElementsConfig,
            searchText: "modeling element",
            viewType,
          });
          expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
            {
              identifier: keys.category,
              options: { autoExpand: true },
              children: [
                {
                  identifier: { className: elementClass, id: keys.modeledElement.id },
                  options: { autoExpand: true },
                  children: [
                    {
                      identifier: { className: modelClass, id: keys.subModel.id },
                      options: { autoExpand: true },
                      children: [
                        {
                          identifier: { className: elementClass, id: keys.modelingElement.id },
                          options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ]);
        });

        it("finds category that appears as intermediate category under sub-model", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "TestModel" });
              const categoryA = insertCategory({ txn, codeValue: "category-a" });
              const categoryB = insertCategory({ txn, codeValue: "category-b" });
              const modeledElement = insertModeledElement({
                txn,
                userLabel: "modeled element",
                modelId: model.id,
                categoryId: categoryA.id,
              });
              const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
              insertElement({
                txn,
                userLabel: "modeling element",
                modelId: subModel.id,
                categoryId: categoryB.id,
              });
              return { categoryA, categoryB, modeledElement, subModel };
            }),
          );
          const { imodelConnection, ...keys } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: showElementsConfig,
            searchText: "category-b",
            viewType,
          });
          const paths = await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }));
          expect(paths).toEqual([
            {
              identifier: keys.categoryA,
              options: { autoExpand: true },
              children: [
                {
                  identifier: { className: elementClass, id: keys.modeledElement.id },
                  options: { autoExpand: true },
                  children: [
                    {
                      identifier: { className: modelClass, id: keys.subModel.id },
                      options: { autoExpand: true },
                      children: [{ identifier: keys.categoryB, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } }],
                    },
                  ],
                },
              ],
            },
            {
              identifier: keys.categoryB,
              options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
            },
          ]);
        });
      });

      describe(`'onCategoriesFiltered' callback with ${viewType} categories`, () => {
        it("is called with empty categories when `showEmptyCategories` flag is set", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const physicalModel = insertElementsModel({ txn, codeValue: "TestPhysicalModel" });
              const definitionContainer = insertDefinitionContainer({ txn, codeValue: "DefinitionContainer", userLabel: "TestDC" });
              const definitionModel = insertSubModel({ txn, classFullName: CLASS_NAME_DefinitionModel, modeledElementId: definitionContainer.id });
              const categoryWithElements = insertCategory({ txn, codeValue: "CategoryWithElements", modelId: definitionModel.id });
              const categoryWithoutElements = insertCategory({ txn, codeValue: "CategoryWithoutElements", modelId: definitionModel.id });
              insertElement({ txn, modelId: physicalModel.id, categoryId: categoryWithElements.id });

              return { definitionContainer, categoryWithElements, categoryWithoutElements };
            }),
          );
          const { imodelConnection, ...keys } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);

          let filteredCategories: { categories: CategoryInfo[] | undefined } | undefined;
          const onCategoriesFiltered = (props: { categories: CategoryInfo[] | undefined }) => {
            filteredCategories = props;
          };

          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: { ...defaultHierarchyConfiguration, showEmptyCategories: true },
            searchText: "TestDC",
            viewType,
            onCategoriesFiltered,
          });
          await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }));

          // When showEmptyCategories is true, both categories should be reported (including the one without elements)
          expect(filteredCategories?.categories).toEqual([
            { categoryId: keys.categoryWithElements.id, subCategoryIds: undefined },
            { categoryId: keys.categoryWithoutElements.id, subCategoryIds: undefined },
          ]);
          hook.rerender({
            imodelConnection,
            hierarchyConfig: { ...defaultHierarchyConfiguration, showEmptyCategories: false },
            searchText: "TestDC",
            viewType,
            onCategoriesFiltered,
          });
          await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }));

          // When showEmptyCategories is false, only the category with elements should be reported
          expect(filteredCategories?.categories).toEqual([{ categoryId: keys.categoryWithElements.id, subCategoryIds: undefined }]);
        });
      });

      describe(`omittedElementClassNames in '${viewType}' view`, () => {
        const showElementsConfig = { ...defaultHierarchyConfiguration, showElements: true };
        const elementClassName: EC.FullClassName = viewType === "3d" ? "Generic.PhysicalObject" : "BisCore.DrawingGraphic";
        const subModeledElementBaseClassName: EC.FullClassName = "BisCore.ISubModeledElement";

        it("excludes elements of omitted classes from search paths", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "model" });
              const category = insertCategory({ txn, codeValue: "category" });
              insertElement({ txn, userLabel: "matching omitted element", modelId: model.id, categoryId: category.id });
            }),
          );
          const { imodelConnection } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: { ...showElementsConfig, omittedElementClassNames: [elementClassName] },
            searchText: "matching",
            viewType,
          });
          expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual(
            [],
          );
        });

        it("excludes elements of classes derived from omitted classes from search paths", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "model" });
              const category = insertCategory({ txn, codeValue: "category" });
              insertModeledElement({ txn, userLabel: "matching omitted element", modelId: model.id, categoryId: category.id });
            }),
          );
          const { imodelConnection } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: { ...showElementsConfig, omittedElementClassNames: [subModeledElementBaseClassName] },
            searchText: "matching",
            viewType,
          });
          expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual(
            [],
          );
        });

        it("returns the category even when its only element is omitted", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "model" });
              const omittedCategory = insertCategory({ txn, codeValue: "matching omitted category" });
              insertElement({ txn, userLabel: "omitted element", modelId: model.id, categoryId: omittedCategory.id });
              return { omittedCategory };
            }),
          );
          const { imodelConnection, ...keys } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: { ...defaultHierarchyConfiguration, omittedElementClassNames: [elementClassName] },
            searchText: "matching",
            viewType,
          });
          expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
            { identifier: keys.omittedCategory, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
          ]);
        });

        it("does not return child elements of filtered out parent elements", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "model" });
              const category = insertCategory({ txn, codeValue: "category" });
              const omittedParent = insertElement({ txn, userLabel: "omitted parent", modelId: model.id, categoryId: category.id });
              insertModeledElement({
                txn,
                userLabel: "matching child of omitted parent",
                modelId: model.id,
                categoryId: category.id,
                parentId: omittedParent.id,
              });
            }),
          );
          const { imodelConnection } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: { ...showElementsConfig, omittedElementClassNames: [elementClassName] },
            searchText: "matching",
            viewType,
          });
          expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual(
            [],
          );
        });

        it("does not return omitted child elements when their parent is not omitted", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "model" });
              const category = insertCategory({ txn, codeValue: "category" });
              const keptParent = insertElement({ txn, userLabel: "kept parent", modelId: model.id, categoryId: category.id });
              insertModeledElement({
                txn,
                userLabel: "matching omitted child",
                modelId: model.id,
                categoryId: category.id,
                parentId: keptParent.id,
              });
            }),
          );
          const { imodelConnection } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: { ...showElementsConfig, omittedElementClassNames: [subModeledElementBaseClassName] },
            searchText: "matching",
            viewType,
          });
          expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual(
            [],
          );
        });

        it("returns the category even when its only sub-model element is omitted", async () => {
          await using buildIModelResult = await buildIModel(async (imodel) =>
            withEditTxn(imodel, (txn) => {
              const model = insertElementsModel({ txn, codeValue: "model" });
              const category = insertCategory({ txn, codeValue: "category" });
              const omittedCategory = insertCategory({ txn, codeValue: "matching omitted category" });
              const modeledElement = insertModeledElement({ txn, userLabel: "modeled element", modelId: model.id, categoryId: category.id });
              const subModel = insertElementsSubModel({ txn, modeledElementId: modeledElement.id });
              insertElement({ txn, userLabel: "omitted element", modelId: subModel.id, categoryId: omittedCategory.id });
              return { omittedCategory };
            }),
          );
          const { imodelConnection, ...keys } = buildIModelResult;
          const imodelAccess = createIModelAccess(imodelConnection);
          using hook = renderUseCategoriesTreeHook({
            imodelConnection,
            hierarchyConfig: { ...defaultHierarchyConfiguration, omittedElementClassNames: [elementClassName] },
            searchText: "matching",
            viewType,
          });
          expect(await act(async () => hook.result.current.treeProps.getSearchPaths?.({ imodelAccess, abortSignal: new AbortController().signal }))).toEqual([
            { identifier: keys.omittedCategory, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
          ]);
        });
      });
    });
  });
});

function renderUseCategoriesTreeHook(
  props: Omit<Props<typeof useCategoriesTree>, "activeView"> & { imodelConnection: IModelConnection; viewType: "2d" | "3d" },
) {
  const result = renderHook(
    (hookProps) => useCategoriesTree({ activeView: createFakeViewport({ iModel: props.imodelConnection, viewType: props.viewType }), ...hookProps }),
    {
      initialProps: props,
      wrapper: ({ children }) => <SharedTreeContextProvider>{children}</SharedTreeContextProvider>,
    },
  );
  return { ...result, [Symbol.dispose]: () => result.unmount() };
}

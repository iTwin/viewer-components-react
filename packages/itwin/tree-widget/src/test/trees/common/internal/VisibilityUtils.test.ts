/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EMPTY, firstValueFrom, from, Subject, toArray } from "rxjs";
import {
  HierarchyCacheMode,
  initializeCore,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubCategory,
  terminateCore,
} from "test-utilities";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { IModelReadRpcInterface, SubCategoryAppearance } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createVisibilityStatus } from "../../../../tree-widget-react/components/trees/common/internal/Tooltip.js";
import {
  changeElementStateNoChildrenOperator,
  getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl,
  hideAllCategories,
  invertAllCategories,
  invertAllModels,
  mergeVisibilityStatuses,
  modifyCategoryDisplay,
  showAll,
} from "../../../../tree-widget-react/components/trees/common/internal/VisibilityUtils.js";
import { buildIModel } from "../../../IModelUtils.js";
import { TestUtils } from "../../../TestUtils.js";
import { createFakeViewport } from "../../Common.js";
import { createTreeWidgetTestingViewport } from "../../TreeUtils.js";

import type { IModelDb } from "@itwin/core-backend";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeWidgetTestingViewport } from "../../TreeUtils.js";

describe("VisibilityUtils", () => {
  beforeAll(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  afterAll(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  const categoryId = "CategoryId";
  const subCategoryId = "SubCategoryId";
  const categoriesInfo = new Map([
    [
      categoryId,
      {
        id: categoryId,
        subCategories: new Map([
          [
            subCategoryId,
            {
              id: subCategoryId,
              categoryId,
              appearance: new SubCategoryAppearance(),
            },
          ],
        ]),
      },
    ],
  ]);
  let viewport: TreeWidgetTestingViewport;

  /**
   * Creates enough categories for `modifyCategoryDisplay` to release the main thread while processing them.
   * This makes the change asynchronous, giving tests a chance to cancel it before it completes.
   */
  function createLargeCategoryInfos(): Map<Id64String, Array<Id64String> | undefined> {
    return new Map(Array.from({ length: 500 }, (_, index): [Id64String, Array<Id64String> | undefined] => [`0x${index + 1}`, undefined]));
  }

  beforeEach(() => {
    viewport = createFakeViewport({
      queryHandler: () => [{ id: categoryId }],
      getCategoryInfo: async () => categoriesInfo,
      viewType: "3d",
    });
  });

  describe("modifyCategoryDisplay", () => {
    it("turns on category", async () => {
      await firstValueFrom(modifyCategoryDisplay({ viewport, categoryInfos: new Map([[categoryId, [subCategoryId]]]), display: true }));
      expect(viewport.changeCategoryDisplay).toHaveBeenCalledWith({ categoryIds: [categoryId], display: true, enableAllSubCategories: false });
      expect(viewport.changeSubCategoryDisplay).toHaveBeenCalledWith({ subCategoryId, display: true });
    });

    it("disables category", async () => {
      await firstValueFrom(modifyCategoryDisplay({ viewport, categoryInfos: new Map([[categoryId, [subCategoryId]]]), display: false }));
      expect(viewport.changeCategoryDisplay).toHaveBeenCalledWith({ categoryIds: [categoryId], display: false, enableAllSubCategories: false });
      expect(viewport.changeSubCategoryDisplay).not.toHaveBeenCalled();
    });

    it("removes overrides per model when enabling category", async () => {
      const overrides = [{ modelId: "ModelId", categoryId, visible: false }];
      viewport.perModelCategoryOverrides = overrides;
      await firstValueFrom(modifyCategoryDisplay({ viewport, categoryInfos: new Map([[categoryId, [subCategoryId]]]), display: true }));

      expect(viewport.changeCategoryDisplay).toHaveBeenCalledWith({ categoryIds: [categoryId], display: true, enableAllSubCategories: false });
      expect(viewport.getPerModelCategoryOverride({ modelId: "ModelId", categoryId })).toBe("none");
    });
  });

  describe("mergeVisibilityStatuses", () => {
    it("returns `visible` when all statuses are visible", async () => {
      const result = await firstValueFrom(from([createVisibilityStatus("visible"), createVisibilityStatus("visible")]).pipe(mergeVisibilityStatuses()));
      expect(result.state).toEqual("visible");
    });

    it("returns `hidden` when all statuses are hidden", async () => {
      const result = await firstValueFrom(from([createVisibilityStatus("hidden"), createVisibilityStatus("hidden")]).pipe(mergeVisibilityStatuses()));
      expect(result.state).toEqual("hidden");
    });

    it("returns `partial` when statuses differ", async () => {
      const result = await firstValueFrom(from([createVisibilityStatus("visible"), createVisibilityStatus("hidden")]).pipe(mergeVisibilityStatuses()));
      expect(result.state).toEqual("partial");
    });

    it("returns `partial` when one of the statuses is partial", async () => {
      const result = await firstValueFrom(from([createVisibilityStatus("visible"), createVisibilityStatus("partial")]).pipe(mergeVisibilityStatuses()));
      expect(result.state).toEqual("partial");
    });

    it("emits nothing when there are no statuses", async () => {
      const result = await firstValueFrom(EMPTY.pipe(mergeVisibilityStatuses(), toArray()));
      expect(result).toEqual([]);
    });
  });

  describe("getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl", () => {
    it("returns default status when there are no elements", () => {
      const numberOfElementsInOppositeSet = 0;
      const totalCount = 0;
      const resultVisible = getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
        numberOfElementsInOppositeSet,
        totalCount,
        defaultStatus: createVisibilityStatus("visible"),
      });
      expect(resultVisible.state).toEqual("visible");
      const resultHidden = getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
        numberOfElementsInOppositeSet,
        totalCount,
        defaultStatus: createVisibilityStatus("hidden"),
      });
      expect(resultHidden.state).toEqual("hidden");
    });

    it("returns default status when opposite set is empty", () => {
      const numberOfElementsInOppositeSet = 0;
      const totalCount = 5;
      const resultVisible = getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
        numberOfElementsInOppositeSet,
        totalCount,
        defaultStatus: createVisibilityStatus("visible"),
      });
      expect(resultVisible.state).toEqual("visible");
      const resultHidden = getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
        numberOfElementsInOppositeSet,
        totalCount,
        defaultStatus: createVisibilityStatus("hidden"),
      });
      expect(resultHidden.state).toEqual("hidden");
    });

    it("returns inverted status when all elements are in opposite set", () => {
      expect(
        getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          numberOfElementsInOppositeSet: 5,
          totalCount: 5,
          defaultStatus: createVisibilityStatus("visible"),
        }).state,
      ).toEqual("hidden");
      expect(
        getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          numberOfElementsInOppositeSet: 5,
          totalCount: 5,
          defaultStatus: createVisibilityStatus("hidden"),
        }).state,
      ).toEqual("visible");
    });

    it("returns `partial` when some elements are in opposite set", () => {
      const numberOfElementsInOppositeSet = 2;
      const totalCount = 5;
      const result1 = getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
        numberOfElementsInOppositeSet,
        totalCount,
        defaultStatus: createVisibilityStatus("visible"),
      });
      expect(result1.state).toEqual("partial");
      const result2 = getCategoryVisibilityFromAlwaysAndNeverDrawnElementsImpl({
        numberOfElementsInOppositeSet,
        totalCount,
        defaultStatus: createVisibilityStatus("hidden"),
      });
      expect(result2.state).toEqual("partial");
    });
  });

  describe("changeElementStateNoChildrenOperator", () => {
    it("removes element from never drawn list when turning it on", async () => {
      using testViewport = createFakeViewport({ neverDrawn: new Set(["0x1"]) });
      await firstValueFrom(
        from([{ elementId: "0x1", matchesDesiredState: true }]).pipe(changeElementStateNoChildrenOperator({ on: true, viewport: testViewport })),
      );
      expect(testViewport.setNeverDrawn).toHaveBeenCalledWith({ elementIds: new Set() });
      expect(testViewport.setAlwaysDrawn).not.toHaveBeenCalled();
    });

    it("adds element to always drawn list when turning it on and it does not match desired state", async () => {
      using testViewport = createFakeViewport();
      await firstValueFrom(
        from([{ elementId: "0x1", matchesDesiredState: false }]).pipe(changeElementStateNoChildrenOperator({ on: true, viewport: testViewport })),
      );
      expect(testViewport.setAlwaysDrawn).toHaveBeenCalledWith({ elementIds: new Set(["0x1"]), exclusive: false });
    });

    it("adds element to always drawn list when turning it on and exclusive mode is enabled", async () => {
      using testViewport = createFakeViewport({ isAlwaysDrawnExclusive: true });
      await firstValueFrom(
        from([{ elementId: "0x1", matchesDesiredState: true }]).pipe(changeElementStateNoChildrenOperator({ on: true, viewport: testViewport })),
      );
      expect(testViewport.setAlwaysDrawn).toHaveBeenCalledWith({ elementIds: new Set(["0x1"]), exclusive: true });
    });

    it("removes element from always drawn list when turning it off", async () => {
      using testViewport = createFakeViewport({ alwaysDrawn: new Set(["0x1"]) });
      await firstValueFrom(
        from([{ elementId: "0x1", matchesDesiredState: true }]).pipe(changeElementStateNoChildrenOperator({ on: false, viewport: testViewport })),
      );
      expect(testViewport.setAlwaysDrawn).toHaveBeenCalledWith({ elementIds: new Set(), exclusive: false });
      expect(testViewport.setNeverDrawn).not.toHaveBeenCalled();
    });

    it("adds element to never drawn list when turning it off and it does not match desired state", async () => {
      using testViewport = createFakeViewport();
      await firstValueFrom(
        from([{ elementId: "0x1", matchesDesiredState: false }]).pipe(changeElementStateNoChildrenOperator({ on: false, viewport: testViewport })),
      );
      expect(testViewport.setNeverDrawn).toHaveBeenCalledWith({ elementIds: new Set(["0x1"]) });
    });

    it("does not add element to never drawn list when turning it off and exclusive mode is enabled", async () => {
      using testViewport = createFakeViewport({ isAlwaysDrawnExclusive: true });
      await firstValueFrom(
        from([{ elementId: "0x1", matchesDesiredState: false }]).pipe(changeElementStateNoChildrenOperator({ on: false, viewport: testViewport })),
      );
      expect(testViewport.setNeverDrawn).not.toHaveBeenCalled();
    });
  });

  describe("showAll", () => {
    it("turns on models, categories and sub-categories and clears always and never drawn lists", async () => {
      await showAll({
        viewport,
        modelIds: ["0x10"],
        categoryInfos: new Map([[categoryId, [subCategoryId]]]),
        cancel: new Subject<void>(),
      });

      expect(viewport.clearAlwaysDrawn).toHaveBeenCalled();
      expect(viewport.clearNeverDrawn).toHaveBeenCalled();
      expect(viewport.changeModelDisplay).toHaveBeenCalledWith({ modelIds: ["0x10"], display: true });
      expect(viewport.changeCategoryDisplay).toHaveBeenCalledWith({ categoryIds: [categoryId], display: true, enableAllSubCategories: false });
      expect(viewport.changeSubCategoryDisplay).toHaveBeenCalledWith({ subCategoryId, display: true });
    });

    it("applies changes when it is not cancelled", async () => {
      await showAll({ viewport, modelIds: ["0x10"], categoryInfos: createLargeCategoryInfos(), cancel: new Subject<void>() });

      expect(viewport.changeModelDisplay).toHaveBeenCalled();
      expect(viewport.changeCategoryDisplay).toHaveBeenCalled();
    });

    it("does not modify viewport when it is cancelled before completing", async () => {
      const cancel = new Subject<void>();
      const promise = showAll({ viewport, modelIds: ["0x10"], categoryInfos: createLargeCategoryInfos(), cancel });
      cancel.next();
      await promise;

      expect(viewport.clearAlwaysDrawn).not.toHaveBeenCalled();
      expect(viewport.clearNeverDrawn).not.toHaveBeenCalled();
      expect(viewport.changeModelDisplay).not.toHaveBeenCalled();
      expect(viewport.changeCategoryDisplay).not.toHaveBeenCalled();
    });
  });

  describe("hideAllCategories", () => {
    it("turns off categories and clears always drawn list", async () => {
      await hideAllCategories({
        viewport,
        categoryInfos: new Map([[categoryId, [subCategoryId]]]),
        cancel: new Subject<void>(),
      });

      expect(viewport.clearAlwaysDrawn).toHaveBeenCalled();
      expect(viewport.changeCategoryDisplay).toHaveBeenCalledWith({ categoryIds: [categoryId], display: false, enableAllSubCategories: false });
      expect(viewport.changeSubCategoryDisplay).not.toHaveBeenCalled();
      expect(viewport.changeModelDisplay).not.toHaveBeenCalled();
      expect(viewport.clearNeverDrawn).not.toHaveBeenCalled();
    });

    it("does not modify viewport when it is cancelled before completing", async () => {
      const cancel = new Subject<void>();
      const promise = hideAllCategories({ viewport, categoryInfos: createLargeCategoryInfos(), cancel });
      cancel.next();
      await promise;

      expect(viewport.clearAlwaysDrawn).not.toHaveBeenCalled();
      expect(viewport.changeCategoryDisplay).not.toHaveBeenCalled();
    });
  });

  describe("invertAllModels", () => {
    it("turns on hidden models and turns off visible ones", async () => {
      using testViewport = createFakeViewport({ viewsModel: (modelId) => modelId === "0x10", viewsSubCategory: () => false });

      await invertAllModels({
        viewport: testViewport,
        modelIds: ["0x10", "0x20"],
        categoryInfos: new Map([[categoryId, [subCategoryId]]]),
        cancel: new Subject<void>(),
      });

      expect(testViewport.changeModelDisplay).toHaveBeenCalledWith({ modelIds: ["0x20"], display: true });
      expect(testViewport.changeModelDisplay).toHaveBeenCalledWith({ modelIds: ["0x10"], display: false });
    });

    it("turns on all categories and sub-categories and clears always drawn, never drawn lists and per model overrides", async () => {
      using testViewport = createFakeViewport({ viewsModel: () => false, viewsSubCategory: () => false });

      await invertAllModels({
        viewport: testViewport,
        modelIds: ["0x10"],
        categoryInfos: new Map([[categoryId, [subCategoryId]]]),
        cancel: new Subject<void>(),
      });

      expect(testViewport.clearAlwaysDrawn).toHaveBeenCalled();
      expect(testViewport.clearNeverDrawn).toHaveBeenCalled();
      expect(testViewport.changeCategoryDisplay).toHaveBeenCalledWith({ categoryIds: [categoryId], display: true });
      expect(testViewport.changeSubCategoryDisplay).toHaveBeenCalledWith({ subCategoryId, display: true });
    });

    it("does not change sub-category display when it is already visible", async () => {
      using testViewport = createFakeViewport({ viewsModel: () => false, viewsSubCategory: () => true });

      await invertAllModels({
        viewport: testViewport,
        modelIds: ["0x10"],
        categoryInfos: new Map([[categoryId, [subCategoryId]]]),
        cancel: new Subject<void>(),
      });

      expect(testViewport.changeSubCategoryDisplay).not.toHaveBeenCalled();
    });
  });

  describe("invertAllCategories", () => {
    let imodelConnection: IModelConnection;
    let categoryIds: Array<Id64String>;
    let modelIds: Array<Id64String>;
    let subCategoryIds: Array<Id64String>;
    let nonMockedViewport: TreeWidgetTestingViewport;
    async function createIModel(): Promise<{ imodelConnection: IModelConnection } & { models: Id64Array; categories: Id64Array; subCategories: Id64Array }> {
      return buildIModel(async (imodel: IModelDb) =>
        withEditTxn(imodel, (txn) => {
          const physicalModel1 = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel1" }).id;
          const physicalModel2 = insertPhysicalModelWithPartition({ txn, codeValue: "TestPhysicalModel2" }).id;
          const category1 = insertSpatialCategory({ txn, codeValue: "SpatialCategory1" }).id;
          const category2 = insertSpatialCategory({ txn, codeValue: "SpatialCategory2" }).id;
          const subCategory1 = insertSubCategory({ txn, codeValue: "SubCategory1", parentCategoryId: category1 }).id;
          const subCategory2 = insertSubCategory({ txn, codeValue: "SubCategory2", parentCategoryId: category2 }).id;
          insertPhysicalElement({ txn, codeValue: "element1", categoryId: category1, modelId: physicalModel1 }).id;
          insertPhysicalElement({ txn, codeValue: "element2", categoryId: category2, modelId: physicalModel2 }).id;
          return {
            models: [physicalModel1, physicalModel2],
            categories: [category1, category2],
            subCategories: [subCategory1, subCategory2],
          };
        }),
      );
    }
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
      const buildIModelResult = await createIModel();
      imodelConnection = buildIModelResult.imodelConnection;
      categoryIds = buildIModelResult.categories;
      modelIds = buildIModelResult.models;
      subCategoryIds = buildIModelResult.subCategories;
      nonMockedViewport = createTreeWidgetTestingViewport({
        iModel: imodelConnection,
        visibleByDefault: false,
        viewType: "3d",
        subCategoriesOfCategories: [
          { categoryId: buildIModelResult.categories[0], subCategories: buildIModelResult.subCategories[0] },
          { categoryId: buildIModelResult.categories[1], subCategories: buildIModelResult.subCategories[1] },
        ],
      });
    });

    afterAll(async () => {
      await imodelConnection.close();
      await terminateCore();
    });

    it("inverts visible and hidden categories", async () => {
      nonMockedViewport.changeCategoryDisplay({ categoryIds: [categoryIds[0]], display: false, enableAllSubCategories: true });
      nonMockedViewport.changeCategoryDisplay({ categoryIds: [categoryIds[1], categoryIds[2]], display: true, enableAllSubCategories: true });
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(nonMockedViewport.viewsCategory(categoryIds[i])).toBe(i > 0);
      }
      await invertAllCategories({
        categoryInfos: new Map(categoryIds.map((id, index) => [id, [subCategoryIds[index]]])),
        modelIds,
        cancel: new Subject<void>(),
        viewport: nonMockedViewport,
      });
      for (let i = 0; i < categoryIds.length; ++i) {
        expect(nonMockedViewport.viewsCategory(categoryIds[i])).toBe(i === 0);
      }
    });

    it("clears always/never drawn sets and per model category overrides ", async () => {
      nonMockedViewport.changeCategoryDisplay({ categoryIds: categoryIds[0], display: true, enableAllSubCategories: true });
      nonMockedViewport.changeCategoryDisplay({ categoryIds: categoryIds[1], display: false, enableAllSubCategories: true });
      nonMockedViewport.setAlwaysDrawn({ elementIds: new Set(["element1"]) });
      nonMockedViewport.setNeverDrawn({ elementIds: new Set(["element2"]) });
      nonMockedViewport.setPerModelCategoryOverride({ modelIds: modelIds[0], categoryIds: categoryIds[0], override: "show" });
      nonMockedViewport.setPerModelCategoryOverride({ modelIds: modelIds[1], categoryIds: categoryIds[1], override: "hide" });
      expect(nonMockedViewport.alwaysDrawn?.size).toBe(1);
      await invertAllCategories({
        categoryInfos: new Map(categoryIds.map((id, index) => [id, [subCategoryIds[index]]])),
        modelIds,
        cancel: new Subject<void>(),
        viewport: nonMockedViewport,
      });
      expect(nonMockedViewport.viewsCategory(categoryIds[0])).toBe(false);
      expect(nonMockedViewport.viewsCategory(categoryIds[1])).toBe(true);
      expect(nonMockedViewport.viewsSubCategory(subCategoryIds[0])).toBe(true);
      expect(nonMockedViewport.viewsSubCategory(subCategoryIds[1])).toBe(true);
      expect(nonMockedViewport.alwaysDrawn?.size).toBe(0);
      expect(nonMockedViewport.neverDrawn?.size).toBe(0);
      expect(nonMockedViewport.getPerModelCategoryOverride({ modelId: modelIds[0], categoryId: categoryIds[0] })).toBe("none");
      expect(nonMockedViewport.getPerModelCategoryOverride({ modelId: modelIds[1], categoryId: categoryIds[1] })).toBe("none");
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  HierarchyCacheMode,
  initializeCore,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  terminateCore,
} from "test-utilities";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { Code, IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { CLASS_NAME_GeometricElement3d } from "../../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { mergeWithDefaults } from "../../../../tree-widget-react/shared/internal/Utils.js";
import { defaultHierarchyConfiguration } from "../../../../tree-widget-react/trees/models-tree/ModelsTreeDefinition.js";
import { buildIModel } from "../../../IModelUtils.js";
import { validateHierarchyVisibility } from "../../../shared/VisibilityValidation.js";
import { TestUtils } from "../../../TestUtils.js";
import {
  createAccessAndCache,
  createCategoryHierarchyNode,
  createClassGroupingHierarchyNode,
  createElementHierarchyNode,
  createModelHierarchyNode,
  createSubjectHierarchyNode,
  createVisibilityTestData,
} from "../Utils.js";
import { validateNodeVisibility } from "./VisibilityValidation.js";

import type { Id64String } from "@itwin/core-bentley";
import type { GeometricElement3dProps } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Props } from "@itwin/presentation-shared";
import type {
  ModelsTreeHierarchyConfiguration,
  RequiredModelsTreeHierarchyConfiguration,
} from "../../../../tree-widget-react/trees/models-tree/ModelsTreeDefinition.js";

describe("ModelsTreeVisibilityHandler", () => {
  beforeAll(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  afterAll(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  describe("#integration", () => {
    const hierarchyConfig: ModelsTreeHierarchyConfiguration = {
      subjects: { root: "exclude" },
    };
    let datasets: Awaited<ReturnType<typeof createDatasets>>;
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
      datasets = await createDatasets();
    });

    afterAll(async () => {
      await terminateCore();
      await datasets[Symbol.asyncDispose]();
    });

    it("by default everything is hidden", async () => {
      const { imodelConnection, idsCache, imodelAccess } = datasets.simple;
      using visibilityTestData = createVisibilityTestData({
        imodelConnection,
        hierarchyConfig,
        imodelAccess,
        idsCache,
      });
      const { handler, provider, viewport } = visibilityTestData;
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
    });

    it("showing subject makes it, all its models, categories and elements visible", async () => {
      const { imodelConnection, idsCache, imodelAccess } = datasets.simple;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: [IModel.rootSubjectId] }), true);
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    });

    it("showing model doesn't affect other models", async () => {
      const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleModels;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(
        createModelHierarchyNode({
          modelId: keys.modelA.id,
          hasChildren: true,
        }),
        true,
      );

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.modelA.id]: "visible",
            [`${keys.modelA.id}-${keys.categoryA.id}`]: "visible",
              [keys.elementA1.id]: "visible",
              [keys.elementA2.id]: "visible",

          [keys.modelB.id]: "hidden",
            [`${keys.modelB.id}-${keys.categoryB.id}`]: "hidden",
              [keys.elementB.id]: "hidden",
        },
      });
    });

    it("all parent hierarchy gets partial when it's visible and one of the elements are added to never drawn list", async () => {
      const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createModelHierarchyNode({ modelId: keys.model.id, hasChildren: true }), true);
      viewport.setNeverDrawn({ elementIds: new Set([keys.childElement.id]) });

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.model.id]: "partial",
            [`${keys.model.id}-${keys.category.id}`]: "partial",
              [keys.parentElement.id]: "partial",
                [keys.childElement.id]: "hidden",
        },
      });
    });

    it("hiding parent element affects its model, category and children", async () => {
      const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createModelHierarchyNode({ modelId: keys.model.id, hasChildren: true }), true);

      await handler.changeVisibility(
        createElementHierarchyNode({ modelId: keys.model.id, categoryId: keys.category.id, elementId: keys.parentElement.id }),
        false,
      );

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
    });

    it("showing parent element affects its model, category and children", async () => {
      const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(
        createElementHierarchyNode({
          modelId: keys.model.id,
          categoryId: keys.category.id,
          elementId: keys.parentElement.id,
        }),
        true,
      );

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    });

    it("if model is hidden, showing element removes all other model elements from the always drawn list", async () => {
      const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleModels;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      const elementToShow = keys.elementA1.id;
      viewport.setAlwaysDrawn({ elementIds: new Set([keys.elementA1.id, keys.elementA2.id, keys.elementB.id]) });

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });

      await handler.changeVisibility(
        createElementHierarchyNode({
          modelId: keys.modelA.id,
          categoryId: keys.categoryA.id,
          elementId: elementToShow,
        }),
        true,
      );

      expect(viewport.alwaysDrawn).toEqual(new Set([elementToShow, keys.elementB.id]));
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.modelA.id]: "partial",
            [`${keys.modelA.id}-${keys.categoryA.id}`]: "partial",
              [elementToShow]: "visible",
              [keys.elementA2.id]: "hidden",

          [keys.modelB.id]: "hidden",
            [`${keys.modelB.id}-${keys.categoryB.id}`]: "hidden",
              [keys.elementB.id]: "hidden",
        },
      });
    });

    it("model gets hidden when elements from other model are added to the exclusive always drawn list", async () => {
      const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleModels;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: ["0x1"] }), true);
      viewport.setAlwaysDrawn({ elementIds: new Set([keys.elementA1.id]), exclusive: true });
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.modelA.id]: "partial",
            [`${keys.modelA.id}-${keys.categoryA.id}`]: "partial",
              [keys.elementA1.id]: "visible",
              [keys.elementA2.id]: "hidden",

          [keys.modelB.id]: "hidden",
            [`${keys.modelB.id}-${keys.categoryB.id}`]: "hidden",
              [keys.elementB.id]: "hidden",
        },
      });
    });

    it("model gets hidden when it has child only categories and elements from other model are added to the exclusive always drawn list", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const categoryId = insertSpatialCategory({ txn, codeValue: "category" }).id;
          const childCategoryId = insertSpatialCategory({ txn, codeValue: "childCategory" }).id;
          const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
          const exclusiveElement = insertPhysicalElement({ txn, modelId: model, categoryId }).id;
          const childElement = insertPhysicalElement({ txn, modelId: model, categoryId: childCategoryId, parentId: exclusiveElement }).id;

          const otherModel = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;
          const otherElement = insertPhysicalElement({ txn, modelId: otherModel, categoryId }).id;
          return { model, categoryId, exclusiveElement, childElement, otherModel, otherElement, childCategoryId };
        }),
      );

      const { imodelConnection, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({
        imodelConnection,
        hierarchyConfig,
        ...createAccessAndCache({ imodelConnection, hierarchyConfig }),
      });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: ["0x1"] }), true);
      viewport.setAlwaysDrawn({ elementIds: new Set([ids.exclusiveElement]), exclusive: true });
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [ids.model]: "partial",
            [`${ids.model}-${ids.categoryId}`]: "partial",
              [ids.exclusiveElement]: "partial",
                [`${ids.exclusiveElement}-${ids.childCategoryId}`]: "hidden",
                  [ids.childElement]: "hidden",

          [ids.otherModel]: "hidden",
            [`${ids.otherModel}-${ids.categoryId}`]: "hidden",
              [ids.otherElement]: "hidden",
        },
      });
    });

    it("hiding category in selector affects visibility", async () => {
      const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: IModel.rootSubjectId }), true);
      viewport.changeCategoryDisplay({ categoryIds: keys.category.id, display: true, enableAllSubCategories: true });
      viewport.renderFrame();

      await handler.changeVisibility(
        createCategoryHierarchyNode({
          modelId: keys.model.id,
          categoryId: keys.category.id,
          hasChildren: true,
        }),
        false,
      );

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
    });

    it("showing grouping node makes it, its grouped elements and children visible", async () => {
      const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(
        createClassGroupingHierarchyNode({
          modelId: keys.model.id,
          categoryId: keys.category.id,
          elements: [keys.parentElement.id],
        }),
        true,
      );

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: "all-visible",
      });
    });

    it("hiding grouping node makes it, its grouped elements and children hidden", async () => {
      const { imodelConnection, idsCache, imodelAccess, keys } = datasets.simple;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: IModel.rootSubjectId }), true);
      viewport.renderFrame();
      await handler.changeVisibility(
        createClassGroupingHierarchyNode({
          modelId: keys.model.id,
          categoryId: keys.category.id,
          elements: [keys.parentElement.id],
        }),
        false,
      );

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
    });

    it("changing merged category visibility changes child elements visibility", async () => {
      const { imodelConnection, idsCache, imodelAccess, keys } = datasets.mergedCategories;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(
        createCategoryHierarchyNode({
          modelId: keys.model.id,
          categoryId: [keys.category1.id, keys.category2.id],
          hasChildren: true,
        }),
        true,
      );

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    });

    it("changing element visibility changes merged parent category visibility", async () => {
      const { imodelConnection, keys, idsCache, imodelAccess } = datasets.mergedCategories;
      using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createElementHierarchyNode({ modelId: keys.model.id, categoryId: keys.category1.id, elementId: keys.element2.id }), true);

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.model.id]: "partial",
            // Validation uses first category id to check expected visibility
            [`${keys.model.id}-${keys.category1.id}`]: "partial",
              [keys.element1.id]: "hidden",
              [keys.element2.id]: "visible",
        },
      });
      await handler.changeVisibility(
        createElementHierarchyNode({
          modelId: keys.model.id,
          categoryId: keys.category1.id,
          elementId: keys.element1.id,
        }),
        true,
      );
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    });

    describe("intermediate categories", () => {
      it("showing parent element only adds children with non-matching categories to always drawn", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const visibleCategory = insertSpatialCategory({ txn, codeValue: "visibleCategory" }).id;
            const hiddenCategory = insertSpatialCategory({ txn, codeValue: "hiddenCategory" }).id;
            const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
            const parentElement = insertPhysicalElement({ txn, modelId: model, categoryId: visibleCategory }).id;
            const childInVisibleCategory = insertPhysicalElement({ txn, modelId: model, categoryId: visibleCategory, parentId: parentElement }).id;
            const childInHiddenCategory = insertPhysicalElement({ txn, modelId: model, categoryId: hiddenCategory, parentId: parentElement }).id;
            return { model, visibleCategory, hiddenCategory, parentElement, childInVisibleCategory, childInHiddenCategory };
          }),
        );

        const { imodelConnection, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({
          imodelConnection,
          hierarchyConfig,
          ...createAccessAndCache({ imodelConnection, hierarchyConfig }),
        });
        const { handler, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: ids.model, display: true });
        // visibleCategory is shown, hiddenCategory is hidden
        viewport.changeCategoryDisplay({ categoryIds: ids.visibleCategory, display: true, enableAllSubCategories: true });
        // All elements start in never drawn
        viewport.setNeverDrawn({ elementIds: new Set([ids.parentElement, ids.childInVisibleCategory, ids.childInHiddenCategory]) });
        viewport.renderFrame();

        await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.visibleCategory, elementId: ids.parentElement }), true);

        // parentElement and childInVisibleCategory: their category is visible, on=true matches default → removed from neverDrawn
        // childInHiddenCategory: its category is hidden, on=true doesn't match → added to alwaysDrawn
        expect(viewport.neverDrawn?.size ?? 0).toBe(0);
        expect(viewport.alwaysDrawn).toEqual(new Set([ids.childInHiddenCategory]));
      });

      it("model visibility takes into account all element categories", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.intermediateCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, viewport, ...props } = visibilityTestData;
        const parentCategoryNode = createCategoryHierarchyNode({
          modelId: keys.model.id,
          categoryId: keys.categoryA.id,
        });

        await handler.changeVisibility(parentCategoryNode, true);
        await validateModelsTreeHierarchyVisibility({
          ...props,
          handler,
          viewport,
          expectations: "all-visible",
        });
      });

      it("model visibility takes into account all element categories when some elements are in always drawn list", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.intermediateCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, viewport, ...props } = visibilityTestData;
        const parentCategoryNode = createCategoryHierarchyNode({ modelId: keys.model.id, categoryId: keys.categoryA.id, hasChildren: true });
        await handler.changeVisibility(parentCategoryNode, true);
        viewport.setAlwaysDrawn({ elementIds: new Set([...(viewport.alwaysDrawn ?? []), keys.elementA.id]) });
        await validateModelsTreeHierarchyVisibility({
          ...props,
          handler,
          viewport,
          expectations: "all-visible",
        });
      });

      it("changing category visibility of hidden model does not turn on unrelated elements", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const category1 = insertSpatialCategory({ txn, codeValue: "category1" });
            const category2 = insertSpatialCategory({ txn, codeValue: "category2" });
            const childCategory = insertSpatialCategory({ txn, codeValue: "childCategory" });
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });

            const parentElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: category1.id });
            const element2 = insertPhysicalElement({ txn, modelId: model.id, categoryId: category2.id });
            const childElementWithDifferentCategory = insertPhysicalElement({
              txn,
              modelId: model.id,
              categoryId: childCategory.id,
              parentId: parentElement.id,
            });
            return {
              modelId: model.id,
              category1Id: category1.id,
              parentElementId: parentElement.id,
              childCategoryId: childCategory.id,
              childElementWithDifferentCategoryId: childElementWithDifferentCategory.id,
              element2Id: element2.id,
              category2Id: category2.id,
            };
          }),
        );
        const { imodelConnection, modelId, category1Id, parentElementId, childCategoryId, childElementWithDifferentCategoryId, element2Id, category2Id } =
          buildIModelResult;
        using visibilityTestData = createVisibilityTestData({
          imodelConnection,
          hierarchyConfig,
          ...createAccessAndCache({ imodelConnection, hierarchyConfig }),
        });
        const { handler, viewport, ...props } = visibilityTestData;
        const modelNode = createModelHierarchyNode({ modelId, hasChildren: true });
        // Make child category enabled through category selector
        viewport.changeCategoryDisplay({ categoryIds: childCategoryId, display: true });
        await handler.changeVisibility(modelNode, false);

        const parentCategoryNode = createCategoryHierarchyNode({
          modelId,
          categoryId: category1Id,
        });
        // Changing category for hidden model should put all other categories into Hide overrides
        await handler.changeVisibility(parentCategoryNode, true);
        await validateModelsTreeHierarchyVisibility({
          ...props,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [modelId]: "partial",
              [`${modelId}-${category1Id}`]: "visible",
                [parentElementId]: "visible",
                  [`${parentElementId}-${childCategoryId}`]: "visible",
                    [childElementWithDifferentCategoryId]: "visible",

              [`${modelId}-${category2Id}`]: "hidden",
                [element2Id]: "hidden",
          },
        });
      });

      it("changing category visibility turns on child elements that have the same category", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const sharedCategory = insertSpatialCategory({ txn, codeValue: "parentCategory" });
            const parentCategory = insertSpatialCategory({ txn, codeValue: "parentCategory2" });
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });

            const elementWithSharedCategory = insertPhysicalElement({ txn, modelId: model.id, categoryId: sharedCategory.id });
            const parentElement2 = insertPhysicalElement({ txn, modelId: model.id, categoryId: parentCategory.id });
            const childElementWithSharedCategory = insertPhysicalElement({
              txn,
              modelId: model.id,
              categoryId: sharedCategory.id,
              parentId: parentElement2.id,
            });
            return {
              modelId: model.id,
              parentCategoryId: parentCategory.id,
              parentElementId: parentElement2.id,
              sharedCategoryId: sharedCategory.id,
              elementWithSharedCategoryId: elementWithSharedCategory.id,
              childElementWithSharedCategoryId: childElementWithSharedCategory.id,
            };
          }),
        );
        const {
          imodelConnection,
          modelId,
          parentCategoryId,
          parentElementId,
          sharedCategoryId,
          elementWithSharedCategoryId,
          childElementWithSharedCategoryId,
        } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({
          imodelConnection,
          hierarchyConfig,
          ...createAccessAndCache({ imodelConnection, hierarchyConfig }),
        });
        const { handler, viewport, ...props } = visibilityTestData;

        const sharedCategoryNode = createCategoryHierarchyNode({
          modelId,
          categoryId: sharedCategoryId,
          hasChildren: true,
        });
        // Changing category for hidden model should put all other categories into Hide overrides
        await handler.changeVisibility(sharedCategoryNode, true);

        await validateModelsTreeHierarchyVisibility({
          ...props,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [modelId]: "partial",
              [`${modelId}-${sharedCategoryId}`]: "visible",
                [elementWithSharedCategoryId]: "visible",

              [`${modelId}-${parentCategoryId}`]: "partial",
                [parentElementId]: "partial",
                  [`${parentElementId}-${sharedCategoryId}`]: "visible",
                    [childElementWithSharedCategoryId]: "visible",
          },
        });
      });

      it("category visibility only takes into account element trees that start with those that have no parents", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const category = insertSpatialCategory({ txn, codeValue: "parentCategory" });
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
            const element = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });

            const unrelatedParentCategory = insertSpatialCategory({ txn, codeValue: "differentParentCategory" });
            const unrelatedParentElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: unrelatedParentCategory.id });
            const childOfUnrelatedElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, parentId: unrelatedParentElement.id });

            return {
              modelId: model.id,
              categoryId: category.id,
              elementId: element.id,
              unrelatedCategoryId: unrelatedParentCategory.id,
              unrelatedParentElementId: unrelatedParentElement.id,
              childOfUnrelatedElementId: childOfUnrelatedElement.id,
            };
          }),
        );
        const { imodelConnection, modelId, categoryId, elementId, unrelatedParentElementId, childOfUnrelatedElementId, unrelatedCategoryId } =
          buildIModelResult;
        using visibilityTestData = createVisibilityTestData({
          imodelConnection,
          hierarchyConfig,
          ...createAccessAndCache({ imodelConnection, hierarchyConfig }),
        });
        const { handler, viewport, ...testProps } = visibilityTestData;
        const elementNode = createElementHierarchyNode({
          modelId,
          categoryId,
          elementId,
        });

        await handler.changeVisibility(elementNode, true);

        await validateModelsTreeHierarchyVisibility({
          ...testProps,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [modelId]: "partial",
              [`${modelId}-${categoryId}`]: "visible",
                [elementId]: "visible",

              [`${modelId}-${unrelatedCategoryId}`]: "hidden",
                [unrelatedParentElementId]: "hidden",
                  [`${unrelatedParentElementId}-${categoryId}`]: "hidden",
                    [childOfUnrelatedElementId]: "hidden",
          },
        });
      });

      it("parent element visibility is partial when its category is hidden but child element category is visible", async () => {
        const { imodelConnection, imodelAccess, idsCache, keys } = datasets.intermediateCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, viewport, ...props } = visibilityTestData;

        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
        viewport.clearPerModelCategoryOverrides();
        viewport.changeCategoryDisplay({ categoryIds: keys.categoryA.id, display: false });
        viewport.changeCategoryDisplay({ categoryIds: keys.categoryB.id, display: true });
        viewport.clearNeverDrawn();
        viewport.clearAlwaysDrawn();
        await validateModelsTreeHierarchyVisibility({
          ...props,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.model.id]: "partial",
              [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                [keys.elementA.id]: "partial",
                  [`${keys.elementA.id}-${keys.categoryB.id}`]: "visible",
                    [keys.childElementB.id]: "visible",
          },
        });
      });

      describe("enabling visibility", () => {
        it("showing intermediate category makes its elements visible", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.intermediateCategories;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createCategoryHierarchyNode({
              modelId: keys.model.id,
              categoryId: keys.categoryB.id,
              hasChildren: true,
              parentElementsPath: [{ elementIds: [keys.elementA.id], categoryIds: keys.categoryA.id }],
            }),
            true,
          );

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.elementA.id]: "partial",
                    [`${keys.elementA.id}-${keys.categoryB.id}`]: "visible",
                      [keys.childElementB.id]: "visible",
            },
          });
        });

        it("showing element under intermediate category makes it visible", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.intermediateCategories;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: keys.model.id,
              categoryId: keys.categoryB.id,
              elementId: keys.childElementB.id,
              parentElementsPath: [{ elementIds: [keys.elementA.id], categoryIds: keys.categoryA.id }],
            }),
            true,
          );

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.elementA.id]: "partial",
                    [`${keys.elementA.id}-${keys.categoryB.id}`]: "visible",
                      [keys.childElementB.id]: "visible",
            },
          });
        });

        it("showing parent element makes children under intermediate category visible", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.intermediateCategories;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: keys.model.id,
              categoryId: keys.categoryA.id,
              elementId: keys.elementA.id,
              hasChildren: true,
            }),
            true,
          );

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-visible",
          });
        });
      });

      describe("disabling visibility", () => {
        it("hiding intermediate category makes its elements hidden", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.intermediateCategories;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig, visibleByDefault: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createCategoryHierarchyNode({
              modelId: keys.model.id,
              categoryId: keys.categoryB.id,
              hasChildren: true,
              parentElementsPath: [{ elementIds: [keys.elementA.id], categoryIds: keys.categoryA.id }],
            }),
            false,
          );

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.elementA.id]: "partial",
                    [`${keys.elementA.id}-${keys.categoryB.id}`]: "hidden",
                      [keys.childElementB.id]: "hidden",
            },
          });
        });

        it("hiding element under intermediate category makes it hidden", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.intermediateCategories;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig, visibleByDefault: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: keys.model.id,
              categoryId: keys.categoryB.id,
              elementId: keys.childElementB.id,
              parentElementsPath: [{ elementIds: [keys.elementA.id], categoryIds: keys.categoryA.id }],
            }),
            false,
          );

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [keys.model.id]: "partial",
                [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                  [keys.elementA.id]: "partial",
                    [`${keys.elementA.id}-${keys.categoryB.id}`]: "hidden",
                      [keys.childElementB.id]: "hidden",
            },
          });
        });

        it("hiding parent element makes children under intermediate category visible", async () => {
          const { imodelConnection, idsCache, imodelAccess, keys } = datasets.intermediateCategories;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, visibleByDefault: true });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: keys.model.id,
              categoryId: keys.categoryA.id,
              elementId: keys.elementA.id,
              hasChildren: true,
            }),
            false,
          );

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-hidden",
          });
        });
      });
    });

    describe("reacting to category selector", () => {
      it("showing category via the selector makes category and all elements visible when it has no always or never drawn elements", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-hidden",
        });

        viewport.changeCategoryDisplay({ categoryIds: [keys.categoryA.id, keys.categoryB.id], display: true, enableAllSubCategories: true });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-visible",
        });
      });

      it("hiding category via the selector makes category and all elements hidden when it has no always or never drawn elements", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
        viewport.changeCategoryDisplay({ categoryIds: [keys.categoryA.id, keys.categoryB.id], display: true, enableAllSubCategories: true });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-visible",
        });

        viewport.changeCategoryDisplay({ categoryIds: [keys.categoryA.id, keys.categoryB.id], display: false });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-hidden",
        });
      });

      it("hiding category via the selector makes it hidden when it only has never drawn elements", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
        viewport.changeCategoryDisplay({ categoryIds: [keys.categoryA.id], display: true, enableAllSubCategories: true });
        viewport.setNeverDrawn({ elementIds: new Set([keys.elementA1.id]) });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.model.id]: "partial",
              [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                [keys.elementA1.id]: "hidden",
                [keys.elementA2.id]: "visible",

              [`${keys.model.id}-${keys.categoryB.id}`]: "hidden",
                [keys.elementB1.id]: "hidden",
                [keys.elementB2.id]: "hidden",
          },
        });

        viewport.changeCategoryDisplay({ categoryIds: [keys.categoryA.id], display: false });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-hidden",
        });
      });

      it("showing category via the selector makes it visible when it only has always drawn elements", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
        viewport.changeCategoryDisplay({ categoryIds: keys.categoryB.id, display: true, enableAllSubCategories: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([keys.elementA1.id]) });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.model.id]: "partial",
              [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                [keys.elementA1.id]: "visible",
                [keys.elementA2.id]: "hidden",

              [`${keys.model.id}-${keys.categoryB.id}`]: "visible",
                [keys.elementB1.id]: "visible",
                [keys.elementB2.id]: "visible",
          },
        });

        viewport.changeCategoryDisplay({ categoryIds: keys.categoryA.id, display: true, enableAllSubCategories: true });
        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-visible",
        });
      });

      it("model is visible if category is disabled in selector but all category's elements are always drawn", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
        viewport.changeCategoryDisplay({ categoryIds: [keys.categoryA.id, keys.categoryB.id], display: true, enableAllSubCategories: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([keys.elementA1.id, keys.elementA2.id]) });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-visible",
        });

        viewport.changeCategoryDisplay({ categoryIds: keys.categoryA.id, display: false });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-visible",
        });
      });

      it("model is hidden if category is enabled in selector but all category's elements are never drawn", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
        viewport.setNeverDrawn({ elementIds: new Set([keys.elementA1.id, keys.elementA2.id]) });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-hidden",
        });

        viewport.changeCategoryDisplay({ categoryIds: keys.categoryA.id, display: true, enableAllSubCategories: true });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-hidden",
        });
      });
    });

    describe("Custom Hierarchy configuration", () => {
      describe("subject with empty model", () => {
        const node = createSubjectHierarchyNode({ ids: [IModel.rootSubjectId] });

        it("empty model hidden by default", async () => {
          const { imodelConnection, idsCache, imodelAccess, customConfig } = datasets.customConfig;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, hierarchyConfig: customConfig, idsCache, imodelAccess });
          const { handler, provider, viewport } = visibilityTestData;

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-hidden",
          });
        });

        it("showing it makes empty model visible", async () => {
          const { imodelConnection, idsCache, imodelAccess, customConfig } = datasets.customConfig;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, hierarchyConfig: customConfig, idsCache, imodelAccess });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(node, true);
          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-visible",
          });
        });

        it("gets partial when only empty model is visible", async () => {
          const { imodelConnection, idsCache, imodelAccess, customConfig, ids } = datasets.customConfig;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, hierarchyConfig: customConfig, idsCache, imodelAccess });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createModelHierarchyNode({ modelId: ids.emptyModelId }), true);
          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [ids.emptyModelId]: "visible",

                [ids.configurationModelId]: "hidden",
                  [`${ids.configurationModelId}-${ids.configurationCategoryId}`]: "hidden",
                  [ids.customClassElement1]: "hidden",
                  [ids.customClassElement2]: "hidden",
            },
          });
        });
      });

      describe("model with custom class specification elements", () => {
        it("showing it makes it, all its categories and elements visible", async () => {
          const { imodelConnection, idsCache, imodelAccess, customConfig, ids } = datasets.customConfig;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, hierarchyConfig: customConfig, idsCache, imodelAccess });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createModelHierarchyNode({ modelId: ids.configurationModelId }), true);
          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [ids.emptyModelId]: "hidden",

                [ids.configurationModelId]: "visible",
                  [`${ids.configurationModelId}-${ids.configurationCategoryId}`]: "visible",
                    [ids.customClassElement1]: "visible",
                    [ids.customClassElement2]: "visible",
            },
          });
        });

        it("gets partial when custom class element is visible", async () => {
          const { imodelConnection, idsCache, imodelAccess, customConfig, ids } = datasets.customConfig;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, hierarchyConfig: customConfig, idsCache, imodelAccess });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: ids.configurationModelId,
              categoryId: ids.configurationCategoryId,
              hasChildren: true,
              elementId: ids.customClassElement1,
            }),
            true,
          );
          expect(viewport.alwaysDrawn).toEqual(new Set([ids.customClassElement1]));

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [ids.emptyModelId]: "hidden",

                [ids.configurationModelId]: "partial",
                  [`${ids.configurationModelId}-${ids.configurationCategoryId}`]: "partial",
                    [ids.customClassElement1]: "visible",
                    [ids.customClassElement2]: "hidden",
            },
          });
        });

        it("gets visible when all custom class elements are visible", async () => {
          const { imodelConnection, idsCache, imodelAccess, customConfig, ids } = datasets.customConfig;
          using visibilityTestData = createVisibilityTestData({ imodelConnection, hierarchyConfig: customConfig, idsCache, imodelAccess });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: ids.configurationModelId,
              categoryId: ids.configurationCategoryId,
              hasChildren: true,
              elementId: ids.customClassElement1,
            }),
            true,
          );
          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: ids.configurationModelId,
              categoryId: ids.configurationCategoryId,
              hasChildren: true,
              elementId: ids.customClassElement2,
            }),
            true,
          );
          expect(viewport.alwaysDrawn).toEqual(new Set([ids.customClassElement1, ids.customClassElement2]));

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [ids.emptyModelId]: "hidden",

                [ids.configurationModelId]: "visible",
                  [`${ids.configurationModelId}-${ids.configurationCategoryId}`]: "visible",
                    [ids.customClassElement1]: "visible",
                    [ids.customClassElement2]: "visible",
            },
          });
        });
      });
    });

    describe("IsAlwaysDrawnExclusive is true", () => {
      it("changing model visibility does not affect other models", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleModels;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: keys.modelA.id, display: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([keys.elementA2.id]), exclusive: true });

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.modelA.id]: "partial",
              [`${keys.modelA.id}-${keys.categoryA.id}`]: "partial",
                [keys.elementA1.id]: "hidden",
                [keys.elementA2.id]: "visible",

            [keys.modelB.id]: "hidden",
              [`${keys.modelB.id}-${keys.categoryB.id}`]: "hidden",
                [keys.elementB.id]: "hidden",
          },
        });
        await handler.changeVisibility(createModelHierarchyNode({ modelId: keys.modelA.id }), true);

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.modelA.id]: "visible",
              [`${keys.modelA.id}-${keys.categoryA.id}`]: "visible",
                [keys.elementA1.id]: "visible",
                [keys.elementA2.id]: "visible",

            [keys.modelB.id]: "hidden",
              [`${keys.modelB.id}-${keys.categoryB.id}`]: "hidden",
                [keys.elementB.id]: "hidden",
          },
        });
      });

      it("changing category visibility does not affect other categories", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.multipleCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([keys.elementA2.id]), exclusive: true });

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.model.id]: "partial",
              [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                [keys.elementA1.id]: "hidden",
                [keys.elementA2.id]: "visible",

              [`${keys.model.id}-${keys.categoryB.id}`]: "hidden",
                [keys.elementB1.id]: "hidden",
                [keys.elementB2.id]: "hidden",
          },
        });
        await handler.changeVisibility(createCategoryHierarchyNode({ modelId: keys.model.id, categoryId: keys.categoryA.id, hasChildren: true }), true);

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.model.id]: "partial",
              [`${keys.model.id}-${keys.categoryA.id}`]: "visible",
                [keys.elementA1.id]: "visible",
                [keys.elementA2.id]: "visible",

              [`${keys.model.id}-${keys.categoryB.id}`]: "hidden",
                [keys.elementB1.id]: "hidden",
                [keys.elementB2.id]: "hidden",
          },
        });
      });

      it("changing class grouping node visibility does not affect other class grouping nodes", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, (txn) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: "1" }).id;
            const category = insertSpatialCategory({ txn, codeValue: "category1" }).id;
            const element1 = insertPhysicalElement({ txn, modelId: model, categoryId: category }).id;
            const element2 = insertPhysicalElement({ txn, modelId: model, categoryId: category }).id;

            const elementOfOtherClass = insertPhysicalElement({
              txn,
              userLabel: `element`,
              modelId: model,
              categoryId: category,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            }).id;

            return { model, category, element1, element2, elementOfOtherClass };
          }),
        );

        const { imodelConnection, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({
          imodelConnection,
          hierarchyConfig,
          ...createAccessAndCache({ imodelConnection, hierarchyConfig }),
        });
        const { handler, provider, viewport } = visibilityTestData;

        viewport.changeModelDisplay({ modelIds: ids.model, display: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([ids.element2]), exclusive: true });

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [ids.model]: "partial",
              [`${ids.model}-${ids.category}`]: "partial",
                [ids.element1]: "hidden",
                [ids.element2]: "visible",
                [ids.elementOfOtherClass]: "hidden",
          },
        });
        await handler.changeVisibility(
          createClassGroupingHierarchyNode({ elements: [ids.element1, ids.element2], categoryId: ids.category, modelId: ids.model }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [ids.model]: "partial",
              [`${ids.model}-${ids.category}`]: "partial",
                [ids.element1]: "visible",
                [ids.element2]: "visible",
                [ids.elementOfOtherClass]: "hidden",
          },
        });
      });

      it("changing element visibility does not affect other elements", async () => {
        const { imodelConnection, keys, idsCache, imodelAccess } = datasets.multipleCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, provider, viewport } = visibilityTestData;

        viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([keys.elementA2.id]), exclusive: true });

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.model.id]: "partial",
              [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                [keys.elementA1.id]: "hidden",
                [keys.elementA2.id]: "visible",

              [`${keys.model.id}-${keys.categoryB.id}`]: "hidden",
                [keys.elementB1.id]: "hidden",
                [keys.elementB2.id]: "hidden",
          },
        });
        await handler.changeVisibility(
          createElementHierarchyNode({ elementId: keys.elementA1.id, categoryId: keys.categoryA.id, modelId: keys.model.id }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.model.id]: "partial",
              [`${keys.model.id}-${keys.categoryA.id}`]: "visible",
                [keys.elementA1.id]: "visible",
                [keys.elementA2.id]: "visible",

              [`${keys.model.id}-${keys.categoryB.id}`]: "hidden",
                [keys.elementB1.id]: "hidden",
                [keys.elementB2.id]: "hidden",
          },
        });
      });
    });

    it("element of an excluded class still participates in visibility", async () => {
      const { imodelConnection, keys } = datasets.simple;
      const customConfig: ModelsTreeHierarchyConfiguration = mergeWithDefaults({
        defaults: defaultHierarchyConfiguration,
        overrides: {
          subjects: { root: "exclude" },
          models: { withoutElements: "include" },
          elements: { excludedClasses: [CLASS_NAME_GeometricElement3d] },
        },
      });
      using visibilityTestData = createVisibilityTestData({
        imodelConnection,
        hierarchyConfig: customConfig,
        ...createAccessAndCache({ imodelConnection, hierarchyConfig: customConfig }),
      });
      const { handler, viewport, provider } = visibilityTestData;

      viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });

      const subjectNode = createSubjectHierarchyNode({ ids: [IModel.rootSubjectId] });
      await handler.changeVisibility(subjectNode, true);

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });

      viewport.setNeverDrawn({ elementIds: new Set([keys.parentElement.id]) });

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.model.id]: "partial",
        },
      });
    });
  });
});

async function validateModelsTreeHierarchyVisibility(props: Omit<Props<typeof validateHierarchyVisibility>, "validateNodeVisibility">) {
  return validateHierarchyVisibility({
    ...props,
    validateNodeVisibility,
  });
}

async function createDatasets() {
  const imodels: IModelConnection[] = [];

  return {
    [Symbol.asyncDispose]: async () => Promise.all(imodels.map(async (imodel) => imodel.close())),
    ["simple"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const category = insertSpatialCategory({ txn, codeValue: "category" });
          const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "m" });
          const parentElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, codeValue: "el" });
          const childElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, codeValue: "child el", parentId: parentElement.id });
          return { category, model, parentElement, childElement };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }) };
    })(),
    ["multipleCategories"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });

          const categoryA = insertSpatialCategory({ txn, codeValue: "categoryA" });
          const elementA1 = insertPhysicalElement({ txn, categoryId: categoryA.id, modelId: model.id });
          const elementA2 = insertPhysicalElement({ txn, categoryId: categoryA.id, modelId: model.id });

          const categoryB = insertSpatialCategory({ txn, codeValue: "categoryB" });
          const elementB1 = insertPhysicalElement({ txn, categoryId: categoryB.id, modelId: model.id });
          const elementB2 = insertPhysicalElement({ txn, categoryId: categoryB.id, modelId: model.id });
          return { categoryA, categoryB, model, elementA1, elementA2, elementB1, elementB2 };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }) };
    })(),
    ["multipleModels"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const categoryA = insertSpatialCategory({ txn, codeValue: "categoryA" });
          const categoryB = insertSpatialCategory({ txn, codeValue: "categoryB" });
          const modelA = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "mA" });
          const modelB = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "mB" });
          const elementA1 = insertPhysicalElement({ txn, modelId: modelA.id, categoryId: categoryA.id, codeValue: "elA1" });
          const elementA2 = insertPhysicalElement({ txn, modelId: modelA.id, categoryId: categoryA.id, codeValue: "elA2" });
          const elementB = insertPhysicalElement({ txn, modelId: modelB.id, categoryId: categoryB.id, codeValue: "elB" });
          return { categoryA, categoryB, modelA, modelB, elementA1, elementA2, elementB };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }) };
    })(),
    ["intermediateCategories"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const categoryA = insertSpatialCategory({ txn, codeValue: "catA" });
          const categoryB = insertSpatialCategory({ txn, codeValue: "catB" });
          const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "m" });
          const elementA = insertPhysicalElement({ txn, modelId: model.id, categoryId: categoryA.id, codeValue: "elA" });
          const childElementB = insertPhysicalElement({ txn, modelId: model.id, categoryId: categoryB.id, codeValue: "elB", parentId: elementA.id });
          return { categoryA, categoryB, model, elementA, childElementB };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }) };
    })(),
    ["mergedCategories"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const model = insertPhysicalModelWithPartition({ txn, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
          const category1 = insertSpatialCategory({ txn, codeValue: "category1", userLabel: "SomeLabel" });
          const category2 = insertSpatialCategory({ txn, codeValue: "category2", userLabel: "SomeLabel" });
          const element1 = insertPhysicalElement({ txn, modelId: model.id, categoryId: category1.id });
          const element2 = insertPhysicalElement({ txn, modelId: model.id, categoryId: category2.id });
          return { model, element1, element2, category1, category2 };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection, hierarchyConfig: { subjects: { root: "exclude" } } }) };
    })(),
    ["customConfig"]: await (async () => {
      const { imodelConnection, ...rest } = await buildIModel(async (imodel, schema) =>
        withEditTxn(imodel, (txn) => {
          /**
           * Creates physical model that has one spatial category that contains contains 3 child elements
           * out of which the first and second belong to the same custom class while the last element is of class `PhysicalObject`
           */
          const emptyPartitionId = insertPhysicalPartition({ txn, codeValue: "empty m", parentId: IModel.rootSubjectId }).id;
          const emptyModelId = insertPhysicalSubModel({ txn, modeledElementId: emptyPartitionId }).id;

          const customClassName = schema.items.SubModelablePhysicalObject.fullName;

          const partitionId = insertPhysicalPartition({ txn, codeValue: "config m ", parentId: IModel.rootSubjectId }).id;
          const configurationModelId = insertPhysicalSubModel({ txn, modeledElementId: partitionId }).id;
          const modelCategories = new Array<string>();

          const configurationCategoryId = insertSpatialCategory({ txn, codeValue: `config cat` }).id;
          modelCategories.push(configurationCategoryId);
          const elements = new Array<Id64String>();

          for (let childIdx = 0; childIdx < 2; ++childIdx) {
            const props: GeometricElement3dProps = {
              model: configurationModelId,
              category: configurationCategoryId,
              code: new Code({ scope: partitionId, spec: "", value: `Configuration_${customClassName}_${childIdx}` }),
              classFullName: customClassName,
            };
            elements.push(txn.insertElement(props));
          }
          const [customClassElement1, customClassElement2] = elements;

          const hierarchyConfig: RequiredModelsTreeHierarchyConfiguration = mergeWithDefaults({
            defaults: defaultHierarchyConfiguration,
            overrides: {
              models: { withoutElements: "include" as const },
              elements: { baseClass: customClassName },
            },
          });

          return {
            ids: {
              configurationModelId,
              configurationCategoryId,
              elements,
              customClassElement1,
              customClassElement2,
              modelCategories,
              emptyModelId,
            },
            customClassName,
            customConfig: hierarchyConfig,
          };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, ...rest, ...createAccessAndCache({ imodelConnection, hierarchyConfig: rest.customConfig }) };
    })(),
  };
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import { assert } from "@itwin/core-bentley";
import { Code, ColorDef, IModel, RenderMode } from "@itwin/core-common";
import { DrawingViewState, IModelApp, OffScreenViewport, SpatialViewState, ViewRect } from "@itwin/core-frontend";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { ClassificationsTreeDefinition } from "../../../tree-widget-react/components/trees/classifications-tree/ClassificationsTreeDefinition.js";
import { ClassificationsTreeIdsCache } from "../../../tree-widget-react/components/trees/classifications-tree/internal/ClassificationsTreeIdsCache.js";
import { createClassificationsTreeVisibilityHandler } from "../../../tree-widget-react/components/trees/classifications-tree/internal/ClassificationsTreeVisibilityHandler.js";
import {
  buildIModel,
  insertDrawingCategory,
  insertDrawingGraphic,
  insertDrawingModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
} from "../../IModelUtils.js";
import { initializeITwinJs, terminateITwinJs } from "../../Initialize.js";
import { createIModelAccess } from "../Common.js";
import {
  createClassificationHierarchyNode,
  createClassificationTableHierarchyNode,
  createDrawingElementHierarchyNode,
  createPhysicalElementHierarchyNode,
} from "./HierarchyNodeUtils.js";
import {
  importClassificationSchema,
  insertClassification,
  insertClassificationSystem,
  insertClassificationTable,
  insertElementHasClassificationsRelationship,
} from "./Utils.js";
import { validateHierarchyVisibility } from "./VisibilityValidation.js";

import type { HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";

describe("ClassificationsTreeVisibilityHandler", () => {
  before(async () => {
    await initializeITwinJs();
  });

  after(async () => {
    await terminateITwinJs();
  });

  const rootClassificationSystemCode = "TestClassificationSystem";

  function createProvider(props: {
    idsCache: ClassificationsTreeIdsCache;
    imodelAccess: ReturnType<typeof createIModelAccess>;
    filterPaths?: HierarchyNodeIdentifiersPath[];
  }) {
    return createIModelHierarchyProvider({
      hierarchyDefinition: new ClassificationsTreeDefinition({ ...props, hierarchyConfig: { rootClassificationSystemCode } }),
      imodelAccess: props.imodelAccess,
      ...(props.filterPaths ? { filtering: { paths: props.filterPaths } } : undefined),
    });
  }

  async function createVisibilityTestData({
    imodel,
    view,
    categoryIds,
    modelIds,
  }: {
    imodel: IModelConnection;
    view: "2d" | "3d";
    categoryIds: Id64Array;
    modelIds: Id64Array;
  }) {
    const imodelAccess = createIModelAccess(imodel);
    const idsCache = new ClassificationsTreeIdsCache(imodelAccess, { rootClassificationSystemCode });
    const viewport = OffScreenViewport.create({
      view: view === "3d" ? await createSpatialViewState(imodel, categoryIds, modelIds) : await createDrawingViewState(imodel, categoryIds, modelIds),
      viewRect: new ViewRect(),
    });
    const handler = createClassificationsTreeVisibilityHandler({ idsCache, viewport, imodelAccess });
    const provider = createProvider({ idsCache, imodelAccess });
    return {
      handler,
      provider,
      imodel,
      imodelAccess,
      viewport,
      [Symbol.dispose]() {
        idsCache[Symbol.dispose]();
        viewport[Symbol.dispose]();
        handler[Symbol.dispose]();
        provider[Symbol.dispose]();
      },
    };
  }

  describe("enabling visibility", () => {
    it("by default everything is hidden in 3d view with 3d elements' hierarchy", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "TestClassification" });

        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model" });
        const spatialCategory = insertSpatialCategory({ builder, codeValue: "Test spatial category" });
        const parentPhysicalElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "Parent 3d element",
        });
        const childPhysicalElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          parentId: parentPhysicalElement.id,
          codeValue: "Child 3d element",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement.id, classificationId: classification.id });

        return { table, classification, physicalModel, spatialCategory, parentPhysicalElement, childPhysicalElement };
      });

      const { imodel, ...keys } = buildIModelResult;

      using visibilityTestData = await createVisibilityTestData({
        imodel,
        view: "3d",
        categoryIds: [keys.spatialCategory.id],
        modelIds: [keys.physicalModel.id],
      });
      const { handler, provider, viewport } = visibilityTestData;
      await setupInitialDisplayState({ viewport, ...createHiddenTestData(keys) });

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
    });

    it("by default everything is hidden in 2d view with 2d elements' hierarchy", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "TestClassification" });

        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "Test drawing model" });
        const drawingCategory = insertDrawingCategory({ builder, codeValue: "Test drawing category" });
        const parentDrawingElement = insertDrawingGraphic({
          builder,
          modelId: drawingModel.id,
          categoryId: drawingCategory.id,
          codeValue: "Parent 2d element",
        });
        const childDrawingElement = insertDrawingGraphic({
          builder,
          modelId: drawingModel.id,
          categoryId: drawingCategory.id,
          parentId: parentDrawingElement.id,
          codeValue: "Child 2d element",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: parentDrawingElement.id, classificationId: classification.id });

        return { table, classification, drawingModel, drawingCategory, parentDrawingElement, childDrawingElement };
      });

      const { imodel, ...keys } = buildIModelResult;

      using visibilityTestData = await createVisibilityTestData({
        imodel,
        view: "2d",
        categoryIds: [keys.drawingCategory.id],
        modelIds: [keys.drawingModel.id],
      });
      const { handler, provider, viewport } = visibilityTestData;
      await setupInitialDisplayState({ viewport, ...createHiddenTestData(keys) });

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
    });

    describe("classification table", () => {
      it("showing classification table makes contained elements under it visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
          const classification = insertClassification({ builder, modelId: table.id, codeValue: "TestClassification" });

          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model" });
          const spatialCategory = insertSpatialCategory({ builder, codeValue: "Test spatial category" });
          const parentPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Parent 3d element",
          });
          const childPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            parentId: parentPhysicalElement.id,
            codeValue: "Child 3d element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement.id, classificationId: classification.id });

          return { table, classification, physicalModel, spatialCategory, parentPhysicalElement, childPhysicalElement };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          view: "3d",
          categoryIds: [keys.spatialCategory.id],
          modelIds: [keys.physicalModel.id],
        });
        const { handler, provider, viewport } = visibilityTestData;
        await setupInitialDisplayState({ viewport, ...createHiddenTestData(keys) });

        await handler.changeVisibility(createClassificationTableHierarchyNode({ id: keys.table.id }), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-visible",
        });
      });
    });

    describe("classification", () => {
      it("showing classification makes all ancestors and contained elements under it visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
          const parentClassification = insertClassification({ builder, modelId: table.id, codeValue: "Parent classification" });
          const childClassification = insertClassification({
            builder,
            modelId: table.id,
            parentId: parentClassification.id,
            codeValue: "Child classification",
          });

          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model" });
          const spatialCategory = insertSpatialCategory({ builder, codeValue: "Test spatial category" });
          const parentPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Parent 3d element",
          });
          const childPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            parentId: parentPhysicalElement.id,
            codeValue: "Child 3d element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement.id, classificationId: childClassification.id });

          return { table, parentClassification, childClassification, physicalModel, spatialCategory, parentPhysicalElement, childPhysicalElement };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          view: "3d",
          categoryIds: [keys.spatialCategory.id],
          modelIds: [keys.physicalModel.id],
        });
        const { handler, provider, viewport } = visibilityTestData;
        await setupInitialDisplayState({ viewport, ...createHiddenTestData(keys) });

        await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.childClassification.id }), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-visible",
        });
      });

      it("showing classification makes all ancestors partially visible, and contained elements under it visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
          const parentClassification = insertClassification({ builder, modelId: table.id, codeValue: "Parent classification" });
          const childClassification1 = insertClassification({
            builder,
            modelId: table.id,
            parentId: parentClassification.id,
            codeValue: "Child classification 1",
          });
          const childClassification2 = insertClassification({
            builder,
            modelId: table.id,
            parentId: parentClassification.id,
            codeValue: "Child classification 2",
          });

          const physicalModel1 = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model 1" });
          const spatialCategory1 = insertSpatialCategory({ builder, codeValue: "Test spatial category 1" });
          const parentPhysicalElement1 = insertPhysicalElement({
            builder,
            modelId: physicalModel1.id,
            categoryId: spatialCategory1.id,
            codeValue: "Parent 3d element",
          });
          const childPhysicalElement1 = insertPhysicalElement({
            builder,
            modelId: physicalModel1.id,
            categoryId: spatialCategory1.id,
            parentId: parentPhysicalElement1.id,
            codeValue: "Child 3d element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement1.id, classificationId: childClassification1.id });

          const physicalModel2 = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model 2" });
          const spatialCategory2 = insertSpatialCategory({ builder, codeValue: "Test spatial category 2" });
          const parentPhysicalElement2 = insertPhysicalElement({
            builder,
            modelId: physicalModel2.id,
            categoryId: spatialCategory2.id,
            codeValue: "3d element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement2.id, classificationId: childClassification2.id });

          return {
            table,
            parentClassification,
            childClassification1,
            physicalModel1,
            spatialCategory1,
            parentPhysicalElement1,
            childPhysicalElement1,
            physicalModel2,
            spatialCategory2,
            parentPhysicalElement2,
            childClassification2,
          };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          view: "3d",
          categoryIds: [keys.spatialCategory1.id, keys.spatialCategory2.id],
          modelIds: [keys.physicalModel1.id, keys.physicalModel2.id],
        });
        const { handler, provider, viewport } = visibilityTestData;
        await setupInitialDisplayState({ viewport, ...createHiddenTestData(keys) });

        await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.childClassification1.id }), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.table.id]: "partial",
            [keys.parentClassification.id]: "partial",
            [keys.childClassification1.id]: "visible",
            [keys.parentPhysicalElement1.id]: "visible",
            [keys.childPhysicalElement1.id]: "visible",
            [keys.childClassification2.id]: "hidden",
            [keys.parentPhysicalElement2.id]: "hidden",
          },
        });
      });
    });

    describe("geometric element", () => {
      it("showing geometric element makes ancestors partially visible, and the element visible", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
          const parentClassification = insertClassification({ builder, modelId: table.id, codeValue: "Parent classification" });
          const childClassification = insertClassification({
            builder,
            modelId: table.id,
            parentId: parentClassification.id,
            codeValue: "Child classification",
          });

          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model" });
          const spatialCategory = insertSpatialCategory({ builder, codeValue: "Test spatial category" });
          const parentPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Parent 3d element",
          });
          const siblingPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            parentId: parentPhysicalElement.id,
            codeValue: "Sibling 3d element",
          });
          const targetPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            parentId: parentPhysicalElement.id,
            codeValue: "Target 3d element",
          });
          const childPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            parentId: targetPhysicalElement.id,
            codeValue: "Child 3d element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement.id, classificationId: childClassification.id });

          return {
            table,
            parentClassification,
            childClassification,
            physicalModel,
            spatialCategory,
            parentPhysicalElement,
            targetPhysicalElement,
            siblingPhysicalElement,
            childPhysicalElement,
          };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          view: "3d",
          categoryIds: [keys.spatialCategory.id],
          modelIds: [keys.physicalModel.id],
        });
        const { handler, provider, viewport } = visibilityTestData;
        await setupInitialDisplayState({ viewport, ...createHiddenTestData(keys) });

        await handler.changeVisibility(
          createPhysicalElementHierarchyNode({ id: keys.targetPhysicalElement.id, categoryId: keys.spatialCategory.id, modelId: keys.physicalModel.id }),
          true,
        );
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.table.id]: "partial",
            [keys.parentClassification.id]: "partial",
            [keys.childClassification.id]: "partial",
            [keys.parentPhysicalElement.id]: "hidden",
            [keys.siblingPhysicalElement.id]: "hidden",
            [keys.targetPhysicalElement.id]: "visible",
            [keys.childPhysicalElement.id]: "hidden",
          },
        });
      });
    });
  });

  describe("disabling visibility", () => {
    it("by default everything is visible in 3d view with 3d elements' hierarchy", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "TestClassification" });

        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model" });
        const spatialCategory = insertSpatialCategory({ builder, codeValue: "Test spatial category" });
        const parentPhysicalElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "Parent 3d element",
        });
        const childPhysicalElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          parentId: parentPhysicalElement.id,
          codeValue: "Child 3d element",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement.id, classificationId: classification.id });

        return { table, classification, physicalModel, spatialCategory, parentPhysicalElement, childPhysicalElement };
      });

      const { imodel, ...keys } = buildIModelResult;
      using visibilityTestData = await createVisibilityTestData({
        imodel,
        view: "3d",
        categoryIds: [keys.spatialCategory.id],
        modelIds: [keys.physicalModel.id],
      });
      const { handler, provider, viewport } = visibilityTestData;
      await setupInitialDisplayState({ viewport });

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    });

    it("by default everything is visible in 2d view with 2d elements' hierarchy", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "TestClassification" });

        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "Test drawing model" });
        const drawingCategory = insertDrawingCategory({ builder, codeValue: "Test drawing category" });
        const parentDrawingElement = insertDrawingGraphic({
          builder,
          modelId: drawingModel.id,
          categoryId: drawingCategory.id,
          codeValue: "Parent 2d element",
        });
        const childDrawingElement = insertDrawingGraphic({
          builder,
          modelId: drawingModel.id,
          categoryId: drawingCategory.id,
          parentId: parentDrawingElement.id,
          codeValue: "Child 2d element",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: parentDrawingElement.id, classificationId: classification.id });

        return { table, classification, drawingModel, drawingCategory, parentDrawingElement, childDrawingElement };
      });

      const { imodel, ...keys } = buildIModelResult;
      using visibilityTestData = await createVisibilityTestData({
        imodel,
        view: "2d",
        categoryIds: [keys.drawingCategory.id],
        modelIds: [keys.drawingModel.id],
      });
      const { handler, provider, viewport } = visibilityTestData;
      await setupInitialDisplayState({ viewport });

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    });

    describe("classification table", () => {
      it("hiding classification table makes contained elements under it hidden", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
          const classification = insertClassification({ builder, modelId: table.id, codeValue: "TestClassification" });

          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model" });
          const spatialCategory = insertSpatialCategory({ builder, codeValue: "Test spatial category" });
          const parentPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Parent 3d element",
          });
          const childPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            parentId: parentPhysicalElement.id,
            codeValue: "Child 3d element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement.id, classificationId: classification.id });

          return { table, classification, physicalModel, spatialCategory, parentPhysicalElement, childPhysicalElement };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          view: "3d",
          categoryIds: [keys.spatialCategory.id],
          modelIds: [keys.physicalModel.id],
        });
        const { handler, provider, viewport } = visibilityTestData;
        await setupInitialDisplayState({ viewport });

        await handler.changeVisibility(createClassificationTableHierarchyNode({ id: keys.table.id }), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: "all-hidden",
        });
      });
    });

    describe("classification", () => {
      it("hiding classification makes all ancestors partially visible, and contained elements under it hidden", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
          const parentClassification = insertClassification({ builder, modelId: table.id, codeValue: "Parent classification" });
          const childClassification1 = insertClassification({
            builder,
            modelId: table.id,
            parentId: parentClassification.id,
            codeValue: "Child classification 1",
          });
          const childClassification2 = insertClassification({
            builder,
            modelId: table.id,
            parentId: parentClassification.id,
            codeValue: "Child classification 2",
          });

          const physicalModel1 = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model 1" });
          const spatialCategory1 = insertSpatialCategory({ builder, codeValue: "Test spatial category 1" });
          const parentPhysicalElement1 = insertPhysicalElement({
            builder,
            modelId: physicalModel1.id,
            categoryId: spatialCategory1.id,
            codeValue: "Parent 3d element",
          });
          const childPhysicalElement1 = insertPhysicalElement({
            builder,
            modelId: physicalModel1.id,
            categoryId: spatialCategory1.id,
            parentId: parentPhysicalElement1.id,
            codeValue: "Child 3d element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement1.id, classificationId: childClassification1.id });

          const physicalModel2 = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model 2" });
          const spatialCategory2 = insertSpatialCategory({ builder, codeValue: "Test spatial category 2" });
          const parentPhysicalElement2 = insertPhysicalElement({
            builder,
            modelId: physicalModel2.id,
            categoryId: spatialCategory2.id,
            codeValue: "3d element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement2.id, classificationId: childClassification2.id });

          return {
            table,
            parentClassification,
            childClassification1,
            physicalModel1,
            spatialCategory1,
            parentPhysicalElement1,
            childPhysicalElement1,
            physicalModel2,
            spatialCategory2,
            parentPhysicalElement2,
            childClassification2,
          };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          view: "3d",
          categoryIds: [keys.spatialCategory1.id, keys.spatialCategory2.id],
          modelIds: [keys.physicalModel1.id, keys.physicalModel2.id],
        });
        const { handler, provider, viewport } = visibilityTestData;
        await setupInitialDisplayState({ viewport });

        await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.childClassification1.id }), false);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.table.id]: "partial",
            [keys.parentClassification.id]: "partial",
            [keys.childClassification1.id]: "hidden",
            [keys.parentPhysicalElement1.id]: "hidden",
            [keys.childPhysicalElement1.id]: "hidden",
            [keys.childClassification2.id]: "visible",
            [keys.parentPhysicalElement2.id]: "visible",
          },
        });
      });
    });

    describe("geometric element", () => {
      it("hiding geometric element makes ancestors partially visible, and the element hidden", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
          const parentClassification = insertClassification({ builder, modelId: table.id, codeValue: "Parent classification" });
          const childClassification = insertClassification({
            builder,
            modelId: table.id,
            parentId: parentClassification.id,
            codeValue: "Child classification",
          });

          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model" });
          const spatialCategory = insertSpatialCategory({ builder, codeValue: "Test spatial category" });
          const parentPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Parent 3d element",
          });
          const siblingPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            parentId: parentPhysicalElement.id,
            codeValue: "Sibling 3d element",
          });
          const targetPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            parentId: parentPhysicalElement.id,
            codeValue: "Target 3d element",
          });
          const childPhysicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            parentId: targetPhysicalElement.id,
            codeValue: "Child 3d element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement.id, classificationId: childClassification.id });

          return {
            table,
            parentClassification,
            childClassification,
            physicalModel,
            spatialCategory,
            parentPhysicalElement,
            targetPhysicalElement,
            siblingPhysicalElement,
            childPhysicalElement,
          };
        });

        const { imodel, ...keys } = buildIModelResult;

        using visibilityTestData = await createVisibilityTestData({
          imodel,
          view: "3d",
          categoryIds: [keys.spatialCategory.id],
          modelIds: [keys.physicalModel.id],
        });
        const { handler, provider, viewport } = visibilityTestData;
        await setupInitialDisplayState({ viewport });

        await handler.changeVisibility(
          createPhysicalElementHierarchyNode({ id: keys.targetPhysicalElement.id, categoryId: keys.spatialCategory.id, modelId: keys.physicalModel.id }),
          false,
        );
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectations: {
            [keys.table.id]: "partial",
            [keys.parentClassification.id]: "partial",
            [keys.childClassification.id]: "partial",
            [keys.parentPhysicalElement.id]: "visible",
            [keys.siblingPhysicalElement.id]: "visible",
            [keys.targetPhysicalElement.id]: "hidden",
            [keys.childPhysicalElement.id]: "visible",
          },
        });
      });
    });
  });

  describe("filtered nodes", () => {
    async function createFilteredVisibilityTestData({
      imodel,
      filterPaths,
      categoryIds,
      modelIds,
      view,
    }: Parameters<typeof createVisibilityTestData>[0] & {
      filterPaths: HierarchyNodeIdentifiersPath[];
      categoryIds: Id64Array;
      modelIds: Id64Array;
      view: "3d" | "2d";
    }) {
      const imodelAccess = createIModelAccess(imodel);
      const idsCache = new ClassificationsTreeIdsCache(imodelAccess, { rootClassificationSystemCode });
      const viewport = OffScreenViewport.create({
        view: view === "3d" ? await createSpatialViewState(imodel, categoryIds, modelIds) : await createDrawingViewState(imodel, categoryIds, modelIds),
        viewRect: new ViewRect(),
      });
      const handler = createClassificationsTreeVisibilityHandler({ idsCache, viewport, imodelAccess, filteredPaths: filterPaths });
      const defaultProvider = createProvider({ idsCache, imodelAccess });
      const filteredProvider = createProvider({ idsCache, imodelAccess, filterPaths });
      return {
        handler,
        defaultProvider,
        filteredProvider,
        imodel,
        imodelAccess,
        viewport,
        [Symbol.dispose]() {
          idsCache[Symbol.dispose]();
          viewport[Symbol.dispose]();
          handler[Symbol.dispose]();
          defaultProvider[Symbol.dispose]();
          filteredProvider[Symbol.dispose]();
        },
      };
    }

    it("showing filtered geometric element changes visibility for nodes in filter paths", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification" });

        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "physical model" });
        const spatialCategory = insertSpatialCategory({ builder, codeValue: "spatial category" });
        const element1 = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "3d element1",
        });
        const element2 = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "3d element2",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: element1.id, classificationId: classification.id });
        insertElementHasClassificationsRelationship({ builder, elementId: element2.id, classificationId: classification.id });

        return {
          table,
          classification,
          physicalModel,
          spatialCategory,
          element1,
          element2,
          filterPaths: [[table, classification, element1]],
        };
      });

      const { imodel, filterPaths, ...keys } = buildIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodel,
        filterPaths,
        view: "3d",
        categoryIds: [keys.spatialCategory.id],
        modelIds: [keys.physicalModel.id],
      });
      const { handler, viewport, defaultProvider, filteredProvider } = visibilityTestData;
      await setupInitialDisplayState({ viewport, ...createHiddenTestData(keys) });

      await handler.changeVisibility(
        createPhysicalElementHierarchyNode({
          id: keys.element1.id,
          categoryId: keys.spatialCategory.id,
          modelId: keys.physicalModel.id,
          filtering: {
            isFilterTarget: true,
            filteredChildrenIdentifierPaths: [],
          },
        }),
        true,
      );

      await validateHierarchyVisibility({
        provider: filteredProvider,
        handler,
        viewport,
        expectations: "all-visible",
      });

      await validateHierarchyVisibility({
        provider: defaultProvider,
        handler,
        viewport,
        expectations: {
          [keys.table.id]: "partial",
          [keys.classification.id]: "partial",
          [keys.element1.id]: "visible",
          [keys.element2.id]: "hidden",
        },
      });
    });

    it("showing filtered drawing element changes visibility for nodes in filter paths", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification" });
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "drawing model" });
        const drawingCategory = insertDrawingCategory({ builder, codeValue: "drawing category" });
        const element1 = insertDrawingGraphic({
          builder,
          modelId: drawingModel.id,
          categoryId: drawingCategory.id,
          codeValue: "2d element1",
        });
        const element2 = insertDrawingGraphic({
          builder,
          modelId: drawingModel.id,
          categoryId: drawingCategory.id,
          codeValue: "2d element2",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: element1.id, classificationId: classification.id });
        insertElementHasClassificationsRelationship({ builder, elementId: element2.id, classificationId: classification.id });

        return {
          table,
          classification,
          drawingModel,
          drawingCategory,
          element1,
          element2,
          filterPaths: [[table, classification, element1]],
        };
      });

      const { imodel, filterPaths, ...keys } = buildIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodel,
        filterPaths,
        view: "2d",
        categoryIds: [keys.drawingCategory.id],
        modelIds: [keys.drawingModel.id],
      });
      const { handler, viewport, defaultProvider, filteredProvider } = visibilityTestData;
      await setupInitialDisplayState({ viewport, ...createHiddenTestData(keys) });

      await handler.changeVisibility(
        createDrawingElementHierarchyNode({
          id: keys.element1.id,
          categoryId: keys.drawingCategory.id,
          modelId: keys.drawingModel.id,
          filtering: {
            isFilterTarget: true,
            filteredChildrenIdentifierPaths: [],
          },
        }),
        true,
      );

      await validateHierarchyVisibility({
        provider: filteredProvider,
        handler,
        viewport,
        expectations: "all-visible",
      });

      await validateHierarchyVisibility({
        provider: defaultProvider,
        handler,
        viewport,
        expectations: {
          [keys.table.id]: "partial",
          [keys.classification.id]: "partial",
          [keys.element1.id]: "visible",
          [keys.element2.id]: "hidden",
        },
      });
    });

    it("showing filtered classification changes visibility for nodes in filter paths", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification1 = insertClassification({ builder, modelId: table.id, codeValue: "Classification1" });
        const classification2 = insertClassification({ builder, modelId: table.id, codeValue: "Classification2" });
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "physical model" });
        const spatialCategory1 = insertSpatialCategory({ builder, codeValue: "spatial category1" });
        const spatialCategory2 = insertSpatialCategory({ builder, codeValue: "spatial category2" });
        const element1 = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d element1",
        });
        const element2 = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d element2",
        });
        const element3 = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory2.id,
          codeValue: "3d element3",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: element1.id, classificationId: classification1.id });
        insertElementHasClassificationsRelationship({ builder, elementId: element2.id, classificationId: classification1.id });
        insertElementHasClassificationsRelationship({ builder, elementId: element3.id, classificationId: classification2.id });

        return {
          table,
          classification1,
          classification2,
          physicalModel,
          spatialCategory1,
          spatialCategory2,
          element1,
          element2,
          element3,
          filterPaths: [[table, classification1, element1]],
        };
      });

      const { imodel, filterPaths, ...keys } = buildIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodel,
        filterPaths,
        view: "3d",
        categoryIds: [keys.spatialCategory1.id, keys.spatialCategory2.id],
        modelIds: [keys.physicalModel.id],
      });
      const { handler, viewport, defaultProvider, filteredProvider } = visibilityTestData;
      await setupInitialDisplayState({ viewport, ...createHiddenTestData(keys) });
      await handler.changeVisibility(
        createClassificationHierarchyNode({
          id: keys.classification1.id,
          filtering: {
            isFilterTarget: false,
            filteredChildrenIdentifierPaths: [[keys.element1]],
          },
          parentKeys: [keys.table],
        }),
        true,
      );

      await validateHierarchyVisibility({
        provider: filteredProvider,
        handler,
        viewport,
        expectations: "all-visible",
      });

      await validateHierarchyVisibility({
        provider: defaultProvider,
        handler,
        viewport,
        expectations: {
          [keys.table.id]: "partial",
          [keys.classification1.id]: "partial",
          [keys.element1.id]: "visible",
          [keys.element2.id]: "hidden",
          [keys.classification2.id]: "hidden",
          [keys.element3.id]: "hidden",
        },
      });
    });

    it("showing filtered classification table changes visibility for nodes in filter paths", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification1 = insertClassification({ builder, modelId: table.id, codeValue: "Classification1" });
        const classification2 = insertClassification({ builder, modelId: table.id, codeValue: "Classification2" });
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "physical model" });
        const spatialCategory1 = insertSpatialCategory({ builder, codeValue: "spatial category1" });
        const spatialCategory2 = insertSpatialCategory({ builder, codeValue: "spatial category2" });
        const element1 = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d element1",
        });
        const element2 = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d element2",
        });
        const element3 = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory2.id,
          codeValue: "3d element3",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: element1.id, classificationId: classification1.id });
        insertElementHasClassificationsRelationship({ builder, elementId: element2.id, classificationId: classification1.id });
        insertElementHasClassificationsRelationship({ builder, elementId: element3.id, classificationId: classification2.id });

        return {
          table,
          classification1,
          classification2,
          physicalModel,
          spatialCategory1,
          spatialCategory2,
          element1,
          element2,
          element3,
          filterPaths: [[table, classification1, element1]],
        };
      });

      const { imodel, filterPaths, ...keys } = buildIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodel,
        filterPaths,
        view: "3d",
        categoryIds: [keys.spatialCategory1.id, keys.spatialCategory2.id],
        modelIds: [keys.physicalModel.id],
      });
      const { handler, viewport, defaultProvider, filteredProvider } = visibilityTestData;
      await setupInitialDisplayState({ viewport, ...createHiddenTestData(keys) });
      await handler.changeVisibility(
        createClassificationTableHierarchyNode({
          hasChildren: true,
          id: keys.table.id,
          filtering: {
            isFilterTarget: false,
            filteredChildrenIdentifierPaths: [[keys.classification1, keys.element1]],
          },
        }),
        true,
      );

      await validateHierarchyVisibility({
        provider: filteredProvider,
        handler,
        viewport,
        expectations: "all-visible",
      });

      await validateHierarchyVisibility({
        provider: defaultProvider,
        handler,
        viewport,
        expectations: {
          [keys.table.id]: "partial",
          [keys.classification1.id]: "partial",
          [keys.element1.id]: "visible",
          [keys.element2.id]: "hidden",
          [keys.classification2.id]: "hidden",
          [keys.element3.id]: "hidden",
        },
      });
    });
  });
});

async function createSpatialViewState(iModel: IModelConnection, categoryIds: Id64Array, modelIds: Id64Array) {
  const model = IModel.dictionaryId;
  const viewState = SpatialViewState.createFromProps(
    {
      categorySelectorProps: { categories: categoryIds, model, code: Code.createEmpty(), classFullName: "BisCore:CategorySelector" },
      displayStyleProps: { model, code: Code.createEmpty(), classFullName: "BisCore:DisplayStyle3d" },
      viewDefinitionProps: {
        model,
        code: Code.createEmpty(),
        categorySelectorId: "",
        classFullName: "BisCore:SpatialViewDefinition",
        displayStyleId: "",
      },
      modelSelectorProps: {
        models: modelIds,
        code: Code.createEmpty(),
        model,
        classFullName: "BisCore:ModelSelector",
      },
    },
    iModel,
  );

  viewState.setAllow3dManipulations(true);

  viewState.displayStyle.backgroundColor = ColorDef.white;
  const flags = viewState.viewFlags.copy({
    grid: false,
    renderMode: RenderMode.SmoothShade,
    backgroundMap: false,
  });
  viewState.displayStyle.viewFlags = flags;

  IModelApp.viewManager.onViewOpen.addOnce((vp) => {
    if (vp.view.hasSameCoordinates(viewState)) {
      vp.applyViewState(viewState);
    }
  });
  await viewState.load();
  return viewState;
}

async function createDrawingViewState(iModel: IModelConnection, categoryIds: Id64Array, modelIds: Id64Array) {
  const model = IModel.dictionaryId;
  const viewState = DrawingViewState.createFromProps(
    {
      categorySelectorProps: { categories: categoryIds, model, code: Code.createEmpty(), classFullName: "BisCore:CategorySelector" },
      displayStyleProps: { model, code: Code.createEmpty(), classFullName: "BisCore:DisplayStyle2d" },
      viewDefinitionProps: {
        model,
        code: Code.createEmpty(),
        categorySelectorId: "",
        classFullName: "BisCore:DrawingViewDefinition",
        displayStyleId: "",
      },
      modelSelectorProps: {
        models: modelIds,
        code: Code.createEmpty(),
        model,
        classFullName: "BisCore:ModelSelector",
      },
    },
    iModel,
  );
  modelIds.length && (await viewState.changeViewedModel(modelIds[0]));

  viewState.displayStyle.backgroundColor = ColorDef.white;
  const flags = viewState.viewFlags.copy({
    grid: false,
    renderMode: RenderMode.SmoothShade,
    backgroundMap: false,
  });
  viewState.displayStyle.viewFlags = flags;

  IModelApp.viewManager.onViewOpen.addOnce((vp) => {
    if (vp.view.hasSameCoordinates(viewState)) {
      vp.applyViewState(viewState);
    }
  });
  await viewState.load();
  return viewState;
}

interface VisibilityInfo {
  id: Id64String;
  visible: boolean;
}
async function setupInitialDisplayState(props: {
  viewport: Viewport;
  categories?: Array<VisibilityInfo>;
  models?: Array<VisibilityInfo>;
  elements?: Array<VisibilityInfo>;
}) {
  const { viewport } = props;
  const categories = props.categories ?? [];
  const elements = props.elements ?? [];
  const models = props.models ?? [];
  for (const categoryInfo of categories) {
    viewport.changeCategoryDisplay(categoryInfo.id, categoryInfo.visible, false);
  }
  for (const elementInfo of elements) {
    if (elementInfo.visible) {
      viewport.alwaysDrawn?.add(elementInfo.id);
      continue;
    }
    viewport.neverDrawn?.add(elementInfo.id);
  }
  if (!viewport.alwaysDrawn) {
    viewport.setAlwaysDrawn(new Set(elements.filter(({ visible }) => visible).map(({ id }) => id)));
  }
  if (!viewport.neverDrawn) {
    viewport.setNeverDrawn(new Set(elements.filter(({ visible }) => !visible).map(({ id }) => id)));
  }
  if (viewport.view.is3d()) {
    for (const modelInfo of models) {
      viewport.changeModelDisplay(modelInfo.id, modelInfo.visible);
    }
  }
  if (viewport.view.is2d()) {
    assert(models.length <= 1, "2d views support only one model at a time");
    models.length && models[0].visible && (await viewport.changeViewedModel2d(models[0].id));
  }
}

function createHiddenTestData(keys: { [key: string]: InstanceKey }) {
  const categories = new Array<VisibilityInfo>();
  const elements = new Array<VisibilityInfo>();
  const models = new Array<VisibilityInfo>();
  for (const key of Object.values(keys)) {
    if (key.className.toLowerCase().includes("category")) {
      categories.push({ id: key.id, visible: false });
      continue;
    }
    if (key.className.toLowerCase().includes("physicalobject")) {
      elements.push({ id: key.id, visible: false });
      continue;
    }
    if (key.className.toLowerCase().includes("drawinggraphic")) {
      elements.push({ id: key.id, visible: false });
      continue;
    }
    if (key.className.toLowerCase().includes("model")) {
      models.push({ id: key.id, visible: false });
    }
  }
  return { categories, elements, models };
}

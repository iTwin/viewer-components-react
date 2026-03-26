/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { ClassificationsTreeDefinition } from "../../../tree-widget-react/components/trees/classifications-tree/ClassificationsTreeDefinition.js";
import { ClassificationsTreeIdsCache } from "../../../tree-widget-react/components/trees/classifications-tree/internal/ClassificationsTreeIdsCache.js";
import { ClassificationsTreeVisibilityHandler } from "../../../tree-widget-react/components/trees/classifications-tree/internal/visibility/ClassificationsTreeVisibilityHandler.js";
import { createClassificationsSearchResultsTree } from "../../../tree-widget-react/components/trees/classifications-tree/internal/visibility/SearchResultsTree.js";
import { BaseIdsCache } from "../../../tree-widget-react/components/trees/common/internal/caches/BaseIdsCache.js";
import { CLASS_NAME_GeometricElement3d } from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { HierarchyVisibilityHandlerImpl } from "../../../tree-widget-react/components/trees/common/internal/useTreeHooks/UseCachedVisibility.js";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../IModelUtils.js";
import { initializeITwinJs, terminateITwinJs } from "../../Initialize.js";
import { createIModelAccess } from "../Common.js";
import { validateHierarchyVisibility } from "../common/VisibilityValidation.js";
import { createTreeWidgetTestingViewport } from "../TreeUtils.js";
import { createClassificationHierarchyNode, createClassificationTableHierarchyNode, createPhysicalElementHierarchyNode } from "./HierarchyNodeUtils.js";
import {
  CATEGORY_SYMBOLIZES_CLASSIFICATION_RELATIONSHIP_SCHEMA,
  importCategorySymbolizesClassificationSchema,
  importClassificationSchema,
  insertCategorySymbolizesClassificationRelationship,
  insertClassification,
  insertClassificationSystem,
  insertClassificationTable,
  insertElementHasClassificationsRelationship,
} from "./Utils.js";
import { validateNodeVisibility } from "./VisibilityValidation.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, Props } from "@itwin/presentation-shared";
import type { ClassificationsTreeSearchTargets } from "../../../tree-widget-react/components/trees/classifications-tree/internal/visibility/SearchResultsTree.js";
import type { ClassificationsTreeVisibilityHandlerConfiguration } from "../../../tree-widget-react/components/trees/classifications-tree/UseClassificationsTree.js";
import type { SearchResultsTree } from "../../../tree-widget-react/components/trees/common/internal/visibility/BaseSearchResultsTree.js";
import type { TreeWidgetViewport } from "../../../tree-widget-react/components/trees/common/TreeWidgetViewport.js";

describe("ClassificationsTreeVisibilityHandler", () => {
  before(async () => {
    await initializeITwinJs();
  });

  after(async () => {
    await terminateITwinJs();
  });

  const rootClassificationSystemCode = "TestClassificationSystem";

  function createProvider({
    idsCache,
    ...props
  }: {
    idsCache: ClassificationsTreeIdsCache;
    imodelAccess: ReturnType<typeof createIModelAccess>;
    searchPaths?: HierarchySearchTree[];
  }) {
    return createIModelHierarchyProvider({
      hierarchyDefinition: new ClassificationsTreeDefinition({ ...props, getIdsCache: () => idsCache, hierarchyConfig: { rootClassificationSystemCode } }),
      imodelAccess: props.imodelAccess,
      ...(props.searchPaths ? { search: { paths: props.searchPaths } } : undefined),
    });
  }

  async function createVisibilityTestData({
    imodel,
    visibleByDefault,
    visibilityHandlerConfig,
  }: {
    imodel: IModelConnection;
    visibleByDefault?: boolean;
    visibilityHandlerConfig?: ClassificationsTreeVisibilityHandlerConfiguration;
  }) {
    const imodelAccess = createIModelAccess(imodel);
    const baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, elementClassName: CLASS_NAME_GeometricElement3d, type: "3d" });
    const idsCache = new ClassificationsTreeIdsCache({
      queryExecutor: imodelAccess,
      hierarchyConfig: { rootClassificationSystemCode },
      baseIdsCache,
      visibilityHandlerConfig,
    });
    const viewport = createTreeWidgetTestingViewport({
      iModel: imodel,
      visibleByDefault,
      viewType: "3d",
    });
    const handler = createClassificationsTreeVisibilityHandler({ imodelAccess, idsCache, viewport });
    const provider = createProvider({ idsCache, imodelAccess });
    return {
      handler,
      provider,
      imodel,
      imodelAccess,
      viewport,
      [Symbol.dispose]() {
        baseIdsCache[Symbol.dispose]();
        idsCache[Symbol.dispose]();
        handler[Symbol.dispose]();
        provider[Symbol.dispose]();
      },
    };
  }

  describe("custom classification -> category relationship", () => {
    let buildIModelResult: Awaited<ReturnType<typeof createIModel>>;
    const visibilityHandlerConfig: ClassificationsTreeVisibilityHandlerConfiguration = {
      classificationToCategoriesRelationshipSpecification: {
        fullClassName: `${CATEGORY_SYMBOLIZES_CLASSIFICATION_RELATIONSHIP_SCHEMA}.CategorySymbolizesClassification`,
        source: "category",
      },
    };
    const createIModel = async (mochaContext: Mocha.Context) => {
      return buildIModel(mochaContext, async (builder) => {
        await importClassificationSchema(builder);
        await importCategorySymbolizesClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "TestClassification" });

        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model" });
        const spatialCategory = insertSpatialCategory({ builder, codeValue: "Test spatial category" });
        const elementInHierarchy = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "Parent 3d element",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: elementInHierarchy.id, classificationId: classification.id });
        insertCategorySymbolizesClassificationRelationship({ builder, categoryId: spatialCategory.id, classificationId: classification.id });

        const categoryFromCustomRelationship = insertSpatialCategory({ builder, codeValue: "Category from custom relationship" });
        const elementNotInHierarchy = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: categoryFromCustomRelationship.id });
        insertCategorySymbolizesClassificationRelationship({ builder, categoryId: categoryFromCustomRelationship.id, classificationId: classification.id });
        return { table, classification, spatialCategory, elementInHierarchy, categoryFromCustomRelationship, elementNotInHierarchy, physicalModel };
      });
    };
    before(async function () {
      buildIModelResult = await createIModel(this);
    });

    after(async function () {
      await buildIModelResult[Symbol.asyncDispose]();
    });

    it("does not turn on categories from custom classification -> category relationship when `visibilityHandlerConfig` is not provided", async function () {
      const { imodel, ...keys } = buildIModelResult;

      using visibilityTestData = await createVisibilityTestData({
        imodel,
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.classification.id }), true);
      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
      await validateNodeVisibility({
        handler,
        node: createPhysicalElementHierarchyNode({
          id: keys.elementNotInHierarchy.id,
          categoryId: keys.categoryFromCustomRelationship.id,
          modelId: keys.physicalModel.id,
        }),
        viewport,
        expectations: "all-hidden",
      });
    });

    it("turns on categories from custom classification -> category relationship", async function () {
      const { imodel, ...keys } = buildIModelResult;

      using visibilityTestData = await createVisibilityTestData({
        imodel,
        visibilityHandlerConfig,
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.classification.id }), true);
      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
      await validateNodeVisibility({
        handler,
        node: createPhysicalElementHierarchyNode({
          id: keys.elementNotInHierarchy.id,
          categoryId: keys.categoryFromCustomRelationship.id,
          modelId: keys.physicalModel.id,
        }),
        viewport,
        expectations: "all-visible",
      });
    });

    it("classification visibility takes into account categories from custom classification -> category relationship", async function () {
      const { imodel, ...keys } = buildIModelResult;

      using visibilityTestData = await createVisibilityTestData({
        imodel,
        visibilityHandlerConfig,
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
      });
      await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.classification.id }), true);
      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
      viewport.changeCategoryDisplay({ categoryIds: keys.categoryFromCustomRelationship.id, display: false });
      await validateClassificationsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification.id]: "partial",
              [keys.elementInHierarchy.id]: "visible",
        },
      });
      await validateNodeVisibility({
        handler,
        node: createPhysicalElementHierarchyNode({
          id: keys.elementNotInHierarchy.id,
          categoryId: keys.categoryFromCustomRelationship.id,
          modelId: keys.physicalModel.id,
        }),
        viewport,
        expectations: "all-hidden",
      });
    });
  });

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
        insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          parentId: parentPhysicalElement.id,
          codeValue: "Child 3d element",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement.id, classificationId: classification.id });
      });

      const { imodel } = buildIModelResult;

      using visibilityTestData = await createVisibilityTestData({
        imodel,
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateClassificationsTreeHierarchyVisibility({
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
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createClassificationTableHierarchyNode({ id: keys.table.id }), true);
        await validateClassificationsTreeHierarchyVisibility({
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
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.childClassification.id }), true);
        await validateClassificationsTreeHierarchyVisibility({
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
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.childClassification1.id }), true);
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
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
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(
          createPhysicalElementHierarchyNode({ id: keys.targetPhysicalElement.id, categoryId: keys.spatialCategory.id, modelId: keys.physicalModel.id }),
          true,
        );
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.table.id]: "partial",
              [keys.parentClassification.id]: "partial",
                [keys.childClassification.id]: "partial",
                  [keys.parentPhysicalElement.id]: "partial",
                    [keys.siblingPhysicalElement.id]: "hidden",

                    [keys.targetPhysicalElement.id]: "visible",
                      [keys.childPhysicalElement.id]: "visible",
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

      const { imodel } = buildIModelResult;
      using visibilityTestData = await createVisibilityTestData({
        imodel,
        visibleByDefault: true,
      });
      const { handler, provider, viewport } = visibilityTestData;

      await validateClassificationsTreeHierarchyVisibility({
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
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createClassificationTableHierarchyNode({ id: keys.table.id }), false);
        await validateClassificationsTreeHierarchyVisibility({
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

          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(createClassificationHierarchyNode({ id: keys.childClassification1.id }), false);
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
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
      it("hiding geometric element makes ancestors partially visible, element and its children hidden", async function () {
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
          visibleByDefault: true,
        });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(
          createPhysicalElementHierarchyNode({ id: keys.targetPhysicalElement.id, categoryId: keys.spatialCategory.id, modelId: keys.physicalModel.id }),
          false,
        );
        await validateClassificationsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.table.id]: "partial",
              [keys.parentClassification.id]: "partial",
                [keys.childClassification.id]: "partial",
                  [keys.parentPhysicalElement.id]: "partial",
                    [keys.siblingPhysicalElement.id]: "visible",

                    [keys.targetPhysicalElement.id]: "hidden",
                      [keys.childPhysicalElement.id]: "hidden",
          },
        });
      });
    });
  });

  describe("search nodes", () => {
    async function createFilteredVisibilityTestData({
      imodel,
      searchPaths,
      visibleByDefault,
    }: Parameters<typeof createVisibilityTestData>[0] & {
      searchPaths: HierarchySearchTree[];
      visibleByDefault?: boolean;
    }) {
      const imodelAccess = createIModelAccess(imodel);
      const baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, elementClassName: CLASS_NAME_GeometricElement3d, type: "3d" });
      const idsCache = new ClassificationsTreeIdsCache({ queryExecutor: imodelAccess, hierarchyConfig: { rootClassificationSystemCode }, baseIdsCache });
      const viewport = createTreeWidgetTestingViewport({
        iModel: imodel,
        viewType: "3d",
        visibleByDefault,
      });
      const visibilityHandlerWithSearchPaths = createClassificationsTreeVisibilityHandler({ idsCache, searchPaths, imodelAccess, viewport });
      const defaultVisibilityHandler = createClassificationsTreeVisibilityHandler({ idsCache, imodelAccess, viewport });
      const defaultProvider = createProvider({ idsCache, imodelAccess });
      const providerWithSearchPaths = createProvider({ idsCache, imodelAccess, searchPaths });
      return {
        defaultVisibilityHandler,
        visibilityHandlerWithSearchPaths,
        defaultProvider,
        providerWithSearchPaths,
        imodel,
        imodelAccess,
        viewport,
        [Symbol.dispose]() {
          baseIdsCache[Symbol.dispose]();
          idsCache[Symbol.dispose]();
          defaultVisibilityHandler[Symbol.dispose]();
          visibilityHandlerWithSearchPaths[Symbol.dispose]();
          defaultProvider[Symbol.dispose]();
          providerWithSearchPaths[Symbol.dispose]();
        },
      };
    }

    it("showing parent geometric element of search target changes visibility for nodes in search paths", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification" });

        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "physical model" });
        const spatialCategory = insertSpatialCategory({ builder, codeValue: "spatial category" });
        const parentOfSearchTargetElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "3d parent of search target",
        });
        const searchTargetChildElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "3d search target",
          parentId: parentOfSearchTargetElement.id,
        });
        const childElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "3d child",
          parentId: parentOfSearchTargetElement.id,
        });
        const siblingElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "3d sibling",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: parentOfSearchTargetElement.id, classificationId: classification.id });
        insertElementHasClassificationsRelationship({ builder, elementId: siblingElement.id, classificationId: classification.id });

        return {
          table,
          classification,
          physicalModel,
          spatialCategory,
          parentOfSearchTargetElement,
          searchTargetChildElement,
          childElement,
          siblingElement,
          searchPaths: [
            {
              identifier: table,
              children: [
                {
                  identifier: classification,
                  children: [{ identifier: parentOfSearchTargetElement, children: [{ identifier: searchTargetChildElement }] }],
                },
              ],
            },
          ],
        };
      });

      const { imodel, searchPaths, ...keys } = buildIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodel,
        searchPaths,
      });
      const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

      await visibilityHandlerWithSearchPaths.changeVisibility(
        createPhysicalElementHierarchyNode({
          id: keys.parentOfSearchTargetElement.id,
          categoryId: keys.spatialCategory.id,
          modelId: keys.physicalModel.id,
          parentKeys: [keys.table, keys.classification],
          search: {
            isSearchTarget: false,
            childrenTargetPaths: [{ identifier: keys.searchTargetChildElement }],
          },
        }),
        true,
      );

      await validateClassificationsTreeHierarchyVisibility({
        provider: providerWithSearchPaths,
        handler: visibilityHandlerWithSearchPaths,
        viewport,
        expectations: "all-visible",
      });

      await validateClassificationsTreeHierarchyVisibility({
        provider: defaultProvider,
        handler: defaultVisibilityHandler,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification.id]: "partial",
              [keys.siblingElement.id]: "hidden",

              [keys.parentOfSearchTargetElement.id]: "partial",
                [keys.searchTargetChildElement.id]: "visible",
                [keys.childElement.id]: "hidden",
        },
      });
    });

    it("showing search target geometric element changes visibility for nodes in search paths", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification" });

        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "physical model" });
        const spatialCategory = insertSpatialCategory({ builder, codeValue: "spatial category" });
        const parentOfSearchTargetElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "3d parent of search target",
        });
        const searchTargetChildElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "3d search target child",
          parentId: parentOfSearchTargetElement.id,
        });
        const childElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "3d child",
          parentId: parentOfSearchTargetElement.id,
        });
        const siblingElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "3d sibling",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: parentOfSearchTargetElement.id, classificationId: classification.id });
        insertElementHasClassificationsRelationship({ builder, elementId: siblingElement.id, classificationId: classification.id });

        return {
          table,
          classification,
          physicalModel,
          spatialCategory,
          parentOfSearchTargetElement,
          searchTargetChildElement,
          childElement,
          siblingElement,
          searchPaths: [
            {
              identifier: table,
              children: [
                {
                  identifier: classification,
                  children: [{ identifier: parentOfSearchTargetElement, children: [{ identifier: searchTargetChildElement }] }],
                },
              ],
            },
          ],
        };
      });

      const { imodel, searchPaths, ...keys } = buildIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodel,
        searchPaths,
      });
      const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

      await visibilityHandlerWithSearchPaths.changeVisibility(
        createPhysicalElementHierarchyNode({
          id: keys.searchTargetChildElement.id,
          categoryId: keys.spatialCategory.id,
          modelId: keys.physicalModel.id,
          parentKeys: [keys.table, keys.classification, keys.parentOfSearchTargetElement],
          search: { isSearchTarget: true },
        }),
        true,
      );

      await validateClassificationsTreeHierarchyVisibility({
        provider: providerWithSearchPaths,
        handler: visibilityHandlerWithSearchPaths,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification.id]: "partial",
              [keys.parentOfSearchTargetElement.id]: "partial",
                [keys.searchTargetChildElement.id]: "visible",
        },
      });

      await validateClassificationsTreeHierarchyVisibility({
        provider: defaultProvider,
        handler: defaultVisibilityHandler,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification.id]: "partial",
              [keys.siblingElement.id]: "hidden",

              [keys.parentOfSearchTargetElement.id]: "partial",
                [keys.searchTargetChildElement.id]: "visible",
                [keys.childElement.id]: "hidden",
        },
      });
    });

    it("showing classification of search target element changes visibility for nodes in search paths", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification1 = insertClassification({ builder, modelId: table.id, codeValue: "Classification1" });
        const classification2 = insertClassification({ builder, modelId: table.id, codeValue: "Classification2" });
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "physical model" });
        const spatialCategory1 = insertSpatialCategory({ builder, codeValue: "spatial category1" });
        const spatialCategory2 = insertSpatialCategory({ builder, codeValue: "spatial category2" });
        const parentOfSearchTargetElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d parent of search target",
        });
        const searchTargetChildElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d search target",
          parentId: parentOfSearchTargetElement.id,
        });
        const childElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d child",
          parentId: parentOfSearchTargetElement.id,
        });
        const siblingElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d sibling",
        });
        const elementFromOtherClassification = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory2.id,
          codeValue: "3d other classification",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: parentOfSearchTargetElement.id, classificationId: classification1.id });
        insertElementHasClassificationsRelationship({ builder, elementId: siblingElement.id, classificationId: classification1.id });
        insertElementHasClassificationsRelationship({ builder, elementId: elementFromOtherClassification.id, classificationId: classification2.id });

        return {
          table,
          classification1,
          classification2,
          physicalModel,
          spatialCategory1,
          spatialCategory2,
          parentOfSearchTargetElement,
          searchTargetChildElement,
          childElement,
          siblingElement,
          elementFromOtherClassification,
          searchPaths: [
            {
              identifier: table,
              children: [
                {
                  identifier: classification1,
                  children: [{ identifier: parentOfSearchTargetElement, children: [{ identifier: searchTargetChildElement }] }],
                },
              ],
            },
          ],
        };
      });

      const { imodel, searchPaths, ...keys } = buildIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodel,
        searchPaths,
      });
      const { visibilityHandlerWithSearchPaths, defaultVisibilityHandler, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
      await visibilityHandlerWithSearchPaths.changeVisibility(
        createClassificationHierarchyNode({
          id: keys.classification1.id,
          search: {
            isSearchTarget: false,
            childrenTargetPaths: [{ identifier: keys.parentOfSearchTargetElement, children: [{ identifier: keys.searchTargetChildElement }] }],
          },
          parentKeys: [keys.table],
        }),
        true,
      );

      await validateClassificationsTreeHierarchyVisibility({
        provider: providerWithSearchPaths,
        handler: visibilityHandlerWithSearchPaths,
        viewport,
        expectations: "all-visible",
      });

      await validateClassificationsTreeHierarchyVisibility({
        provider: defaultProvider,
        handler: defaultVisibilityHandler,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification1.id]: "partial",
              [keys.siblingElement.id]: "hidden",

              [keys.parentOfSearchTargetElement.id]: "partial",
                [keys.searchTargetChildElement.id]: "visible",
                [keys.childElement.id]: "hidden",

            [keys.classification2.id]: "hidden",
              [keys.elementFromOtherClassification.id]: "hidden",
        },
      });
    });

    it("showing classification table of search target element changes visibility for nodes in search paths", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification1 = insertClassification({ builder, modelId: table.id, codeValue: "Classification1" });
        const classification2 = insertClassification({ builder, modelId: table.id, codeValue: "Classification2" });
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "physical model" });
        const spatialCategory1 = insertSpatialCategory({ builder, codeValue: "spatial category1" });
        const spatialCategory2 = insertSpatialCategory({ builder, codeValue: "spatial category2" });
        const parentOfSearchTargetElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d parent of search target",
        });
        const searchTargetChildElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d search target",
          parentId: parentOfSearchTargetElement.id,
        });
        const childElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d child",
          parentId: parentOfSearchTargetElement.id,
        });
        const siblingElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory1.id,
          codeValue: "3d sibling",
        });
        const elementFromOtherClassification = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory2.id,
          codeValue: "3d other classification",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: parentOfSearchTargetElement.id, classificationId: classification1.id });
        insertElementHasClassificationsRelationship({ builder, elementId: siblingElement.id, classificationId: classification1.id });
        insertElementHasClassificationsRelationship({ builder, elementId: elementFromOtherClassification.id, classificationId: classification2.id });

        return {
          table,
          classification1,
          classification2,
          physicalModel,
          spatialCategory1,
          spatialCategory2,
          parentOfSearchTargetElement,
          searchTargetChildElement,
          childElement,
          siblingElement,
          elementFromOtherClassification,
          searchPaths: [
            {
              identifier: table,
              children: [
                {
                  identifier: classification1,
                  children: [{ identifier: parentOfSearchTargetElement, children: [{ identifier: searchTargetChildElement }] }],
                },
              ],
            },
          ],
        };
      });

      const { imodel, searchPaths, ...keys } = buildIModelResult;
      using visibilityTestData = await createFilteredVisibilityTestData({
        imodel,
        searchPaths,
      });
      const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
      await visibilityHandlerWithSearchPaths.changeVisibility(
        createClassificationTableHierarchyNode({
          hasChildren: true,
          id: keys.table.id,
          search: {
            isSearchTarget: false,
            childrenTargetPaths: [
              {
                identifier: keys.classification1,
                children: [{ identifier: keys.parentOfSearchTargetElement, children: [{ identifier: keys.searchTargetChildElement }] }],
              },
            ],
          },
        }),
        true,
      );

      await validateClassificationsTreeHierarchyVisibility({
        provider: providerWithSearchPaths,
        handler: visibilityHandlerWithSearchPaths,
        viewport,
        expectations: "all-visible",
      });

      await validateClassificationsTreeHierarchyVisibility({
        provider: defaultProvider,
        handler: defaultVisibilityHandler,
        viewport,
        // prettier-ignore
        expectations: {
          [keys.table.id]: "partial",
            [keys.classification1.id]: "partial",
              [keys.siblingElement.id]: "hidden",

              [keys.parentOfSearchTargetElement.id]: "partial",
                [keys.searchTargetChildElement.id]: "visible",
                [keys.childElement.id]: "hidden",

            [keys.classification2.id]: "hidden",
              [keys.elementFromOtherClassification.id]: "hidden",
        },
      });
    });
  });
});

function createClassificationsTreeVisibilityHandler(props: {
  viewport: TreeWidgetViewport;
  idsCache: ClassificationsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  searchPaths?: HierarchySearchTree[];
}) {
  return new HierarchyVisibilityHandlerImpl<ClassificationsTreeSearchTargets>({
    getSearchResultsTree: (): undefined | Promise<SearchResultsTree<ClassificationsTreeSearchTargets>> => {
      if (!props.searchPaths) {
        return undefined;
      }
      return createClassificationsSearchResultsTree({
        idsCache: props.idsCache,
        searchPaths: props.searchPaths,
        imodelAccess: props.imodelAccess,
      });
    },
    getTreeSpecificVisibilityHandler: (info) => {
      return new ClassificationsTreeVisibilityHandler({
        alwaysAndNeverDrawnElementInfo: info,
        idsCache: props.idsCache,
        viewport: props.viewport,
      });
    },
    viewport: props.viewport,
  });
}

async function validateClassificationsTreeHierarchyVisibility(props: Omit<Props<typeof validateHierarchyVisibility>, "validateNodeVisibility">) {
  return validateHierarchyVisibility({
    ...props,
    validateNodeVisibility,
  });
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Code, ColorDef, IModel, IModelReadRpcInterface, RenderMode } from "@itwin/core-common";
import { IModelApp, NoRenderApp, OffScreenViewport, SpatialViewState, ViewRect } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { ModelsTreeIdsCache } from "../../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { createModelsTreeVisibilityHandler } from "../../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeVisibilityHandler.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import {
  buildIModel,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
} from "../../../../IModelUtils.js";
import { TestUtils } from "../../../../TestUtils.js";
import { createIModelAccess } from "../../../Common.js";
import {
  createCategoryHierarchyNode,
  createClassGroupingHierarchyNode,
  createElementHierarchyNode,
  createModelHierarchyNode,
  createSubjectHierarchyNode,
} from "../../Utils.js";
import { validateHierarchyVisibility, VisibilityExpectations } from "../VisibilityValidation.js";

import type { InstanceKey } from "@itwin/presentation-shared";
import type { IModelConnection } from "@itwin/core-frontend";
import type { GeometricElement3dProps } from "@itwin/core-common";
import type { GroupingHierarchyNode, HierarchyNodeIdentifiersPath, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { Id64String } from "@itwin/core-bentley";

describe("ModelsTreeVisibilityHandler", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  describe("#integration", () => {
    before(async () => {
      await initializePresentationTesting({
        backendProps: {
          caching: {
            hierarchies: {
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async () => {
      await terminatePresentationTesting();
    });

    function createCommonProps(props: { imodel: IModelConnection; hierarchyConfig?: typeof defaultHierarchyConfiguration }) {
      const hierarchyConfig = { ...defaultHierarchyConfiguration, hideRootSubject: true, ...props.hierarchyConfig };
      const imodelAccess = createIModelAccess(props.imodel);
      const viewport = OffScreenViewport.create({
        view: createBlankViewState(props.imodel),
        viewRect: new ViewRect(),
      });
      const idsCache = new ModelsTreeIdsCache(imodelAccess, hierarchyConfig);
      return {
        imodelAccess,
        viewport,
        idsCache,
        hierarchyConfig,
      };
    }

    function createProvider(props: {
      idsCache: ModelsTreeIdsCache;
      imodelAccess: ReturnType<typeof createIModelAccess>;
      hierarchyConfig: typeof defaultHierarchyConfiguration;
      filterPaths?: HierarchyNodeIdentifiersPath[];
    }) {
      return createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ ...props }),
        imodelAccess: props.imodelAccess,
        ...(props.filterPaths ? { filtering: { paths: props.filterPaths } } : undefined),
      });
    }

    function createVisibilityTestData(props: { imodel: IModelConnection; hierarchyConfig?: typeof defaultHierarchyConfiguration }) {
      const commonProps = createCommonProps(props);
      const handler = createModelsTreeVisibilityHandler(commonProps);
      const provider = createProvider(commonProps);
      return {
        handler,
        provider,
        ...commonProps,
        [Symbol.dispose]() {
          commonProps.idsCache[Symbol.dispose]();
          commonProps.viewport[Symbol.dispose]();
          handler[Symbol.dispose]();
          provider[Symbol.dispose]();
        },
      };
    }

    interface IModelWithSubModelIds {
      subjectId: Id64String;
      modeledElementId: Id64String;
      modelId: Id64String;
      categoryId: Id64String;
      subModelCategoryId?: Id64String;
      subModelElementId?: Id64String;
    }

    const testCases: Array<{
      describeName: string;
      createIModel: (context: Mocha.Context) => Promise<{ imodel: IModelConnection } & IModelWithSubModelIds>;
      cases: Array<{
        only?: boolean;
        name: string;
        getTargetNode: (ids: IModelWithSubModelIds) => NonGroupingHierarchyNode | GroupingHierarchyNode;
        expectations: (ids: IModelWithSubModelIds) => ReturnType<typeof VisibilityExpectations.all>;
      }>;
    }> = [
      {
        describeName: "with modeled elements",
        createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(context, async (builder, testSchema) => {
            const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const modeledElement = insertPhysicalElement({
              builder,
              userLabel: `element`,
              modelId: model.id,
              categoryId: category.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            const subModel = insertPhysicalSubModel({ builder, modeledElementId: modeledElement.id });
            const subModelCategory = insertSpatialCategory({ builder, codeValue: "category2" });
            const subModelElement = insertPhysicalElement({ builder, userLabel: `element2`, modelId: subModel.id, categoryId: subModelCategory.id });
            return {
              subjectId: rootSubject.id,
              modeledElementId: modeledElement.id,
              modelId: model.id,
              categoryId: category.id,
              subModelCategoryId: subModelCategory.id,
              subModelElementId: subModelElement.id,
            };
          });
        },
        cases: [
          {
            name: "modeled element's children display is turned on when its subject display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createSubjectHierarchyNode(ids.subjectId),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "modeled element's children display is turned on when its model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createModelHierarchyNode(ids.modelId, true),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "modeled element's children display is turned on when its category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode(ids.modelId, ids.categoryId, true),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "modeled element's children display is turned on when its class grouping node display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createClassGroupingHierarchyNode({ modelId: ids.modelId, categoryId: ids.categoryId, elements: [ids.modeledElementId] }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "modeled element's children display is turned on when its display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createElementHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elementId: ids.modeledElementId,
                hasChildren: true,
              }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "modeled element's children display is turned on when its sub-model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createModelHierarchyNode(ids.modeledElementId, true),
            expectations: (ids: IModelWithSubModelIds): ReturnType<typeof VisibilityExpectations.all> => ({
              subject: () => "partial",
              model: (modelId) => (modelId === ids.modelId ? "partial" : "visible"),
              category: ({ categoryId }) => {
                if (categoryId === ids.subModelCategoryId) {
                  return "visible";
                }
                return "partial";
              },
              groupingNode: ({ elementIds }) => {
                if (elementIds.includes(ids.modeledElementId)) {
                  return "partial";
                }
                return "visible";
              },
              element: ({ elementId }) => {
                if (elementId === ids.modeledElementId) {
                  return "partial";
                }
                return "visible";
              },
            }),
          },
          {
            name: "modeled element, its model and category have partial visibility when its sub-model element's category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode(ids.modeledElementId, ids.subModelCategoryId, true),
            expectations: (ids: IModelWithSubModelIds): ReturnType<typeof VisibilityExpectations.all> => ({
              subject: () => "partial",
              model: () => "partial",
              category: ({ categoryId }) => {
                if (categoryId === ids.subModelCategoryId) {
                  return "visible";
                }
                return "partial";
              },
              groupingNode: ({ elementIds }) => {
                if (elementIds.includes(ids.modeledElementId)) {
                  return "partial";
                }
                return "visible";
              },
              element: ({ elementId }) => {
                if (elementId === ids.subModelElementId) {
                  return "visible";
                }
                return "partial";
              },
            }),
          },
          {
            name: "modeled element, its model and category have partial visibility when its sub-model element's display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createElementHierarchyNode({
                modelId: ids.modeledElementId,
                categoryId: ids.subModelCategoryId,
                elementId: ids.subModelElementId,
              }),
            expectations: (ids: IModelWithSubModelIds): ReturnType<typeof VisibilityExpectations.all> => ({
              subject: () => "partial",
              model: () => "partial",
              category: ({ categoryId }) => {
                if (categoryId === ids.subModelCategoryId) {
                  return "visible";
                }
                return "partial";
              },
              groupingNode: ({ elementIds }) => {
                if (elementIds.includes(ids.modeledElementId)) {
                  return "partial";
                }
                return "visible";
              },
              element: ({ elementId }) => {
                if (elementId === ids.subModelElementId) {
                  return "visible";
                }
                return "partial";
              },
            }),
          },
        ],
      },
      {
        describeName: "with modeled elements that have private subModel",
        createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(context, async (builder, testSchema) => {
            const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const modeledElement = insertPhysicalElement({
              builder,
              userLabel: `element`,
              modelId: model.id,
              categoryId: category.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            const subModel = insertPhysicalSubModel({ builder, modeledElementId: modeledElement.id, isPrivate: true });
            const subModelCategory = insertSpatialCategory({ builder, codeValue: "category2" });
            const subModelElement = insertPhysicalElement({ builder, userLabel: `element2`, modelId: subModel.id, categoryId: subModelCategory.id });
            return {
              subjectId: rootSubject.id,
              modeledElementId: modeledElement.id,
              modelId: model.id,
              categoryId: category.id,
              subModelCategoryId: subModelCategory.id,
              subModelElementId: subModelElement.id,
            };
          });
        },
        cases: [
          {
            name: "everything is visible when subject display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createSubjectHierarchyNode(ids.subjectId),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createModelHierarchyNode(ids.modelId, true),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode(ids.modelId, ids.categoryId, true),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when elements class grouping node display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createClassGroupingHierarchyNode({ modelId: ids.modelId, categoryId: ids.categoryId, elements: [ids.modeledElementId] }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when elements display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createElementHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elementId: ids.modeledElementId,
                hasChildren: false,
              }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
        ],
      },
      {
        describeName: "with modeled elements that have subModel with no children",
        createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(context, async (builder, testSchema) => {
            const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const modeledElement = insertPhysicalElement({
              builder,
              userLabel: `element`,
              modelId: model.id,
              categoryId: category.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            insertPhysicalSubModel({ builder, modeledElementId: modeledElement.id });
            return {
              subjectId: rootSubject.id,
              modeledElementId: modeledElement.id,
              modelId: model.id,
              categoryId: category.id,
            };
          });
        },
        cases: [
          {
            name: "everything is visible when subject display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createSubjectHierarchyNode(ids.subjectId),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createModelHierarchyNode(ids.modelId, true),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createCategoryHierarchyNode(ids.modelId, ids.categoryId, true),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when elements class grouping node display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createClassGroupingHierarchyNode({ modelId: ids.modelId, categoryId: ids.categoryId, elements: [ids.modeledElementId] }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when elements display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createElementHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elementId: ids.modeledElementId,
                hasChildren: false,
              }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
        ],
      },
    ];

    testCases.forEach(({ describeName, createIModel, cases }) => {
      describe(describeName, () => {
        let iModel: IModelConnection;
        let createdIds: IModelWithSubModelIds;

        before(async function () {
          const { imodel, ...ids } = await createIModel(this);
          iModel = imodel;
          createdIds = ids;
        });

        after(async () => {
          await iModel.close();
        });

        cases.forEach(({ name, getTargetNode, expectations, only }) => {
          (only ? it.only : it)(name, async function () {
            using visibilityTestData = createVisibilityTestData({ imodel: iModel });
            const { handler, provider, viewport } = visibilityTestData;

            const nodeToChangeVisibility = getTargetNode(createdIds);
            await validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              visibilityExpectations: VisibilityExpectations.all("hidden"),
            });
            await handler.changeVisibility(nodeToChangeVisibility, true);
            viewport.renderFrame();
            await validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              visibilityExpectations: expectations(createdIds),
            });
            await handler.changeVisibility(nodeToChangeVisibility, false);
            viewport.renderFrame();
            await validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              visibilityExpectations: VisibilityExpectations.all("hidden"),
            });
          });
        });
      });
    });

    it("by default everything is hidden", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const modelId = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId, categoryId });
      });

      const { imodel } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "hidden",
          model: () => ({ tree: "hidden", modelSelector: false }),
          category: () => ({ tree: "hidden", categorySelector: false, perModelCategoryOverride: "none" }),
          groupingNode: () => "hidden",
          element: () => "hidden",
        },
      });
    });

    it("showing subject makes it, all its models, categories and elements visible", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const modelId = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId, categoryId });
      });

      const { imodel } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode(IModel.rootSubjectId), true);
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "visible",
          model: () => ({ tree: "visible", modelSelector: true }),
          category: () => ({ tree: "visible", categorySelector: false, perModelCategoryOverride: "show" }),
          groupingNode: () => "visible",
          element: () => "visible",
        },
      });
    });

    it("showing model makes it, all its categories and elements visible and doesn't affect other models", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId });

        const otherModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;
        insertPhysicalElement({ builder, modelId: otherModel, categoryId });
        return { model };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createModelHierarchyNode(ids.model), true);
      viewport.renderFrame();
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: (id) => {
            return id === ids.model ? { tree: "visible", modelSelector: true } : { tree: "hidden", modelSelector: false };
          },
          category: ({ modelId }) => {
            if (modelId === ids.model) {
              return { tree: "visible", categorySelector: false, perModelCategoryOverride: "show" };
            }
            return { tree: "hidden", categorySelector: false, perModelCategoryOverride: "none" };
          },
          groupingNode: ({ modelId }) => (modelId === ids.model ? "visible" : "hidden"),
          element: ({ modelId }) => (modelId === ids.model ? "visible" : "hidden"),
        },
      });
    });

    it("all parent hierarchy gets partial when it's visible and one of the elements are added to never drawn list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const elements = [
          insertPhysicalElement({ builder, modelId: model, categoryId }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId }).id,
        ];
        return { model, hiddenElement: elements[0] };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createModelHierarchyNode(ids.model), true);
      viewport.setNeverDrawn(new Set([ids.hiddenElement]));
      viewport.renderFrame();
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => ({ tree: "partial", modelSelector: true }),
          category: () => ({ tree: "partial", categorySelector: false, perModelCategoryOverride: "show" }),
          groupingNode: () => "partial",
          element: ({ elementId }) => (elementId === ids.hiddenElement ? "hidden" : "visible"),
        },
      });
    });

    it("hiding parent element makes it hidden, model and category partially visible, while children remain visible", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const parentElement = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
        const child = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: parentElement }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: child });
        return { model, category, parentElement };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createModelHierarchyNode(ids.model), true);
      viewport.renderFrame();
      await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category, elementId: ids.parentElement }), false);
      viewport.renderFrame();

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => ({ tree: "partial", modelSelector: true }),
          category: () => ({ tree: "partial", categorySelector: false, perModelCategoryOverride: "show" }),
          groupingNode: ({ elementIds }) => (elementIds.includes(ids.parentElement) ? "hidden" : "visible"),
          element: ({ elementId }) => (elementId === ids.parentElement ? "hidden" : "visible"),
        },
      });
    });

    it("if model is hidden, showing element adds it to always drawn set and makes model and category visible in the viewport", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const elements = [
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
        ];

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });

        return { model, category, elementToShow: elements[0] };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category, elementId: ids.elementToShow }), true);
      viewport.renderFrame();

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => ({ tree: "partial", modelSelector: true }),
          category: ({ categoryId }) =>
            categoryId === ids.category
              ? { tree: "partial", categorySelector: false, perModelCategoryOverride: "none" }
              : { tree: "hidden", categorySelector: false, perModelCategoryOverride: "none" },
          groupingNode: ({ categoryId }) => (categoryId === ids.category ? "partial" : "hidden"),
          element: ({ elementId }) => (elementId === ids.elementToShow ? "visible" : "hidden"),
        },
      });
    });

    it("if model is hidden, showing element removes all other model elements from the always drawn list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const otherModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;

        const modelElements = [
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
        ];

        const otherModelElements = [
          insertPhysicalElement({ builder, modelId: otherModel, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: otherModel, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: otherModel, categoryId: category }).id,
        ];

        return { model, category, modelElements, otherModelElements, allElements: [...modelElements, ...otherModelElements] };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      const elementToShow = ids.modelElements[0];
      viewport.setAlwaysDrawn(new Set(ids.allElements));
      viewport.renderFrame();

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: VisibilityExpectations.all("hidden"),
      });

      await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category, elementId: elementToShow }), true);
      viewport.renderFrame();

      expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementToShow, ...ids.otherModelElements]));
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: (id) => (id === ids.model ? { tree: "partial", modelSelector: true } : { tree: "hidden", modelSelector: false }),
          category: ({ modelId }) => ({ tree: modelId === ids.model ? "partial" : "hidden", categorySelector: false, perModelCategoryOverride: "none" }),
          groupingNode: ({ elementIds }) => (elementIds.includes(elementToShow) ? "partial" : "hidden"),
          element: ({ elementId }) => (elementId === elementToShow ? "visible" : "hidden"),
        },
      });
    });

    it("model gets hidden when elements from other model are added to the exclusive always drawn list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId });

        const exclusiveModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;
        const exclusiveElement = insertPhysicalElement({ builder, modelId: exclusiveModel, categoryId }).id;
        insertPhysicalElement({ builder, modelId: exclusiveModel, categoryId });
        return { exclusiveModel, exclusiveElement };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode("0x1"), true);
      viewport.setAlwaysDrawn(new Set([ids.exclusiveElement]), true);
      viewport.renderFrame();
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: (id) => {
            if (id === ids.exclusiveModel) {
              return { tree: "partial", modelSelector: true };
            }
            return { tree: "hidden", modelSelector: true };
          },
          category: ({ modelId }) => {
            if (modelId === ids.exclusiveModel) {
              return { tree: "partial", categorySelector: false, perModelCategoryOverride: "show" };
            }
            return { tree: "hidden", categorySelector: false, perModelCategoryOverride: "show" };
          },
          groupingNode: ({ modelId }) => (modelId === ids.exclusiveModel ? "partial" : "hidden"),
          element: ({ elementId }) => (elementId === ids.exclusiveElement ? "visible" : "hidden"),
        },
      });
    });

    it("showing category makes its model visible in the viewport and per model override for that category is set to SHOW", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category });
        return { model, category };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createCategoryHierarchyNode(ids.model, ids.category), true);
      viewport.renderFrame();
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "visible",
          model: () => ({ tree: "visible", modelSelector: true }),
          category: () => ({ tree: "visible", categorySelector: false, perModelCategoryOverride: "show" }),
          groupingNode: () => "visible",
          element: () => "visible",
        },
      });
    });

    it("hiding category visible in selector adds it to per model override list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category });

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });
        return { model, category };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode(IModel.rootSubjectId), true);
      viewport.changeCategoryDisplay(ids.category, true, true);
      viewport.renderFrame();

      await handler.changeVisibility(createCategoryHierarchyNode(ids.model, ids.category), false);
      viewport.renderFrame();

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => ({ tree: "partial", modelSelector: true }),
          category: ({ categoryId }) =>
            categoryId === ids.category
              ? { tree: "hidden", categorySelector: true, perModelCategoryOverride: "hide" }
              : { tree: "visible", categorySelector: false, perModelCategoryOverride: "show" },
          groupingNode: ({ categoryId }) => (categoryId === ids.category ? "hidden" : "visible"),
          element: ({ categoryId }) => (categoryId === ids.category ? "hidden" : "visible"),
        },
      });
    });

    it("showing grouping node makes it and its grouped elements visible", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const parentElement = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
        const child = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: parentElement }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: child });

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });

        return { model, category, parentElement };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(
        createClassGroupingHierarchyNode({
          modelId: ids.model,
          categoryId: ids.category,
          elements: [ids.parentElement],
        }),
        true,
      );
      viewport.renderFrame();

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => ({ tree: "partial", modelSelector: true }),
          category: ({ categoryId }) =>
            categoryId === ids.category
              ? { tree: "partial", categorySelector: false, perModelCategoryOverride: "none" }
              : { tree: "hidden", categorySelector: false, perModelCategoryOverride: "none" },
          groupingNode: ({ elementIds }) => (elementIds.includes(ids.parentElement) ? "visible" : "hidden"),
          element: ({ elementId }) => (elementId === ids.parentElement ? "visible" : "hidden"),
        },
      });
    });

    it("hiding grouping node makes it and its grouped elements hidden", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const parentElement = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
        const child = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: parentElement }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: child });

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });

        return { model, category, parentElement };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode(IModel.rootSubjectId), true);
      viewport.renderFrame();
      await handler.changeVisibility(
        createClassGroupingHierarchyNode({
          modelId: ids.model,
          categoryId: ids.category,
          elements: [ids.parentElement],
        }),
        false,
      );
      viewport.renderFrame();

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => ({ tree: "partial", modelSelector: true }),
          category: ({ categoryId }) => ({
            tree: categoryId === ids.category ? "partial" : "visible",
            categorySelector: false,
            perModelCategoryOverride: "show",
          }),
          groupingNode: ({ elementIds }) => (elementIds.includes(ids.parentElement) ? "hidden" : "visible"),
          element: ({ elementId }) => (elementId === ids.parentElement ? "hidden" : "visible"),
        },
      });
    });

    it("changing merged category visibility changes child elements visibility", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const category1 = insertSpatialCategory({ builder, codeValue: "category1", userLabel: "SomeLabel" }).id;
        const category2 = insertSpatialCategory({ builder, codeValue: "category2", userLabel: "SomeLabel" }).id;
        const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category1 }).id;
        const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category2 }).id;
        return { model, element1, element2, category1, category2 };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createCategoryHierarchyNode(ids.model, [ids.category1, ids.category2]), true);
      viewport.renderFrame();

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: VisibilityExpectations.all("visible"),
      });
    });

    it("changing element visibility changes merged parent category visibility", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const category1 = insertSpatialCategory({ builder, codeValue: "category1", userLabel: "SomeLabel" }).id;
        const category2 = insertSpatialCategory({ builder, codeValue: "category2", userLabel: "SomeLabel" }).id;
        const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category1 }).id;
        const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category2 }).id;
        return { model, element1, element2, category1, category2 };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category2, elementId: ids.element2 }), true);
      // Need to render frame for always/never drawn change event to fire
      viewport.renderFrame();

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => "partial",
          category: () => "partial",
          groupingNode: () => "partial",
          element: (props) => (props.elementId === ids.element2 ? "visible" : "hidden"),
        },
      });
      await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category1, elementId: ids.element1 }), true);
      // Need to render frame for always/never drawn change event to fire
      viewport.renderFrame();
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: VisibilityExpectations.all("visible"),
      });
    });

    describe("child element category is different than parent's", () => {
      it("model visibility takes into account all element categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const parentCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const childCategory = insertSpatialCategory({ builder, codeValue: "childCategory" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: childCategory.id, parentId: parentElement.id });
          return { modelId: model.id, parentCategoryId: parentCategory.id, parentElementId: parentElement.id };
        });
        const { imodel, modelId, parentCategoryId, parentElementId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;
        const parentCategoryNode = createCategoryHierarchyNode(modelId, parentCategoryId);

        await handler.changeVisibility(parentCategoryNode, true);
        viewport.renderFrame();
        await validateHierarchyVisibility({
          ...props,
          handler,
          viewport,
          visibilityExpectations: {
            // Only categories of elements without parents are shown in the tree
            category: () => "visible",
            subject: () => "partial",
            model: () => "partial",
            groupingNode: ({ elementIds }) => (elementIds.includes(parentElementId) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === parentElementId ? "visible" : "hidden"),
          },
        });
      });

      it("model visibility takes into account all element categories when some elements are in always drawn list", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const parentCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const childCategory = insertSpatialCategory({ builder, codeValue: "childCategory" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          const childElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: childCategory.id, parentId: parentElement.id });
          return { modelId: model.id, parentCategoryId: parentCategory.id, parentElementId: parentElement.id, childElementId: childElement.id };
        });
        const { imodel, modelId, parentCategoryId, parentElementId, childElementId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;
        const parentCategoryNode = createCategoryHierarchyNode(modelId, parentCategoryId);
        await handler.changeVisibility(parentCategoryNode, true);
        viewport.setAlwaysDrawn(new Set([...(viewport.alwaysDrawn ?? []), parentElementId]));
        viewport.renderFrame();
        await validateHierarchyVisibility({
          ...props,
          handler,
          viewport,
          visibilityExpectations: {
            // Only categories of elements without parents are shown in the tree
            category: () => "visible",
            subject: () => "partial",
            model: () => "partial",
            groupingNode: ({ elementIds }) => (!elementIds.includes(childElementId) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId !== childElementId ? "visible" : "hidden"),
          },
        });
      });

      it("changing category visibility of hidden model does not turn on unrelated elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const parentCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const parentCategory2 = insertSpatialCategory({ builder, codeValue: "parentCategory2" });
          const childCategory = insertSpatialCategory({ builder, codeValue: "childCategory" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          const parentElement2 = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory2.id });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: childCategory.id, parentId: parentElement2.id });
          return { modelId: model.id, parentCategoryId: parentCategory.id, parentElementId: parentElement.id, childCategoryId: childCategory.id };
        });
        const { imodel, modelId, parentCategoryId, parentElementId, childCategoryId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;
        const modelNode = createModelHierarchyNode(modelId, true);
        // Make child category enabled through category selector
        viewport.changeCategoryDisplay(childCategoryId, true);
        await handler.changeVisibility(modelNode, false);

        const parentCategoryNode = createCategoryHierarchyNode(modelId, parentCategoryId);
        // Changing category for hidden model should put all other categories into Hide overrides
        await handler.changeVisibility(parentCategoryNode, true);
        viewport.renderFrame();
        await validateHierarchyVisibility({
          ...props,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            category: ({ categoryId }) => (categoryId === parentCategoryId ? "visible" : "hidden"),
            model: () => "partial",
            groupingNode: ({ elementIds }) => (elementIds.includes(parentElementId) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === parentElementId ? "visible" : "hidden"),
          },
        });
      });

      it("changing category visibility turns on child elements that have the same category", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const sharedCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const parentCategory2 = insertSpatialCategory({ builder, codeValue: "parentCategory2" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          insertPhysicalElement({ builder, modelId: model.id, categoryId: sharedCategory.id });
          const parentElement2 = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory2.id });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: sharedCategory.id, parentId: parentElement2.id });
          return { modelId: model.id, parentCategoryId: sharedCategory.id, parentElementId: parentElement2.id };
        });
        const { imodel, modelId, parentCategoryId, parentElementId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;

        const parentCategoryNode = createCategoryHierarchyNode(modelId, parentCategoryId);
        // Changing category for hidden model should put all other categories into Hide overrides
        await handler.changeVisibility(parentCategoryNode, true);
        viewport.renderFrame();
        await validateHierarchyVisibility({
          ...props,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            category: ({ categoryId }) => (categoryId === parentCategoryId ? "visible" : "hidden"),
            model: () => "partial",
            groupingNode: ({ elementIds }) => (!elementIds.includes(parentElementId) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId !== parentElementId ? "visible" : "hidden"),
          },
        });
      });

      it("category visibility only takes into account element trees that start with those that have no parents", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const category = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });
          const element = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });

          const unrelatedParentCategory = insertSpatialCategory({ builder, codeValue: "differentParentCategory" });
          const unrelatedParentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: unrelatedParentCategory.id });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: unrelatedParentElement.id });

          return { modelId: model.id, categoryId: category.id, elementId: element.id, unrelatedCategoryId: unrelatedParentCategory.id };
        });
        const { imodel, modelId, categoryId, elementId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...testProps } = visibilityTestData;
        const elementNode = createElementHierarchyNode({ modelId, categoryId, elementId });

        await handler.changeVisibility(elementNode, true);
        viewport.renderFrame();
        await validateHierarchyVisibility({
          ...testProps,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => ({ tree: "partial", modelSelector: true }),
            category: (props) => ({
              tree: props.categoryId === categoryId ? "visible" : "hidden",
              categorySelector: false,
              perModelCategoryOverride: "none",
            }),
            groupingNode: ({ elementIds }) => (elementIds.includes(elementId) ? "visible" : "hidden"),
            element: (props) => (props.elementId === elementId ? "visible" : "hidden"),
          },
        });
      });
    });

    describe("reacting to category selector", () => {
      async function createIModel(context: Mocha.Context) {
        return buildIModel(context, async (builder) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const category1 = insertSpatialCategory({ builder, codeValue: "category1" });
          const elements1 = [
            insertPhysicalElement({ builder, categoryId: category1.id, modelId: model.id }).id,
            insertPhysicalElement({ builder, categoryId: category1.id, modelId: model.id }).id,
          ];

          const category2 = insertSpatialCategory({ builder, codeValue: "category2" });
          const elements2 = [
            insertPhysicalElement({ builder, categoryId: category2.id, modelId: model.id }).id,
            insertPhysicalElement({ builder, categoryId: category2.id, modelId: model.id }).id,
          ];
          return { firstCategoryId: category1.id, secondCategoryId: category2.id, modelId: model.id, elements1, elements2 };
        });
      }

      it("showing category via the selector makes category and all elements visible when it has no always or never drawn elements", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, secondCategoryId, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
        });

        viewport.changeCategoryDisplay([firstCategoryId, secondCategoryId], true, true);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
        });
      });

      it("hiding category via the selector makes category and all elements hidden when it has no always or never drawn elements", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, secondCategoryId, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);
        viewport.changeCategoryDisplay([firstCategoryId, secondCategoryId], true, true);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
        });

        viewport.changeCategoryDisplay([firstCategoryId, secondCategoryId], false);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
        });
      });

      it("hiding category via the selector makes it hidden when it only has never drawn elements", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, modelId, elements1 } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);
        viewport.changeCategoryDisplay(firstCategoryId, true, true);
        const elementId = elements1[0];
        viewport.setNeverDrawn(new Set([elementId]));
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => ({ tree: "partial", modelSelector: true }),
            category: ({ categoryId }) => (categoryId === firstCategoryId ? "partial" : "hidden"),
            groupingNode: ({ categoryId }) => (categoryId === firstCategoryId ? "partial" : "hidden"),
            element: (props) => (props.categoryId === firstCategoryId && props.elementId !== elementId ? "visible" : "hidden"),
          },
        });

        viewport.changeCategoryDisplay([firstCategoryId], false);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
        });
      });

      it("showing category via the selector makes it visible when it only has always drawn elements", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, secondCategoryId, elements1, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);
        viewport.changeCategoryDisplay(secondCategoryId, true, true);
        const elementId = elements1[0];
        viewport.setAlwaysDrawn(new Set([elementId]));
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => ({ tree: "partial", modelSelector: true }),
            category: ({ categoryId }) => (categoryId === firstCategoryId ? "partial" : "visible"),
            groupingNode: ({ categoryId }) => (categoryId === firstCategoryId ? "partial" : "visible"),
            element: (props) => (props.categoryId === firstCategoryId && props.elementId !== elementId ? "hidden" : "visible"),
          },
        });

        viewport.changeCategoryDisplay(firstCategoryId, true, true);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
        });
      });

      it("model is visible if category is disabled in selector but all category's elements are always drawn", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, secondCategoryId, elements1, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);
        viewport.changeCategoryDisplay([firstCategoryId, secondCategoryId], true, true);
        viewport.setAlwaysDrawn(new Set(elements1));
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
        });

        viewport.changeCategoryDisplay(firstCategoryId, false);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
        });
      });

      it("model is hidden if category is enabled in selector but all category's elements are never drawn", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, elements1, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);
        viewport.setNeverDrawn(new Set(elements1));
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
        });

        viewport.changeCategoryDisplay(firstCategoryId, true, true);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
        });
      });
    });

    describe("Custom Hierarchy configuration", () => {
      /**
       * Creates physical model that has one spatial category that contains contains 3 child elements
       * out of which the first and second belong to the same custom class while the last element is of class `PhysicalObject`
       */
      async function createHierarchyConfigurationModel(context: Mocha.Context) {
        return buildIModel(context, async (builder, schema) => {
          const emptyPartitionId = insertPhysicalPartition({ builder, codeValue: "EmptyPhysicalModel", parentId: IModel.rootSubjectId }).id;
          const emptyModelId = insertPhysicalSubModel({ builder, modeledElementId: emptyPartitionId }).id;

          const customClassName = schema.items.SubModelablePhysicalObject.fullName;

          const partitionId = insertPhysicalPartition({ builder, codeValue: "ConfigurationPhysicalModel ", parentId: IModel.rootSubjectId }).id;
          const configurationModelId = insertPhysicalSubModel({ builder, modeledElementId: partitionId }).id;
          const modelCategories = new Array<string>();

          const configurationCategoryId = insertSpatialCategory({ builder, codeValue: `ConfigurationSpatialCategory` }).id;
          modelCategories.push(configurationCategoryId);
          const elements = new Array<Id64String>();

          for (let childIdx = 0; childIdx < 3; ++childIdx) {
            const props: GeometricElement3dProps = {
              model: configurationModelId,
              category: configurationCategoryId,
              code: new Code({ scope: partitionId, spec: "", value: `Configuration_${customClassName}_${childIdx}` }),
              classFullName: childIdx !== 2 ? customClassName : "Generic:PhysicalObject",
            };
            elements.push(builder.insertElement(props));
          }
          const [customClassElement1, customClassElement2, nonCustomClassElement] = elements;

          const hierarchyConfig: typeof defaultHierarchyConfiguration = {
            ...defaultHierarchyConfiguration,
            showEmptyModels: true,
            elementClassSpecification: customClassName,
          };

          return {
            configurationModelId,
            configurationCategoryId,
            elements,
            customClassElement1,
            customClassElement2,
            nonCustomClassElement,
            modelCategories,
            emptyModelId,
            customClassName,
            hierarchyConfig,
          };
        });
      }

      describe("subject with empty model", () => {
        const node = createSubjectHierarchyNode(IModel.rootSubjectId);

        it("empty model hidden by default", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("hidden"),
          });
        });

        it("showing it makes empty model visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(node, true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });
        });

        it("gets partial when only empty model is visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, emptyModelId } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createModelHierarchyNode(emptyModelId), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === emptyModelId ? { tree: "visible", modelSelector: true } : { tree: "hidden", modelSelector: false }),
              category: () => ({ tree: "hidden", categorySelector: false, perModelCategoryOverride: "none" }),
              groupingNode: () => "hidden",
              element: () => "hidden",
            },
          });
        });
      });

      describe("model with custom class specification elements", () => {
        it("showing it makes it, all its categories and elements visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, configurationModelId } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createModelHierarchyNode(configurationModelId), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: {
              ...VisibilityExpectations.all("visible"),
              subject: () => "partial",
              model: (id) => (id === configurationModelId ? { tree: "visible", modelSelector: true } : { tree: "hidden", modelSelector: false }),
            },
          });
        });

        it("gets partial when custom class element is visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, configurationModelId, configurationCategoryId, customClassElement1 } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: configurationModelId,
              categoryId: configurationCategoryId,
              hasChildren: true,
              elementId: customClassElement1,
            }),
            true,
          );
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([customClassElement1]));
          viewport.renderFrame();

          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === configurationModelId ? { tree: "partial", modelSelector: true } : { tree: "hidden", modelSelector: false }),
              category: ({ modelId }) => ({
                tree: modelId === configurationModelId ? "partial" : "hidden",
                categorySelector: false,
                perModelCategoryOverride: "none",
              }),
              groupingNode: () => "partial",
              element: ({ elementId }) => (elementId === customClassElement1 ? "visible" : "hidden"),
            },
          });
        });

        it("gets visible when all custom class elements are visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, configurationModelId, configurationCategoryId, customClassElement1, customClassElement2, nonCustomClassElement } =
            buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: configurationModelId,
              categoryId: configurationCategoryId,
              hasChildren: true,
              elementId: customClassElement1,
            }),
            true,
          );
          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: configurationModelId,
              categoryId: configurationCategoryId,
              hasChildren: true,
              elementId: customClassElement2,
            }),
            true,
          );
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([customClassElement1, customClassElement2]));
          viewport.renderFrame();

          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === configurationModelId ? { tree: "visible", modelSelector: true } : { tree: "hidden", modelSelector: false }),
              category: ({ modelId }) => ({
                tree: modelId === configurationModelId ? "visible" : "hidden",
                categorySelector: false,
                perModelCategoryOverride: "none",
              }),
              groupingNode: ({ elementIds }) => (elementIds.includes(nonCustomClassElement) ? "hidden" : "visible"),
              element: ({ modelId }) => (modelId === nonCustomClassElement ? "hidden" : "visible"),
            },
          });
        });
      });
    });

    describe("IsAlwaysDrawnExclusive is true", () => {
      it("changing model visibility does not affect other models", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const model1 = insertPhysicalModelWithPartition({ builder, codeValue: "1" }).id;
          const category1 = insertSpatialCategory({ builder, codeValue: "category1" }).id;
          const element1 = insertPhysicalElement({ builder, modelId: model1, categoryId: category1 }).id;
          const element2 = insertPhysicalElement({ builder, modelId: model1, categoryId: category1 }).id;

          const otherModel = insertPhysicalModelWithPartition({ builder, codeValue: "2" }).id;
          const otherCategory = insertSpatialCategory({ builder, codeValue: "category2" }).id;
          insertPhysicalElement({ builder, modelId: otherModel, categoryId: otherCategory });

          return { model1, category1, element1, element2, otherModel, otherCategory };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay(ids.model1, true);
        viewport.setAlwaysDrawn(new Set([ids.element2]), true);
        viewport.renderFrame();
        await handler.changeVisibility(createModelHierarchyNode(ids.model1), true);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: (id) => (id === ids.model1 ? "visible" : "hidden"),
            category: ({ categoryId }) => (categoryId === ids.category1 ? "visible" : "hidden"),
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.element1) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === ids.element1 || elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
      });

      it("changing category visibility does not affect other categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "1" }).id;
          const category1 = insertSpatialCategory({ builder, codeValue: "category1" }).id;
          const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category1 }).id;
          const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category1 }).id;

          const otherCategory = insertSpatialCategory({ builder, codeValue: "category2" }).id;
          insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });

          return { model, category1, element1, element2, otherCategory };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay(ids.model, true);
        viewport.setAlwaysDrawn(new Set([ids.element2]), true);
        viewport.renderFrame();
        await handler.changeVisibility(createCategoryHierarchyNode(ids.model, ids.category1, true), true);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => "partial",
            category: ({ categoryId }) => (categoryId === ids.category1 ? "visible" : "hidden"),
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.element1) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === ids.element1 || elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
      });

      it("changing class grouping node visibility does not affect other class grouping nodes", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder, testSchema) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "1" }).id;
          const category = insertSpatialCategory({ builder, codeValue: "category1" }).id;
          const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
          const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;

          insertPhysicalElement({
            builder,
            userLabel: `element`,
            modelId: model,
            categoryId: category,
            classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
          });

          return { model, category, element1, element2 };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay(ids.model, true);
        viewport.setAlwaysDrawn(new Set([ids.element2]), true);
        viewport.renderFrame();
        await handler.changeVisibility(
          createClassGroupingHierarchyNode({ elements: [ids.element1, ids.element2], categoryId: ids.category, modelId: ids.model }),
          true,
        );
        viewport.renderFrame();

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => "partial",
            category: () => "partial",
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.element1) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === ids.element1 || elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
      });

      it("changing element visibility does not affect other elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "1" }).id;
          const category = insertSpatialCategory({ builder, codeValue: "category1", userLabel: "SomeLabel" }).id;
          const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
          const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;

          return { model, category, element1, element2 };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay(ids.model, true);
        viewport.setAlwaysDrawn(new Set([ids.element2]), true);
        viewport.renderFrame();
        await handler.changeVisibility(createElementHierarchyNode({ elementId: ids.element1, categoryId: ids.category, modelId: ids.model }), true);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => "partial",
            category: () => "partial",
            groupingNode: () => "partial",
            element: ({ elementId }) => (elementId === ids.element1 || elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
      });
    });
  });
});

/** Copied from https://github.com/iTwin/appui/blob/c3683b8acef46572c661c4fa1b7933747a76d3c1/apps/test-providers/src/createBlankConnection.ts#L26 */
function createBlankViewState(iModel: IModelConnection) {
  const ext = iModel.projectExtents;
  const viewState = SpatialViewState.createBlank(iModel, ext.low, ext.high.minus(ext.low));

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

  return viewState;
}

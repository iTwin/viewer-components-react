/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ColorDef, IModel, IModelReadRpcInterface, RenderMode } from "@itwin/core-common";
import { IModelApp, NoRenderApp, OffScreenViewport, SpatialViewState, ViewRect } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider, HierarchyNode } from "@itwin/presentation-hierarchies";
import { InstanceKey } from "@itwin/presentation-shared";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { ModelsTreeIdsCache } from "../../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { createModelsTreeVisibilityHandler } from "../../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeVisibilityHandler.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import {
  buildIModel,
  importSchema,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubject,
} from "../../../../IModelUtils.js";
import { TestUtils } from "../../../../TestUtils.js";
import { createIModelAccess } from "../../../Common.js";
import { validateHierarchyVisibility, VisibilityExpectations } from "../VisibilityValidation.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyNodeIdentifiersPath, HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { Id64String } from "@itwin/core-bentley";
import type { ValidateNodeProps } from "../VisibilityValidation.js";

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

    describe("filtered nodes", () => {
      function createFilteredVisibilityTestData({
        imodel,
        filterPaths,
      }: Parameters<typeof createVisibilityTestData>[0] & { filterPaths: HierarchyNodeIdentifiersPath[] }) {
        const commonProps = createCommonProps({ imodel });
        const handler = createModelsTreeVisibilityHandler({ ...commonProps, filteredPaths: filterPaths });
        const defaultProvider = createProvider(commonProps);
        const filteredProvider = createProvider({ ...commonProps, filterPaths });
        return {
          handler,
          defaultProvider,
          filteredProvider,
          ...commonProps,
          [Symbol.dispose]() {
            commonProps.idsCache[Symbol.dispose]();
            handler[Symbol.dispose]();
            defaultProvider[Symbol.dispose]();
            commonProps.viewport[Symbol.dispose]();
            filteredProvider[Symbol.dispose]();
          },
        };
      }

      async function getNodeMatchingPath(provider: HierarchyProvider, identifierPath: InstanceKey[], parentNode?: HierarchyNode): Promise<HierarchyNode> {
        for (const [idx, pathKey] of identifierPath.entries()) {
          let newParentNode: HierarchyNode | undefined;
          for await (const node of provider.getNodes({ parentNode })) {
            if (HierarchyNode.isClassGroupingNode(node)) {
              if (node.key.className === pathKey.className) {
                return getNodeMatchingPath(provider, identifierPath.slice(idx + 1), node);
              }
              continue;
            }

            assert(HierarchyNode.isInstancesNode(node));
            const nodeKey = node.key.instanceKeys[0];
            if (InstanceKey.equals(nodeKey, pathKey)) {
              newParentNode = node;
              break;
            }
          }

          assert(!!newParentNode, `Couldn't find a node matching path: ${JSON.stringify(identifierPath, undefined, 2)}`);
          parentNode = newParentNode;
        }

        assert(!!parentNode, `Couldn't find a node matching path: ${JSON.stringify(identifierPath, undefined, 2)}`);
        return parentNode;
      }

      describe("single path to element", () => {
        it("switches on only filtered hierarchy when root node is clicked", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const filterTargetElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });

            const unfilteredCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" });
            const unfilteredModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" });
            insertPhysicalElement({ builder, modelId: unfilteredModel.id, categoryId: unfilteredCategory.id });

            return {
              model,
              category,
              filterTargetElement,
              filterPaths: [[model, category, filterTargetElement]],
            };
          });

          const { imodel, filterPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { handler, viewport, defaultProvider, filteredProvider } = visibilityTestData;
          const node = await getNodeMatchingPath(filteredProvider, [keys.model]);
          await handler.changeVisibility(node, true);
          viewport.renderFrame();

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === keys.model.id ? "visible" : "hidden"),
              category: ({ modelId }) => (modelId === keys.model.id ? "visible" : "hidden"),
              groupingNode: ({ modelId }) => (modelId === keys.model.id ? "visible" : "hidden"),
              element: ({ modelId }) => (modelId === keys.model.id ? "visible" : "hidden"),
            },
          });
        });
      });

      describe("path to elements in different categories", () => {
        async function createIModel(context: Mocha.Context) {
          return buildIModel(context, async (builder) => {
            const filteredCategories = [
              insertSpatialCategory({ builder, codeValue: "category1" }),
              insertSpatialCategory({ builder, codeValue: "category2" }),
              insertSpatialCategory({ builder, codeValue: "category3" }),
            ];
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const paths: InstanceKey[][] = [];
            const filterTargets = new Set<Id64String>();
            filteredCategories.forEach((category) => {
              const filterTarget = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
              paths.push([model, category, filterTarget]);
              filterTargets.add(filterTarget.id);

              insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            });

            const unfilteredCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" });
            const unfilteredModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" });
            insertPhysicalElement({ builder, modelId: unfilteredModel.id, categoryId: unfilteredCategory.id });

            return {
              model,
              filteredCategories,
              filterPaths: paths,
              filterTargetElements: filterTargets,
            };
          });
        }

        it("switches on only filtered hierarchy when root node is clicked", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, filterPaths, filterTargetElements, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { handler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

          const node = await getNodeMatchingPath(filteredProvider, [keys.model]);
          await handler.changeVisibility(node, true);
          viewport.renderFrame();

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === keys.model.id ? "partial" : "hidden"),
              category: ({ modelId }) => (modelId === keys.model.id ? "partial" : "hidden"),
              groupingNode: ({ modelId }) => (modelId === keys.model.id ? "partial" : "hidden"),
              element: ({ elementId }) => (filterTargetElements.has(elementId) ? "visible" : "hidden"),
            },
          });
        });

        it("switches on only filtered hierarchy when one of the filtered categories is clicked", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, filterPaths, filteredCategories, filterTargetElements, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { handler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

          const pathToCategory = [keys.model, filteredCategories[0]];
          const node = await getNodeMatchingPath(filteredProvider, pathToCategory);
          await handler.changeVisibility(node, true);
          viewport.renderFrame();

          const clickedCategoryId = filteredCategories[0].id;

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: () => "partial",
              category: ({ categoryId }) => (categoryId === clickedCategoryId ? "visible" : "hidden"),
              groupingNode: ({ categoryId }) => (categoryId === clickedCategoryId ? "visible" : "hidden"),
              element: ({ categoryId }) => (categoryId === clickedCategoryId ? "visible" : "hidden"),
            },
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === keys.model.id ? "partial" : "hidden"),
              category: ({ categoryId }) => (categoryId === clickedCategoryId ? "partial" : "hidden"),
              groupingNode: ({ categoryId }) => (categoryId === clickedCategoryId ? "partial" : "hidden"),
              element: ({ categoryId, elementId }) => (categoryId === clickedCategoryId && filterTargetElements.has(elementId) ? "visible" : "hidden"),
            },
          });
        });
      });

      describe("multiple paths to a category and element under it", () => {
        async function createIModel(context: Mocha.Context) {
          return buildIModel(context, async (builder) => {
            const filterPaths = new Array<InstanceKey[]>();
            const subjectIds = new Array<Id64String>();
            const modelIds = new Array<Id64String>();

            const parentSubject = insertSubject({ builder, codeValue: `parent subject`, parentId: IModel.rootSubjectId });

            for (let i = 0; i < 2; ++i) {
              const subject = insertSubject({ builder, codeValue: `subject${i}`, parentId: parentSubject.id });
              const model = insertPhysicalModelWithPartition({ builder, partitionParentId: subject.id, codeValue: `model${i}` });
              const category = insertSpatialCategory({ builder, codeValue: `category${i}` });
              const elements = [
                insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id }),
                insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id }),
              ];
              subjectIds.push(subject.id);
              modelIds.push(model.id);
              filterPaths.push([parentSubject, subject, model, category], [parentSubject, subject, model, category, elements[0]]);
            }

            return {
              parentSubject,
              subjectIds,
              modelIds,
              filterPaths,
            };
          });
        }

        it("when clicking on model turns on category and all its elements", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, filterPaths, parentSubject } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { handler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

          const node = await getNodeMatchingPath(filteredProvider, [parentSubject]);
          await handler.changeVisibility(node, true);
          viewport.renderFrame();

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });
        });

        it("when clicking on one of the categories it turns on only that category", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, filterPaths, parentSubject, subjectIds, modelIds } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { handler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

          const pathToCategory = filterPaths[0];
          const node = await getNodeMatchingPath(filteredProvider, pathToCategory);
          await handler.changeVisibility(node, true);
          viewport.renderFrame();

          const visibilityExpectations: ValidateNodeProps["visibilityExpectations"] = {
            subject: (id) => {
              if (id === parentSubject.id) {
                return "partial";
              }
              return id === subjectIds[0] ? "visible" : "hidden";
            },
            model: (id) => (id === modelIds[0] ? "visible" : "hidden"),
            category: ({ modelId }) => (modelId === modelIds[0] ? "visible" : "hidden"),
            groupingNode: ({ modelId }) => (modelId === modelIds[0] ? "visible" : "hidden"),
            element: ({ modelId }) => (modelId === modelIds[0] ? "visible" : "hidden"),
          };

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler,
            viewport,
            visibilityExpectations,
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler,
            viewport,
            visibilityExpectations,
          });
        });
      });

      it("class grouping node visibility only takes into account grouped elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const schemaContentXml = `
            <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
            <ECEntityClass typeName="PhysicalElement1">
              <BaseClass>bis:PhysicalElement</BaseClass>
            </ECEntityClass>
            <ECEntityClass typeName="PhysicalElement2">
              <BaseClass>bis:PhysicalElement</BaseClass>
            </ECEntityClass>
          `;

          const { PhysicalElement1, PhysicalElement2 } = (
            await importSchema({
              mochaContext: this,
              builder,
              schemaContentXml,
              schemaAlias: "test1",
            })
          ).items;

          const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
          const category = insertSpatialCategory({ builder, codeValue: "category1" });
          const element1 = insertPhysicalElement({ builder, classFullName: PhysicalElement1.fullName, modelId: model.id, categoryId: category.id });
          const element2 = insertPhysicalElement({ builder, classFullName: PhysicalElement2.fullName, modelId: model.id, categoryId: category.id });

          const paths = [
            [model, category, element1],
            [model, category, element2],
          ];

          return {
            firstElement: element1.id,
            pathToFirstElement: paths[0],
            filterPaths: paths,
          };
        });

        const { imodel, filterPaths, firstElement, pathToFirstElement } = buildIModelResult;
        using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
        const { handler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

        const node = await getNodeMatchingPath(filteredProvider, pathToFirstElement);
        await handler.changeVisibility(node, true);
        viewport.renderFrame();

        const visibilityExpectations: ValidateNodeProps["visibilityExpectations"] = {
          subject: () => "partial",
          model: () => "partial",
          category: () => "partial",
          groupingNode: ({ elementIds }) => (elementIds.includes(firstElement) ? "visible" : "hidden"),
          element: ({ elementId }) => (elementId === firstElement ? "visible" : "hidden"),
        };

        await validateHierarchyVisibility({
          provider: filteredProvider,
          handler,
          viewport,
          visibilityExpectations,
        });

        await validateHierarchyVisibility({
          provider: defaultProvider,
          handler,
          viewport,
          visibilityExpectations,
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

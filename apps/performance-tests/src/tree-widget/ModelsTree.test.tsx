/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect } from "vitest";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { ModelsTreeNode, SharedTreeContextProvider, useModelsTree } from "@itwin/tree-widget-react";
import {
  BaseIdsCache,
  createModelsTreeVisibilityHandler,
  defaultModelsTreeHierarchyConfiguration,
  ModelsTreeDefinition,
  ModelsTreeIdsCache,
} from "@itwin/tree-widget-react/internal";
import { act, renderHook } from "@testing-library/react";
import { Datasets } from "../util/Datasets.js";
import { run, TestIModelConnection } from "../util/TestUtilities.js";
import { countSearchTargets } from "./SearchUtils.js";
import { StatelessHierarchyProvider } from "./StatelessHierarchyProvider.js";
import {
  collectNodes,
  createCategoryHierarchyNode,
  createElementHierarchyNode,
  createModelHierarchyNode,
  createTestDataForInitialDisplay,
  createViewport,
  getVisibilityTargets,
  setupInitialDisplayState,
  validateHierarchyVisibility,
} from "./VisibilityUtilities.js";

import type { SnapshotDb } from "@itwin/core-backend";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyDefinition, HierarchyNode, HierarchyProvider, HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { ECSqlQueryDef, InstanceKey, Props } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "@itwin/tree-widget-react";
import type { IModelAccess } from "./StatelessHierarchyProvider.js";
import type { TreeWidgetTestingViewport } from "./VisibilityUtilities.js";

describe("models tree", () => {
  run<{
    iModel: SnapshotDb;
    iModelConnection: IModelConnection;
    imodelAccess: IModelAccess;
    viewport: TreeWidgetTestingViewport;
    targetItems: Array<InstanceKey>;
    searchPaths: HierarchySearchTree[] | undefined;
    hierarchyDefinition: HierarchyDefinition | undefined;
  }>({
    testName: "50k 3D elements search",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k 3D elements"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const viewport = await createViewport({ iModelConnection });
      const targetItems = new Array<InstanceKey>();
      const query: ECSqlQueryDef = {
        ecsql: `SELECT CAST(IdToHex(ECInstanceId) AS TEXT) AS ECInstanceId FROM bis.GeometricElement3d`,
      };
      for await (const row of imodelAccess.createQueryReader(query, { limit: "unbounded" })) {
        targetItems.push({ id: row.ECInstanceId, className: "Generic:PhysicalObject" });
      }
      return {
        iModel,
        iModelConnection,
        imodelAccess,
        targetItems,
        viewport,
        searchPaths: undefined as HierarchySearchTree[] | undefined,
        hierarchyDefinition: undefined as HierarchyDefinition | undefined,
      };
    },
    cleanup: async ({ iModelConnection, viewport, iModel }) => {
      iModel.close();
      viewport[Symbol.dispose]();
      if (!iModelConnection.isClosed) {
        await iModelConnection.close();
      }
    },
    steps: [
      {
        name: "get search paths",
        callBack: async (ctx) => {
          using hook = renderUseModelsTreeHook({
            activeView: ctx.viewport,
            hierarchyConfig: defaultModelsTreeHierarchyConfiguration,
            getSearchPaths: async ({ createInstanceKeyPaths }) => createInstanceKeyPaths({ targetItems: ctx.targetItems }),
            searchLimit: "unbounded",
          });
          ctx.hierarchyDefinition = await act(async () => hook.result.current.treeProps.getHierarchyDefinition({ imodelAccess: ctx.imodelAccess }));
          ctx.searchPaths = await act(async () =>
            hook.result.current.treeProps.getSearchPaths!({ imodelAccess: ctx.imodelAccess, abortSignal: new AbortController().signal }),
          );
          expect(countSearchTargets(ctx.searchPaths!)).to.eq(50000);
        },
      },
      {
        name: "load hierarchy from search paths",
        callBack: async ({ imodelAccess, hierarchyDefinition, searchPaths }) => {
          using provider = new StatelessHierarchyProvider({
            imodelAccess,
            getHierarchyFactory: () => hierarchyDefinition!,
            search: { paths: searchPaths! },
          });
          const result = await provider.loadHierarchy({ shouldExpand: (node) => node.children && !!node.autoExpand });
          expect(result).to.eq(
            1 + // root subject
              1 + // model
              1 + // category
              1 + // root elements' class grouping node
              1000 * 2 + // root elements + class grouping nodes under them
              16 * 1000 * 2 + // elements under root elements + class grouping nodes under them
              16 * 1000 * 2 +
              1000, // indirect child elements
          ); // 67004 total
        },
      },
    ],
  });
  run<{
    iModel: SnapshotDb;
    imodelAccess: IModelAccess;
    viewport: TreeWidgetTestingViewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    elementsModel: Id64String;
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
  }>({
    testName: "50k categories",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k categories"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const visibilityTargets = await getVisibilityTargets(imodelAccess);
      const testData = createTestDataForInitialDisplay({ visibilityTargets, visible: false });

      const viewport = await createViewport({
        iModelConnection,
        testData,
      });
      setupInitialDisplayState({
        viewport,
        ...testData,
      });
      const baseIdsCache = new BaseIdsCache({
        elementClassName: defaultModelsTreeHierarchyConfiguration.elementClassSpecification,
        type: "3d",
        queryExecutor: imodelAccess,
      });
      const idsCache = new ModelsTreeIdsCache({
        queryExecutor: imodelAccess,
        hierarchyConfig: defaultModelsTreeHierarchyConfiguration,
        baseIdsCache,
      });
      const handler = createModelsTreeVisibilityHandler({ idsCache, viewport, imodelAccess });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ idsCache, imodelAccess, hierarchyConfig: defaultModelsTreeHierarchyConfiguration }),
        imodelAccess,
      });
      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      return { iModel, imodelAccess, viewport, provider, handler, elementsModel, iModelConnection, hierarchyNodes: [] };
    },
    cleanup: async ({ iModel, viewport, handler, provider, iModelConnection }) => {
      iModel.close();
      viewport[Symbol.dispose]();
      handler[Symbol.dispose]();
      provider[Symbol.dispose]();
      if (!iModelConnection.isClosed) {
        await iModelConnection.close();
      }
    },
    steps: [
      {
        name: "collect nodes",
        callBack: async (ctx) => {
          ctx.hierarchyNodes = await collectNodes({ provider: ctx.provider, ignoreChildren: (node) => ModelsTreeNode.isCategoryNode(node) });
        },
      },
      {
        name: "validate initial visibility",
        callBack: async ({ hierarchyNodes, handler, viewport }) => {
          await validateHierarchyVisibility({
            hierarchyNodes,
            handler,
            viewport,
            expectations: "all-hidden",
          });
        },
      },
      {
        name: "change visibility",
        callBack: async ({ viewport, handler, elementsModel }) => {
          // Add one element to always draw set to trigger additional queries
          viewport.setAlwaysDrawn({ elementIds: new Set([elementsModel]) });
          await handler.changeVisibility(createModelHierarchyNode(elementsModel), true);
        },
      },
      {
        name: "validate changed visibility",
        callBack: async ({ hierarchyNodes, handler, viewport }) => {
          await validateHierarchyVisibility({
            hierarchyNodes,
            handler,
            viewport,
            expectations: "all-visible",
          });
        },
      },
    ],
  });

  run<{
    iModel: SnapshotDb;
    imodelAccess: IModelAccess;
    viewport: TreeWidgetTestingViewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    elementsModel: Id64String;
    elementsCategory: Id64String;
    elementNodeData: { modelId: Id64String; categoryId: Id64String; elementId: Id64String; subjectId: Id64String };
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
    resetInitialVisibilityState: ({ shouldBeVisible }: { shouldBeVisible?: boolean }) => void;
  }>({
    testName: "50k 3D elements",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k 3D elements"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const visibilityTargets = await getVisibilityTargets(imodelAccess);
      const hiddenTestData = createTestDataForInitialDisplay({ visibilityTargets, visible: false });
      const visibleTestData = createTestDataForInitialDisplay({ visibilityTargets, visible: true });

      const viewport = await createViewport({
        iModelConnection,
        testData: hiddenTestData,
      });
      setupInitialDisplayState({
        viewport,
        ...hiddenTestData,
      });
      const baseIdsCache = new BaseIdsCache({
        elementClassName: defaultModelsTreeHierarchyConfiguration.elementClassSpecification,
        type: "3d",
        queryExecutor: imodelAccess,
      });
      const idsCache = new ModelsTreeIdsCache({
        queryExecutor: imodelAccess,
        hierarchyConfig: defaultModelsTreeHierarchyConfiguration,
        baseIdsCache,
      });
      const handler = createModelsTreeVisibilityHandler({ idsCache, viewport, imodelAccess });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ idsCache, imodelAccess, hierarchyConfig: defaultModelsTreeHierarchyConfiguration }),
        imodelAccess,
      });
      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      expect(visibilityTargets.categories.length).toBe(1);
      const elementsCategory = visibilityTargets.categories[0];
      const elementNodeData = { modelId: elementsModel, elementId: visibilityTargets.elements[0], categoryId: elementsCategory, subjectId: "0x1" };
      return {
        iModel,
        imodelAccess,
        viewport,
        provider,
        handler,
        elementsModel,
        elementsCategory,
        elementNodeData,
        iModelConnection,
        hierarchyNodes: [],
        resetInitialVisibilityState: ({ shouldBeVisible }: { shouldBeVisible?: boolean }) => {
          setupInitialDisplayState({
            viewport,
            ...(shouldBeVisible ? visibleTestData : hiddenTestData),
          });
        },
      };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      if (!props.iModelConnection.isClosed) {
        await props.iModelConnection.close();
      }
    },
    steps: [
      {
        name: "collect nodes",
        callBack: async (ctx) => {
          ctx.hierarchyNodes = await collectNodes({ provider: ctx.provider });
        },
      },
      {
        name: "validate initial visibility",
        callBack: async ({ hierarchyNodes, handler, viewport }) => {
          await validateHierarchyVisibility({
            hierarchyNodes,
            handler,
            viewport,
            expectations: "all-hidden",
          });
        },
      },
      {
        name: "change model visibility",
        callBack: async ({ handler, elementsModel }) => {
          await handler.changeVisibility(createModelHierarchyNode(elementsModel), true);
        },
      },
      {
        name: "validate changed model visibility",
        callBack: async ({ hierarchyNodes, handler, viewport }) => {
          await validateHierarchyVisibility({
            hierarchyNodes,
            handler,
            viewport,
            expectations: "all-visible",
          });
        },
      },
      {
        name: "make everything visible",
        callBack: async ({ resetInitialVisibilityState }) => {
          resetInitialVisibilityState({ shouldBeVisible: true });
        },
        ignoreMeasurement: true,
      },
      {
        name: "change category node visibility",
        callBack: async ({ handler, elementsCategory, elementsModel }) => {
          await handler.changeVisibility(createCategoryHierarchyNode(elementsCategory, elementsModel, true), false);
        },
      },
      {
        name: "validate changed category visibility",
        callBack: async ({ hierarchyNodes, handler, viewport }) => {
          await validateHierarchyVisibility({
            hierarchyNodes,
            handler,
            viewport,
            expectations: "all-hidden",
          });
        },
      },
      {
        name: "make everything visible and clear always/never drawn sets",
        callBack: ({ resetInitialVisibilityState, viewport }) => {
          resetInitialVisibilityState({ shouldBeVisible: true });
          viewport.clearAlwaysDrawn();
          viewport.clearNeverDrawn();
        },
        ignoreMeasurement: true,
      },
      {
        name: "validate per-model category override",
        callBack: async ({ hierarchyNodes, handler, viewport, elementsModel, elementsCategory }) => {
          viewport.setPerModelCategoryOverride({ modelIds: elementsModel, categoryIds: elementsCategory, override: "hide" });
          await validateHierarchyVisibility({
            hierarchyNodes,
            handler,
            viewport,
            expectations: "all-hidden",
          });
        },
      },
      {
        name: "reset to everything hidden",
        callBack: ({ resetInitialVisibilityState }) => {
          resetInitialVisibilityState({ shouldBeVisible: false });
        },
        ignoreMeasurement: true,
      },
      {
        name: "change element visibility",
        callBack: async ({ handler, elementNodeData }) => {
          await handler.changeVisibility(createElementHierarchyNode(elementNodeData), true);
        },
      },
      {
        name: "validate changed element visibility",
        callBack: async ({ hierarchyNodes, handler, viewport, elementNodeData }) => {
          await validateHierarchyVisibility({
            hierarchyNodes,
            handler,
            viewport,
            expectations: {
              default: "all-hidden",
              instances: {
                [elementNodeData.modelId]: "partial",
                [elementNodeData.subjectId]: "partial",
                [elementNodeData.categoryId]: "partial",
                [elementNodeData.elementId]: "visible",
              },
              parentIds: {
                [elementNodeData.elementId]: "visible",
              },
            },
          });
        },
      },
    ],
  });

  run<{
    iModel: SnapshotDb;
    imodelAccess: IModelAccess;
    viewport: TreeWidgetTestingViewport;
    handler: HierarchyVisibilityHandler & Disposable;
    provider: HierarchyProvider & Disposable;
    node: { modelId: Id64String; categoryId: Id64String; elementId: Id64String; subjectId: Id64String };
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
  }>({
    testName: "50k 3D child elements with different categories",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k 3D child elements with different categories"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const visibilityTargets = await getVisibilityTargets(imodelAccess);
      const testData = createTestDataForInitialDisplay({ visibilityTargets, visible: false });

      const viewport = await createViewport({
        iModelConnection,
        testData,
      });
      setupInitialDisplayState({
        viewport,
        ...testData,
        // lets child categories visible in selector except top most elements category
        categories: testData.categories.map((category, index) => ({ ...category, visible: index !== 0 })),
      });
      const baseIdsCache = new BaseIdsCache({
        elementClassName: defaultModelsTreeHierarchyConfiguration.elementClassSpecification,
        type: "3d",
        queryExecutor: imodelAccess,
      });
      const idsCache = new ModelsTreeIdsCache({
        queryExecutor: imodelAccess,
        hierarchyConfig: defaultModelsTreeHierarchyConfiguration,
        baseIdsCache,
      });
      const handler = createModelsTreeVisibilityHandler({ idsCache, viewport, imodelAccess });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ idsCache, imodelAccess, hierarchyConfig: defaultModelsTreeHierarchyConfiguration }),
        imodelAccess,
      });

      const elementsModel = iModel.elements.getElementProps(visibilityTargets.elements[0]).model;
      expect(visibilityTargets.categories.length).to.be.eq(3);
      const elementsCategory = visibilityTargets.categories[0];
      const node = { modelId: elementsModel, elementId: visibilityTargets.elements[0], categoryId: elementsCategory, subjectId: "0x1" };

      return { iModel, imodelAccess, viewport, provider, handler, node, iModelConnection, hierarchyNodes: [] };
    },
    cleanup: async (props) => {
      props.iModel.close();
      props.viewport[Symbol.dispose]();
      props.handler[Symbol.dispose]();
      props.provider[Symbol.dispose]();
      if (!props.iModelConnection.isClosed) {
        await props.iModelConnection.close();
      }
    },
    steps: [
      {
        name: "collect nodes",
        callBack: async (ctx) => {
          ctx.hierarchyNodes = await collectNodes({ provider: ctx.provider });
        },
      },
      {
        name: "validate initial visibility",
        callBack: async ({ hierarchyNodes, handler, viewport }) => {
          await validateHierarchyVisibility({
            hierarchyNodes,
            handler,
            viewport,
            expectations: "all-hidden",
          });
        },
      },
      {
        name: "change visibility",
        callBack: async ({ handler, node }) => {
          await handler.changeVisibility(createElementHierarchyNode(node), true);
        },
      },
      {
        name: "validate changed visibility",
        callBack: async ({ hierarchyNodes, handler, viewport, node }) => {
          await validateHierarchyVisibility({
            hierarchyNodes,
            handler,
            viewport,
            expectations: {
              default: "all-hidden",
              instances: {
                [node.modelId]: "partial",
                [node.subjectId]: "partial",
                [node.categoryId]: "partial",
                [node.elementId]: "visible",
              },
              parentIds: {
                [node.elementId]: "visible",
              },
            },
          });
        },
      },
    ],
  });
});

function renderUseModelsTreeHook(props: Props<typeof useModelsTree>) {
  const result = renderHook((hookProps) => useModelsTree(hookProps), {
    initialProps: props,
    wrapper: ({ children }) => <SharedTreeContextProvider>{children}</SharedTreeContextProvider>,
  });
  return { ...result, [Symbol.dispose]: () => result.unmount() };
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect } from "vitest";
import { assert } from "@itwin/core-bentley";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { SharedTreeContextProvider, useCategoriesTree } from "@itwin/tree-widget-react";
import {
  BaseIdsCache,
  CategoriesTreeDefinition,
  CategoriesTreeIdsCache,
  createCategoriesTreeVisibilityHandler,
  defaultCategoriesTreeHierarchyConfiguration,
} from "@itwin/tree-widget-react/internal";
import { act, renderHook } from "@testing-library/react";
import { Datasets } from "../util/Datasets.js";
import { run, TestIModelConnection } from "../util/TestUtilities.js";
import { countSearchTargets } from "./SearchUtils.js";
import { StatelessHierarchyProvider } from "./StatelessHierarchyProvider.js";
import {
  collectNodes,
  createDefinitionContainerHierarchyNode,
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
import type { Props } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "@itwin/tree-widget-react";
import type { IModelAccess } from "./StatelessHierarchyProvider.js";
import type { TreeWidgetTestingViewport } from "./VisibilityUtilities.js";

describe("categories tree", () => {
  run<{
    iModel: SnapshotDb;
    iModelConnection: IModelConnection;
    imodelAccess: IModelAccess;
    viewport: TreeWidgetTestingViewport;
    searchPaths: HierarchySearchTree[] | undefined;
    hierarchyDefinition: HierarchyDefinition | undefined;
  }>({
    testName: "50k subCategories search",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k subcategories"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const viewport = await createViewport({ iModelConnection });
      return {
        iModel,
        iModelConnection,
        imodelAccess,
        viewport,
        searchPaths: undefined as HierarchySearchTree[] | undefined,
        hierarchyDefinition: undefined as HierarchyDefinition | undefined,
      };
    },
    cleanup: async ({ iModelConnection, iModel, viewport }) => {
      iModel.close();
      viewport[Symbol.dispose]();
      if (!iModelConnection.isClosed) {
        await iModelConnection.close();
      }
    },
    testSteps: [
      {
        name: "get search paths",
        callBack: async (ctx) => {
          using hook = renderUseCategoriesTreeHook({
            activeView: ctx.viewport,
            hierarchyConfig: defaultCategoriesTreeHierarchyConfiguration,
            searchText: "sc",
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
            1 + // root definition container
              50 + // categories
              50 * 1000, // sub-categories
          ); // 50051 total
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
    definitionContainer: Id64String;
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
  }>({
    testName: "50k subCategories",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k subcategories"));
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
      const baseIdsCache = new BaseIdsCache({ elementClassName: "BisCore:GeometricElement3d", type: "3d", queryExecutor: imodelAccess });
      const idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      const handler = createCategoriesTreeVisibilityHandler({ imodelAccess, idsCache, viewport, hierarchyConfig: defaultCategoriesTreeHierarchyConfiguration });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new CategoriesTreeDefinition({
          idsCache,
          imodelAccess,
          viewType: "3d",
          hierarchyConfig: defaultCategoriesTreeHierarchyConfiguration,
        }),
        imodelAccess,
      });

      expect(visibilityTargets.definitionContainers.length).toBe(1);
      return {
        iModel,
        imodelAccess,
        viewport,
        provider,
        handler,
        definitionContainer: visibilityTargets.definitionContainers[0],
        iModelConnection,
        hierarchyNodes: [],
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
    testSteps: [
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
        callBack: async ({ handler, definitionContainer }) => {
          await handler.changeVisibility(createDefinitionContainerHierarchyNode(definitionContainer), true);
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
    rootDefinitionContainer: Id64String;
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
      const baseIdsCache = new BaseIdsCache({ elementClassName: "BisCore:GeometricElement3d", type: "3d", queryExecutor: imodelAccess });
      const idsCache = new CategoriesTreeIdsCache({ queryExecutor: imodelAccess, type: "3d", baseIdsCache });
      const handler = createCategoriesTreeVisibilityHandler({ imodelAccess, idsCache, viewport, hierarchyConfig: defaultCategoriesTreeHierarchyConfiguration });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new CategoriesTreeDefinition({
          idsCache,
          imodelAccess,
          viewType: "3d",
          hierarchyConfig: defaultCategoriesTreeHierarchyConfiguration,
        }),
        imodelAccess,
      });
      const categoriesDefinitionContainers = new Set<Id64String>();
      visibilityTargets.categories.forEach((categoryId) => {
        categoriesDefinitionContainers.add(iModel.elements.getElementProps(categoryId).model);
      });
      const rootDefinitionContainer = visibilityTargets.definitionContainers.find(
        (definitionContainerId) => !categoriesDefinitionContainers.has(definitionContainerId),
      );
      expect(rootDefinitionContainer).toBeDefined();
      assert(rootDefinitionContainer !== undefined);
      return { iModel, imodelAccess, viewport, provider, handler, rootDefinitionContainer, iModelConnection, hierarchyNodes: [] };
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
    testSteps: [
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
        callBack: async ({ handler, rootDefinitionContainer }) => {
          await handler.changeVisibility(createDefinitionContainerHierarchyNode(rootDefinitionContainer), true);
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
});

function renderUseCategoriesTreeHook(props: Props<typeof useCategoriesTree>) {
  const result = renderHook((hookProps) => useCategoriesTree(hookProps), {
    initialProps: props,
    wrapper: ({ children }) => <SharedTreeContextProvider>{children}</SharedTreeContextProvider>,
  });
  return { ...result, [Symbol.dispose]: () => result.unmount() };
}

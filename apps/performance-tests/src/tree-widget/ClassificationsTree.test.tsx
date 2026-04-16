/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect } from "vitest";
import { SnapshotDb } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { ClassificationsTreeNode, HierarchyVisibilityHandler, SharedTreeContextProvider, useClassificationsTree } from "@itwin/tree-widget-react";
import {
  BaseIdsCache,
  ClassificationsTreeDefinition,
  ClassificationsTreeIdsCache,
  createClassificationsTreeVisibilityHandler,
} from "@itwin/tree-widget-react/internal";
import { act, renderHook } from "@testing-library/react";
import { Datasets } from "../util/Datasets.js";
import { run, TestIModelConnection } from "../util/TestUtilities.js";
import { countSearchTargets } from "./SearchUtils.js";
import { StatelessHierarchyProvider } from "./StatelessHierarchyProvider.js";
import {
  collectNodes,
  createClassificationTableHierarchyNode,
  createTestDataForInitialDisplay,
  createViewport,
  getVisibilityTargets,
  setupInitialDisplayState,
  validateHierarchyVisibility,
} from "./VisibilityUtilities.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyDefinition, HierarchyNode, HierarchyProvider, HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { Props } from "@itwin/presentation-shared";
import type { IModelAccess } from "./StatelessHierarchyProvider.js";
import type { TreeWidgetTestingViewport } from "./VisibilityUtilities.js";

describe("classifications tree", () => {
  const rootClassificationSystemCode = "50k classifications";

  run<{
    iModel: SnapshotDb;
    iModelConnection: IModelConnection;
    imodelAccess: IModelAccess;
    viewport: TreeWidgetTestingViewport;
    searchPaths: HierarchySearchTree[] | undefined;
    hierarchyDefinition: HierarchyDefinition | undefined;
  }>({
    testName: "50k classifications search",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k classifications"));
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
          using hook = renderUseClassificationsTreeHook({
            activeView: ctx.viewport,
            hierarchyConfig: { rootClassificationSystemCode },
            searchText: "Classification",
            searchLimit: "unbounded",
          });
          ctx.hierarchyDefinition = await act(async () => hook.result.current.treeProps.getHierarchyDefinition({ imodelAccess: ctx.imodelAccess }));
          ctx.searchPaths = await act(async () =>
            hook.result.current.treeProps.getSearchPaths!({
              imodelAccess: ctx.imodelAccess,
              abortSignal: new AbortController().signal,
            }),
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
          const result = await provider.loadHierarchy({
            shouldExpand: (node) => node.children && !!node.autoExpand,
          });
          // 50 classification tables should be loaded, each with 1000 classifications
          expect(result).toBe(
            50 + // classification tables
              25 * 1000 + // classifications
              25 * 1000, // child classifications
          );
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
    firstClassificationTable: Id64String;
    iModelConnection: IModelConnection;
    hierarchyNodes: HierarchyNode[];
  }>({
    testName: "50k classifications",
    setup: async () => {
      const { iModelConnection, iModel } = TestIModelConnection.openFile(Datasets.getIModelPath("50k classifications"));
      const imodelAccess = StatelessHierarchyProvider.createIModelAccess(iModel, "unbounded");
      const visibilityTargets = await getVisibilityTargets(imodelAccess, rootClassificationSystemCode);
      const testData = createTestDataForInitialDisplay({ visibilityTargets, visible: false });

      const viewport = await createViewport({
        iModelConnection,
        testData,
      });
      setupInitialDisplayState({
        viewport,
        ...testData,
      });
      const hierarchyConfig = { rootClassificationSystemCode };
      const baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, elementClassName: "BisCore:GeometricElement3d", type: "3d" });
      const idsCache = new ClassificationsTreeIdsCache({
        queryExecutor: imodelAccess,
        hierarchyConfig,
        baseIdsCache,
      });
      const handler = createClassificationsTreeVisibilityHandler({ imodelAccess, idsCache, viewport });
      const provider = createIModelHierarchyProvider({
        hierarchyDefinition: new ClassificationsTreeDefinition({
          getIdsCache: () => idsCache,
          imodelAccess,
          hierarchyConfig,
        }),
        imodelAccess,
      });
      expect(visibilityTargets.classificationTables.length).toBeGreaterThanOrEqual(1);
      const firstClassificationTable = visibilityTargets.classificationTables[0];
      return { iModel, imodelAccess, viewport, handler, provider, firstClassificationTable, iModelConnection, hierarchyNodes: [] };
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
          // Collect only classification tables and classifications
          ctx.hierarchyNodes = await collectNodes({
            provider: ctx.provider,
            ignoreChildren: (node) => ClassificationsTreeNode.isClassificationNode(node) && node.parentKeys.length === 2,
          });
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
        callBack: async ({ handler, firstClassificationTable }) => {
          await handler.changeVisibility(createClassificationTableHierarchyNode(firstClassificationTable), true);
        },
      },
      {
        name: "validate changed visibility",
        callBack: async ({ hierarchyNodes, handler, viewport, firstClassificationTable }) => {
          await validateHierarchyVisibility({
            hierarchyNodes,
            handler,
            viewport,
            expectations: {
              default: "all-hidden",
              instances: {
                [firstClassificationTable]: "visible",
              },
              parentIds: {
                [firstClassificationTable]: "visible",
              },
            },
          });
        },
      },
    ],
  });
});

function renderUseClassificationsTreeHook(props: Props<typeof useClassificationsTree>) {
  const result = renderHook((hookProps) => useClassificationsTree(hookProps), {
    initialProps: props,
    wrapper: ({ children }) => <SharedTreeContextProvider>{children}</SharedTreeContextProvider>,
  });
  return { ...result, [Symbol.dispose]: () => result.unmount() };
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { createStorage } from "@itwin/unified-selection";
import { FocusedInstancesContextProvider, useFocusedInstancesContext } from "../../../tree-widget-react/components/trees/common/FocusedInstancesContext.js";
import { SharedTreeContextProviderInternal } from "../../../tree-widget-react/components/trees/common/internal/SharedTreeContextProviderInternal.js";
import { useModelsTree } from "../../../tree-widget-react/components/trees/models-tree/UseModelsTree.js";
import { TreeWidget } from "../../../tree-widget-react/TreeWidget.js";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../IModelUtils.js";
import { act, renderHook, waitFor } from "../../TestUtils.js";
import { createFakeViewport, createIModelAccess } from "../Common.js";
import { createTreeWidgetTestingViewport } from "../TreeUtils.js";
import { createModelHierarchyNode } from "./Utils.js";

import type { Id64Array } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { SelectionStorage } from "@itwin/unified-selection";
import type { UseModelsTreeProps } from "../../../tree-widget-react/components/trees/models-tree/UseModelsTree.js";
import type { TreeWidgetTestingViewport } from "../TreeUtils.js";

describe("useModelsTree", () => {
  beforeAll(async () => {
    await initializePresentationTesting({
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
    await TreeWidget.initialize();
  });

  afterAll(async () => {
    await terminatePresentationTesting();
    TreeWidget.terminate();
  });

  it("preserves cache when search changes", async () => {
    await using buildIModelResult = await buildIModel(async (builder) => {
      const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
      const model = insertPhysicalModelWithPartition({ builder, codeValue: `model`, partitionParentId: rootSubject.id });
      const category = insertSpatialCategory({ builder, codeValue: "category" });
      insertPhysicalElement({ builder, userLabel: `element`, modelId: model.id, categoryId: category.id });
      return { modelId: model.id, categoryId: category.id, rootSubjectId: rootSubject.id };
    });
    const { imodel, ...keys } = buildIModelResult;
    const queryHandler = vi.fn(() => []);
    using viewport = createFakeViewport({ queryHandler });
    const imodelAccess = createIModelAccess(imodel);
    const {
      result: renderHookResult,
      rerender,
      unmount,
    } = renderHook(useModelsTree, {
      initialProps: {
        activeView: viewport,
        getSearchPaths: async () => [{ identifier: { id: keys.modelId, className: "BisCore.Model" } }],
      },
      wrapper: ({ children }) => <SharedTreeContextProviderInternal>{children}</SharedTreeContextProviderInternal>,
    });
    try {
      let getSearchPaths = renderHookResult.current.treeProps.getSearchPaths;
      using visibilityHandler1 = renderHookResult.current.treeProps.visibilityHandlerFactory({ imodelAccess });
      await waitFor(() => expect(getSearchPaths).toBeDefined());
      await act(async () => {
        await getSearchPaths!({ imodelAccess, abortSignal: new AbortController().signal });
        await visibilityHandler1.getVisibilityStatus(createModelHierarchyNode({ modelId: keys.modelId }));
      });
      await waitFor(() => expect(viewport.iModel.createQueryReader).toHaveBeenCalled());
      vi.mocked(viewport.iModel.createQueryReader).mockClear();
      queryHandler.mockClear();

      rerender({
        activeView: viewport,
        getSearchPaths: async () => [],
      });
      getSearchPaths = renderHookResult.current.treeProps.getSearchPaths;
      using visibilityHandler2 = renderHookResult.current.treeProps.visibilityHandlerFactory({ imodelAccess });
      await waitFor(() => expect(getSearchPaths).toBeDefined());
      await act(async () => {
        await getSearchPaths!({ imodelAccess, abortSignal: new AbortController().signal });
        await visibilityHandler2.getVisibilityStatus(createModelHierarchyNode({ modelId: keys.modelId }));
      });
      await waitFor(() => expect(viewport.iModel.createQueryReader).not.toHaveBeenCalled());
    } finally {
      // Unmount before test ends because:
      // 1. test ends -> `using` disposes the imodel -> `onClose` fires -> caches are disposed.
      // 2. React re-renders the still-mounted hook -> new caches are created.
      // 3. afterEach unmounts too late - newly created caches are never disposed of.
      unmount();
    }
  });

  describe("getSearchPaths", () => {
    describe("with getSubTreePaths", () => {
      const categoryClass = "BisCore.SpatialCategory";
      const elementClass = "BisCore.GeometricElement3d";
      const modelClass = "BisCore.GeometricModel3d";
      const subjectClass = "BisCore.Subject";
      let buildIModelResult: Awaited<ReturnType<typeof createIModel>> | undefined;
      let imodel: IModelConnection;
      let imodelAccess: ReturnType<typeof createIModelAccess>;
      let categoryIds: Id64Array;
      let elementIds: Id64Array;
      let modelIds: Id64Array;
      let viewport: TreeWidgetTestingViewport;
      let initialProps: UseModelsTreeProps;
      let getSubTreePaths: UseModelsTreeProps["getSubTreePaths"];
      let selectionStorage: SelectionStorage;

      async function createIModel(): Promise<
        { imodel: IModelConnection } & { models: Id64Array; categories: Id64Array; elements: Id64Array } & AsyncDisposable
      > {
        return buildIModel(async (builder) => {
          const physicalModel1 = insertPhysicalModelWithPartition({ builder, codeValue: "Model1" }).id;
          const physicalModel2 = insertPhysicalModelWithPartition({ builder, codeValue: "Model2" }).id;
          const physicalModel3 = insertPhysicalModelWithPartition({ builder, codeValue: "Model3" }).id;
          const category1 = insertSpatialCategory({ builder, codeValue: "SpatialCategory1", userLabel: "Category1" }).id;
          const category2 = insertSpatialCategory({ builder, codeValue: "SpatialCategory2", userLabel: "Category2" }).id;
          const category3 = insertSpatialCategory({ builder, codeValue: "SpatialCategory3", userLabel: "Category3" }).id;
          const element1 = insertPhysicalElement({ builder, codeValue: "element1", categoryId: category1, modelId: physicalModel1, userLabel: "Element1" }).id;
          const element2 = insertPhysicalElement({ builder, codeValue: "element2", categoryId: category2, modelId: physicalModel2, userLabel: "Element2" }).id;
          const element3 = insertPhysicalElement({ builder, codeValue: "element3", categoryId: category3, modelId: physicalModel3, userLabel: "Element3" }).id;
          return {
            models: [physicalModel1, physicalModel2, physicalModel3],
            categories: [category1, category2, category3],
            elements: [element1, element2, element3],
          };
        });
      }
      beforeAll(async () => {
        // eslint-disable-next-line @itwin/no-internal
        ECSchemaRpcImpl.register();
        buildIModelResult = await createIModel();
        imodel = buildIModelResult.imodel;
        categoryIds = buildIModelResult.categories;
        modelIds = buildIModelResult.models;
        elementIds = buildIModelResult.elements;
        viewport = createTreeWidgetTestingViewport({ visibleByDefault: false, iModel: imodel, viewType: "3d" });
        initialProps = { activeView: viewport };
        imodelAccess = createIModelAccess(imodel);
        getSubTreePaths = async ({ createInstanceKeyPaths }) => {
          return createInstanceKeyPaths({
            targetItems: [
              { className: elementClass, id: elementIds[0] },
              { className: categoryClass, id: categoryIds[1] },
            ],
          });
        };
        selectionStorage = createStorage();
      });

      beforeEach(() => {
        selectionStorage.clearStorage({ imodelKey: imodel.key });
      });

      afterAll(async () => {
        await buildIModelResult?.[Symbol.asyncDispose]();
      });

      it("getSearchPaths returns correct result when getSubTreePaths is not defined", async () => {
        const { result: renderHookResult } = renderHook(useModelsTree, {
          initialProps,
          wrapper: ({ children }) => <SharedTreeContextProviderInternal>{children}</SharedTreeContextProviderInternal>,
        });
        const { getSearchPaths } = renderHookResult.current.treeProps;
        expect(getSearchPaths).toBeUndefined();
      });

      it("getSearchPaths returns correct result when getSubTreePaths is defined", async () => {
        const { result: renderHookResult } = renderHook(useModelsTree, {
          initialProps: { ...initialProps, getSubTreePaths },
          wrapper: ({ children }) => <SharedTreeContextProviderInternal>{children}</SharedTreeContextProviderInternal>,
        });
        const { getSearchPaths } = renderHookResult.current.treeProps;
        const abortSignal = new AbortController().signal;
        await waitFor(async () => {
          expect(getSearchPaths).toBeDefined();
          const result = await getSearchPaths!({ imodelAccess, abortSignal });
          const expectedResult: HierarchySearchTree[] = [
            {
              identifier: { id: IModel.rootSubjectId, className: subjectClass },
              children: [
                {
                  identifier: { id: modelIds[0], className: modelClass },
                  children: [
                    {
                      identifier: { id: categoryIds[0], className: categoryClass },
                      children: [{ identifier: { id: elementIds[0], className: elementClass } }],
                    },
                  ],
                },
                {
                  identifier: { id: modelIds[1], className: modelClass },
                  children: [{ identifier: { id: categoryIds[1], className: categoryClass } }],
                },
              ],
            },
          ];
          expect(result).toEqual(expectedResult);
        });
      });

      it("getSearchPaths returns correct result when getSubTreePaths and search text is defined", async () => {
        const { result: renderHookResult } = renderHook(useModelsTree, {
          initialProps: { ...initialProps, getSubTreePaths, searchText: "element2" },
          wrapper: ({ children }) => <SharedTreeContextProviderInternal>{children}</SharedTreeContextProviderInternal>,
        });
        const { getSearchPaths } = renderHookResult.current.treeProps;
        const abortSignal = new AbortController().signal;
        await waitFor(async () => {
          expect(getSearchPaths).toBeDefined();
          const result = await getSearchPaths!({ imodelAccess, abortSignal });
          const expectedResult: HierarchySearchTree[] = [
            {
              identifier: { id: IModel.rootSubjectId, className: subjectClass },
              options: { autoExpand: true },
              children: [
                {
                  identifier: { id: modelIds[1], className: modelClass },
                  options: { autoExpand: true },
                  children: [
                    {
                      identifier: { id: categoryIds[1], className: categoryClass },
                      options: { autoExpand: true },
                      children: [
                        { identifier: { id: elementIds[1], className: elementClass }, options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } } },
                      ],
                    },
                  ],
                },
              ],
            },
          ];
          expect(result).toEqual(expectedResult);
        });
      });

      it("getSearchPaths returns correct result when getSubTreePaths and getSearchPaths is defined", async () => {
        const getSearchPathsForProps: UseModelsTreeProps["getSearchPaths"] = async ({ createInstanceKeyPaths }) => {
          return createInstanceKeyPaths({
            targetItems: [{ className: categoryClass, id: categoryIds[0] }],
          });
        };
        const { result: renderHookResult } = renderHook(useModelsTree, {
          initialProps: { ...initialProps, getSubTreePaths, getSearchPaths: getSearchPathsForProps },
          wrapper: ({ children }) => <SharedTreeContextProviderInternal>{children}</SharedTreeContextProviderInternal>,
        });
        const { getSearchPaths } = renderHookResult.current.treeProps;
        const abortSignal = new AbortController().signal;

        await waitFor(async () => {
          expect(getSearchPaths).toBeDefined();
          const result = await getSearchPaths!({ imodelAccess, abortSignal });
          const expectedResult: HierarchySearchTree[] = [
            {
              identifier: { id: IModel.rootSubjectId, className: subjectClass },
              options: { autoExpand: true },
              children: [
                {
                  identifier: { id: modelIds[0], className: modelClass },
                  options: { autoExpand: true },
                  children: [
                    {
                      identifier: { id: categoryIds[0], className: categoryClass },
                      options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                      children: [{ identifier: { id: elementIds[0], className: elementClass } }],
                    },
                  ],
                },
              ],
            },
          ];
          expect(result).toEqual(expectedResult);
        });
      });

      it("getSearchPaths returns correct result when getSubTreePaths and selection context is defined", async () => {
        // render both hooks with a single renderHook call, in order for them both to use the same context
        const { result: hooksResult } = renderHook(
          (props) => {
            return {
              focusedInstancesContext: useFocusedInstancesContext(),
              modelsTree: useModelsTree({ ...props }),
            };
          },
          {
            initialProps: { ...initialProps, getSubTreePaths },
            wrapper: ({ children }) => (
              <FocusedInstancesContextProvider selectionStorage={selectionStorage} imodelKey={imodel.key}>
                <SharedTreeContextProviderInternal>{children}</SharedTreeContextProviderInternal>
              </FocusedInstancesContextProvider>
            ),
          },
        );

        // Enable focus mode
        act(() => {
          hooksResult.current.focusedInstancesContext.toggle();
        });

        // Wait for enabled to be true
        await waitFor(() => {
          expect(hooksResult.current.focusedInstancesContext.enabled).toBe(true);
        });

        // Add to selection
        act(() => {
          selectionStorage.addToSelection({ imodelKey: imodel.key, level: 0, source: "test", selectables: [{ className: modelClass, id: modelIds[1] }] });
        });

        const { getSearchPaths } = hooksResult.current.modelsTree.treeProps;
        const abortSignal = new AbortController().signal;

        await waitFor(async () => {
          expect(getSearchPaths).toBeDefined();
          const result = await getSearchPaths!({ imodelAccess, abortSignal });
          const expectedResult: HierarchySearchTree[] = [
            {
              identifier: { id: IModel.rootSubjectId, className: subjectClass },
              options: { autoExpand: true },
              children: [
                {
                  identifier: { id: modelIds[1], className: modelClass },
                  options: { autoExpand: { groupingLevel: Number.MAX_SAFE_INTEGER } },
                  children: [
                    {
                      identifier: { id: categoryIds[1], className: categoryClass },
                    },
                  ],
                },
              ],
            },
          ];
          expect(result).toEqual(expectedResult);
        });
      });
    });
  });
});

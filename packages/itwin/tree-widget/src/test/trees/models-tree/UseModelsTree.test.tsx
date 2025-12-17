/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchySearchPath } from "@itwin/presentation-hierarchies";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { createStorage } from "@itwin/unified-selection";
import { FocusedInstancesContextProvider, useFocusedInstancesContext } from "../../../tree-widget-react/components/trees/common/FocusedInstancesContext.js";
import { useModelsTree } from "../../../tree-widget-react/components/trees/models-tree/UseModelsTree.js";
import { TreeWidget } from "../../../tree-widget-react/TreeWidget.js";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../IModelUtils.js";
import { act, renderHook, waitFor } from "../../TestUtils.js";
import { createFakeSinonViewport, createIModelAccess } from "../Common.js";
import { createTreeWidgetTestingViewport } from "../TreeUtils.js";
import { createModelHierarchyNode } from "./Utils.js";

import type { Id64Array } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { SelectionStorage } from "@itwin/unified-selection";
import type { UseModelsTreeProps } from "../../../tree-widget-react/components/trees/models-tree/UseModelsTree.js";
import type { TreeWidgetTestingViewport } from "../TreeUtils.js";

describe("useModelsTree", () => {
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
    await TreeWidget.initialize();
  });

  after(async function () {
    await terminatePresentationTesting();
    TreeWidget.terminate();
  });

  it("preserves cache when search changes", async function () {
    await using buildIModelResult = await buildIModel(this, async (builder) => {
      const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
      const model = insertPhysicalModelWithPartition({ builder, codeValue: `model`, partitionParentId: rootSubject.id });
      const category = insertSpatialCategory({ builder, codeValue: "category" });
      insertPhysicalElement({ builder, userLabel: `element`, modelId: model.id, categoryId: category.id });
      return { modelId: model.id, categoryId: category.id, rootSubjectId: rootSubject.id };
    });
    const { imodel, ...keys } = buildIModelResult;
    const queryHandler = sinon.fake(() => []);
    const viewport = createFakeSinonViewport({ queryHandler });
    const imodelAccess = createIModelAccess(imodel);
    const { result: renderHookResult, rerender } = renderHook(useModelsTree, {
      initialProps: {
        activeView: viewport,
        getSearchPaths: async () => [[{ id: keys.modelId, className: "BisCore.Model" }]],
      },
    });

    let getSearchPaths = renderHookResult.current.modelsTreeProps.getSearchPaths;
    let visibilityHandler = renderHookResult.current.modelsTreeProps.visibilityHandlerFactory({ imodelAccess });
    await waitFor(async () => {
      expect(getSearchPaths).to.not.be.undefined;
      await getSearchPaths!({ imodelAccess, abortSignal: new AbortController().signal });
      await visibilityHandler.getVisibilityStatus(createModelHierarchyNode({ modelId: keys.modelId }));
      expect(viewport.iModel.createQueryReader).to.be.called;
      sinon.reset();
      rerender({
        activeView: viewport,
        getSearchPaths: async () => [],
      });
      getSearchPaths = renderHookResult.current.modelsTreeProps.getSearchPaths;
      visibilityHandler = renderHookResult.current.modelsTreeProps.visibilityHandlerFactory({ imodelAccess });
      expect(getSearchPaths).to.not.be.undefined;
      await getSearchPaths!({ imodelAccess, abortSignal: new AbortController().signal });
      await visibilityHandler.getVisibilityStatus(createModelHierarchyNode({ modelId: keys.modelId }));
      expect(viewport.iModel.createQueryReader).not.to.be.called;
    });
  });

  describe("getSearchPaths", () => {
    describe("with getSubTreePaths", () => {
      const categoryClass = "BisCore.SpatialCategory";
      const elementClass = "BisCore.GeometricElement3d";
      const modelClass = "BisCore.GeometricModel3d";
      const subjectClass = "BisCore.Subject";
      let imodel: IModelConnection;
      let imodelAccess: ReturnType<typeof createIModelAccess>;
      let categoryIds: Id64Array;
      let elementIds: Id64Array;
      let modelIds: Id64Array;
      let viewport: TreeWidgetTestingViewport;
      let initialProps: UseModelsTreeProps;
      let getSubTreePaths: UseModelsTreeProps["getSubTreePaths"];
      let selectionStorage: SelectionStorage;

      async function createIModel(
        context: Mocha.Context,
      ): Promise<{ imodel: IModelConnection } & { models: Id64Array; categories: Id64Array; elements: Id64Array }> {
        return buildIModel(context, async (builder) => {
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
      before(async function () {
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
        await TreeWidget.initialize();
        const buildIModelResult = await createIModel(this);
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

      after(async function () {
        await imodel.close();
        await terminatePresentationTesting();
        TreeWidget.terminate();
      });

      it("getSearchPaths returns correct result when getSubTreePaths is not defined", async () => {
        const { result: renderHookResult } = renderHook(useModelsTree, { initialProps });
        const { getSearchPaths } = renderHookResult.current.modelsTreeProps;
        expect(getSearchPaths).to.be.undefined;
      });

      it("getSearchPaths returns correct result when getSubTreePaths is defined", async () => {
        const { result: renderHookResult } = renderHook(useModelsTree, { initialProps: { ...initialProps, getSubTreePaths } });
        const { getSearchPaths } = renderHookResult.current.modelsTreeProps;
        const abortSignal = new AbortController().signal;
        await waitFor(async () => {
          expect(getSearchPaths).to.not.be.undefined;
          const result = (await getSearchPaths!({ imodelAccess, abortSignal }))?.sort((lhs, rhs) => {
            if (HierarchySearchPath.normalize(lhs).path.length > HierarchySearchPath.normalize(rhs).path.length) {
              return -1;
            }
            return 1;
          });
          const expectedResult: HierarchySearchPath[] = [
            [
              { id: IModel.rootSubjectId, className: subjectClass },
              { id: modelIds[0], className: modelClass },
              { id: categoryIds[0], className: categoryClass },
              { id: elementIds[0], className: elementClass },
            ],
            [
              { id: IModel.rootSubjectId, className: subjectClass },
              { id: modelIds[1], className: modelClass },
              { id: categoryIds[1], className: categoryClass },
            ],
          ];
          expect(result).to.deep.eq(expectedResult);
        });
      });

      it("getSearchPaths returns correct result when getSubTreePaths and search text is defined", async () => {
        const { result: renderHookResult } = renderHook(useModelsTree, { initialProps: { ...initialProps, getSubTreePaths, searchText: "element2" } });
        const { getSearchPaths } = renderHookResult.current.modelsTreeProps;
        const abortSignal = new AbortController().signal;
        await waitFor(async () => {
          expect(getSearchPaths).to.not.be.undefined;
          const result = await getSearchPaths!({ imodelAccess, abortSignal });
          const expectedResult: HierarchySearchPath[] = [
            {
              path: [
                { id: IModel.rootSubjectId, className: subjectClass },
                { id: modelIds[1], className: modelClass },
                { id: categoryIds[1], className: categoryClass },
              ],
              options: undefined,
            },
            {
              path: [
                { id: IModel.rootSubjectId, className: subjectClass },
                { id: modelIds[1], className: modelClass },
                { id: categoryIds[1], className: categoryClass },
                { id: elementIds[1], className: elementClass },
              ],
              options: { reveal: true },
            },
          ];
          expect(result).to.deep.eq(expectedResult);
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
        });
        const { getSearchPaths } = renderHookResult.current.modelsTreeProps;
        const abortSignal = new AbortController().signal;

        await waitFor(async () => {
          expect(getSearchPaths).to.not.be.undefined;
          const result = await getSearchPaths!({ imodelAccess, abortSignal });
          const expectedResult: HierarchySearchPath[] = [
            {
              path: [
                { id: IModel.rootSubjectId, className: subjectClass },
                { id: modelIds[0], className: modelClass },
                { id: categoryIds[0], className: categoryClass },
                { id: elementIds[0], className: elementClass },
              ],
              options: undefined,
            },
          ];
          expect(result).to.deep.eq(expectedResult);
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
                {children}
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
          expect(hooksResult.current.focusedInstancesContext.enabled).to.be.true;
        });

        // Add to selection
        act(() => {
          selectionStorage.addToSelection({ imodelKey: imodel.key, level: 0, source: "test", selectables: [{ className: modelClass, id: modelIds[1] }] });
        });

        const { getSearchPaths } = hooksResult.current.modelsTree.modelsTreeProps;
        const abortSignal = new AbortController().signal;

        await waitFor(async () => {
          expect(getSearchPaths).to.not.be.undefined;
          const result = await getSearchPaths!({ imodelAccess, abortSignal });
          const expectedResult: HierarchySearchPath[] = [
            {
              path: [
                { id: IModel.rootSubjectId, className: subjectClass },
                { id: modelIds[1], className: modelClass },
                { id: categoryIds[1], className: categoryClass },
              ],
              options: { reveal: { depthInPath: 1 } },
            },
          ];
          expect(result).to.deep.eq(expectedResult);
        });
      });
    });
  });
});

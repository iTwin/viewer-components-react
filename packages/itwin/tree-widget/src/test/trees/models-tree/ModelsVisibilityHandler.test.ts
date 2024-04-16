/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, from, map } from "rxjs";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent, using } from "@itwin/core-bentley";
import { IModelApp, IModelConnection, NoRenderApp, PerModelCategoryVisibility } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import * as categoriesVisibilityUtils from "../../../components/trees/CategoriesVisibilityUtils";
import {
  areAllModelsVisible, hideAllModels, invertAllModels, ModelsVisibilityHandler, showAllModels, toggleModels,
} from "../../../components/trees/models-tree/ModelsVisibilityHandler";
import { isPromiseLike } from "../../../components/utils/IsPromiseLike";
import { mockViewport, TestUtils } from "../../TestUtils";
import { createCategoryNode, createElementClassGroupingNode, createElementNode, createModelNode, createSubjectNode } from "../Common";

import type { Viewport, ViewState, ViewState3d } from "@itwin/core-frontend";
import type { TreeNodeItem } from "@itwin/components-react";
import type { Id64String } from "@itwin/core-bentley";
import type { ECInstancesNodeKey } from "@itwin/presentation-common";
import type { IFilteredPresentationTreeDataProvider, PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { IModelHierarchyChangeEventArgs, PresentationManager } from "@itwin/presentation-frontend";
import type { ModelsVisibilityHandlerProps } from "../../../components/trees/models-tree/ModelsVisibilityHandler";
import type { ModelInfo } from "../../../tree-widget-react";
import type { QueryProvider } from "../../../components/trees/models-tree/internal/QueryProvider";
describe("ModelsVisibilityHandler", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  let imodelMock: sinon.SinonStubbedInstance<IModelConnection>;

  beforeEach(() => {
    imodelMock = sinon.createStubInstance(IModelConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  const createHandler = (partialProps?: Partial<ModelsVisibilityHandlerProps>): ModelsVisibilityHandler => {
    if (!partialProps) {
      partialProps = {};
    }
    const props: ModelsVisibilityHandlerProps = {
      ...partialProps,
      rulesetId: "test",
      viewport: partialProps.viewport ?? mockViewport().object,
    };
    return new ModelsVisibilityHandler(props);
  };

  interface SubjectModelIdsMockProps {
    subjectsHierarchy: Map<Id64String, Id64String[]>;
    subjectModels: Map<Id64String, Array<{ id: Id64String; content?: string }>>;
    modelCategories?: Map<Id64String, Id64String[]>;
    categoryElements?: Map<Id64String, Id64String[]>;
    elementHierarchy?: Map<Id64String, Id64String[]>;
  }

  interface SubjectsRow {
    id: Id64String;
    parentId?: Id64String;
    targetPartitionId?: Id64String;
  }

  interface ElementRow {
    id: Id64String;
    parentId: Id64String;
  }

  function createFakeQueryProvider(props: SubjectModelIdsMockProps): QueryProvider {
    const subjectQueryRows: SubjectsRow[] = [];
    props.subjectsHierarchy.forEach((ids, parentId) => ids.forEach((id) => subjectQueryRows.push({ id, parentId })));

    const elementQueryRows: ElementRow[] = [];
    props.subjectModels.forEach((modelInfos, subjectId) => modelInfos.forEach((modelInfo) => elementQueryRows.push({ id: modelInfo.id, parentId: subjectId })));

    const res: QueryProvider = {
      queryAllSubjects: sinon.fake.returns(from(subjectQueryRows)),
      queryAllModels: sinon.fake.returns(from(elementQueryRows)),
      queryModelCategories: sinon.fake((x) => from(props.modelCategories?.get(x) ?? [])),
      queryCategoryElements: sinon.fake((x) => {
        return from(props.categoryElements?.get(x) ?? []).pipe(map((id) => ({ id, hasChildren: !!props.elementHierarchy?.get(id)?.length })));
      }),
      queryElementChildren: () => EMPTY,
    };
    return res;
  }

  const modelsInfo: ModelInfo[] = [{ id: "ModelId1" }, { id: "ModelId2" }];

  describe("constructor", () => {
    it("should subscribe for viewport change events", () => {
      const vpMock = mockViewport();
      createHandler({ viewport: vpMock.object });
      expect(vpMock.object.onViewedCategoriesPerModelChanged.numberOfListeners).to.eq(1);
      expect(vpMock.object.onViewedCategoriesChanged.numberOfListeners).to.eq(1);
      expect(vpMock.object.onViewedModelsChanged.numberOfListeners).to.eq(1);
      expect(vpMock.object.onAlwaysDrawnChanged.numberOfListeners).to.eq(1);
      expect(vpMock.object.onNeverDrawnChanged.numberOfListeners).to.eq(1);
    });

    it("should subscribe for 'onIModelHierarchyChanged' event if hierarchy auto update is enabled", () => {
      const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
      const changeEvent = new BeEvent<(args: IModelHierarchyChangeEventArgs) => void>();
      presentationManagerMock.setup((x) => x.onIModelHierarchyChanged).returns(() => changeEvent); // eslint-disable-line @itwin/no-internal
      sinon.stub(Presentation, "presentation").get(() => presentationManagerMock.object);
      createHandler({ viewport: mockViewport().object, hierarchyAutoUpdateEnabled: true });
      expect(changeEvent.numberOfListeners).to.eq(1);
    });
  });

  describe("dispose", () => {
    it("should unsubscribe from viewport change events", () => {
      const vpMock = mockViewport();
      using(createHandler({ viewport: vpMock.object }), (_) => {});
      expect(vpMock.object.onViewedCategoriesPerModelChanged.numberOfListeners).to.eq(0);
      expect(vpMock.object.onViewedCategoriesChanged.numberOfListeners).to.eq(0);
      expect(vpMock.object.onViewedModelsChanged.numberOfListeners).to.eq(0);
      expect(vpMock.object.onAlwaysDrawnChanged.numberOfListeners).to.eq(0);
      expect(vpMock.object.onNeverDrawnChanged.numberOfListeners).to.eq(0);
    });

    it("should unsubscribe from 'onIModelHierarchyChanged' event", () => {
      const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
      const changeEvent = new BeEvent<(args: IModelHierarchyChangeEventArgs) => void>();
      presentationManagerMock.setup((x) => x.onIModelHierarchyChanged).returns(() => changeEvent); // eslint-disable-line @itwin/no-internal
      sinon.stub(Presentation, "presentation").get(() => presentationManagerMock.object);
      using(createHandler({ viewport: mockViewport().object, hierarchyAutoUpdateEnabled: true }), (_) => {});
      expect(changeEvent.numberOfListeners).to.eq(0);
    });
  });

  describe("getVisibilityStatus", () => {
    it("returns disabled when node is not an instance node", async () => {
      const node: PresentationTreeNodeItem = {
        key: {
          type: "custom",
          version: 0,
          pathFromRoot: [],
        },
        id: "custom",
        label: PropertyRecord.fromString("custom"),
      };

      const vpMock = mockViewport();

      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const result = handler.getVisibilityStatus(node);
        expect(isPromiseLike(result)).to.be.false;
        expect(result).to.include({ state: "hidden", isDisabled: true });
      });
    });

    it("returns disabled if node is not PresentationTreeNodeItem", async () => {
      await using(createHandler({}), async (handler) => {
        const result = await handler.getVisibilityStatus({} as TreeNodeItem);
        expect(result.state).to.be.eq("hidden");
        expect(result.isDisabled).to.be.true;
      });
    });

    describe("subject", () => {
      it("initializes subject models cache only once", async () => {
        const node = createSubjectNode();
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];

        const queryProvider = createFakeQueryProvider({
          subjectsHierarchy: new Map([["0x0", [key.id]]]),
          subjectModels: new Map([[key.id, [{ id: "0x1" }, { id: "0x2" }]]]),
        });

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(moq.It.isAny())).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object, imodel: imodelMock });
        await using(createHandler({ viewport: vpMock.object, queryProvider }), async (handler) => {
          await Promise.all([handler.getVisibilityStatus(node), handler.getVisibilityStatus(node)]);
          // expect the `createQueryReader` to be called only twice (once for subjects and once for models)
          expect(imodelMock.createQueryReader).to.be.calledTwice;
        });
      });

      describe("filtered", () => {
        it("return 'visible' when subject node matches filter and at least one model is visible", async () => {
          const node = createSubjectNode();
          const key = (node.key as ECInstancesNodeKey).instanceKeys[0];

          const filteredProvider = moq.Mock.ofType<IFilteredPresentationTreeDataProvider>();
          filteredProvider.setup((x) => x.nodeMatchesFilter(node)).returns(() => true);

          const queryProvider = createFakeQueryProvider({
            subjectsHierarchy: new Map([["0x0", [key.id]]]),
            subjectModels: new Map([[key.id, [{ id: "0x10" }, { id: "0x20" }]]]),
          });

          const viewStateMock = moq.Mock.ofType<ViewState3d>();
          viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);

          const vpMock = mockViewport({ viewState: viewStateMock.object, imodel: imodelMock });

          await using(createHandler({ viewport: vpMock.object, queryProvider }), async (handler) => {
            handler.setFilteredDataProvider(filteredProvider.object);
            const result = handler.getVisibilityStatus(node);
            expect(isPromiseLike(result)).to.be.true;
            if (isPromiseLike(result)) {
              expect(await result).to.include({ state: "visible" });
            }
            filteredProvider.verifyAll();
          });
        });

        it("return 'visible' when subject node with children matches filter and at least one model is visible", async () => {
          const parentSubjectId = "0x1";
          const childSubjectId = "0x2";
          const node = createSubjectNode(parentSubjectId);
          const childNode = createSubjectNode(childSubjectId);

          const filteredProvider = moq.Mock.ofType<IFilteredPresentationTreeDataProvider>();
          filteredProvider
            .setup(async (x) => x.getNodes(node))
            .returns(async () => [childNode])
            .verifiable(moq.Times.never());
          filteredProvider
            .setup(async (x) => x.getNodes(childNode))
            .returns(async () => [])
            .verifiable(moq.Times.never());
          filteredProvider.setup((x) => x.nodeMatchesFilter(moq.It.isAny())).returns(() => true);

          const queryProvider = createFakeQueryProvider({
            subjectsHierarchy: new Map([[parentSubjectId, [childSubjectId]]]),
            subjectModels: new Map([
              [parentSubjectId, [{ id: "0x10" }, { id: "0x11" }]],
              [childSubjectId, [{ id: "0x20" }]],
            ]),
          });

          const viewStateMock = moq.Mock.ofType<ViewState3d>();
          viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x11")).returns(() => false);
          viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);

          const vpMock = mockViewport({ viewState: viewStateMock.object, imodel: imodelMock });

          await using(createHandler({ viewport: vpMock.object, queryProvider }), async (handler) => {
            handler.setFilteredDataProvider(filteredProvider.object);
            const result = handler.getVisibilityStatus(node);
            expect(isPromiseLike(result)).to.be.true;
            if (isPromiseLike(result)) {
              expect(await result).to.include({ state: "visible" });
            }
            filteredProvider.verifyAll();
          });
        });

        it("return 'visible' when subject node with children does not match filter and at least one child has visible models", async () => {
          const parentSubjectId = "0x1";
          const childSubjectIds = ["0x2", "0x3"];
          const node = createSubjectNode(parentSubjectId);
          const childNodes = [createSubjectNode(childSubjectIds[0]), createSubjectNode(childSubjectIds[1])];

          const filteredProvider = moq.Mock.ofType<IFilteredPresentationTreeDataProvider>();
          filteredProvider
            .setup(async (x) => x.getNodes(node))
            .returns(async () => childNodes)
            .verifiable(moq.Times.once());
          filteredProvider
            .setup(async (x) => x.getNodes(childNodes[0]))
            .returns(async () => [])
            .verifiable(moq.Times.never());
          filteredProvider
            .setup(async (x) => x.getNodes(childNodes[1]))
            .returns(async () => [])
            .verifiable(moq.Times.never());
          filteredProvider.setup((x) => x.nodeMatchesFilter(node)).returns(() => false);
          filteredProvider.setup((x) => x.nodeMatchesFilter(childNodes[0])).returns(() => true);
          filteredProvider.setup((x) => x.nodeMatchesFilter(childNodes[1])).returns(() => true);

          const queryProvider = createFakeQueryProvider({
            subjectsHierarchy: new Map([[parentSubjectId, childSubjectIds]]),
            subjectModels: new Map([
              [parentSubjectId, [{ id: "0x10" }]],
              [childSubjectIds[0], [{ id: "0x20" }]],
              [childSubjectIds[1], [{ id: "0x30" }]],
            ]),
          });

          const viewStateMock = moq.Mock.ofType<ViewState3d>();
          viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => false);
          viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);
          viewStateMock.setup((x) => x.viewsModel("0x30")).returns(() => true);

          const vpMock = mockViewport({ viewState: viewStateMock.object, imodel: imodelMock });

          await using(createHandler({ viewport: vpMock.object, queryProvider }), async (handler) => {
            handler.setFilteredDataProvider(filteredProvider.object);
            const result = handler.getVisibilityStatus(node);
            expect(isPromiseLike(result)).to.be.true;
            if (isPromiseLike(result)) {
              expect(await result).to.include({ state: "visible" });
            }
            filteredProvider.verifyAll();
          });
        });

        it("return 'hidden' when subject node with children does not match filter and children models are not visible", async () => {
          const parentSubjectIds = ["0x1", "0x2"];
          const childSubjectId = "0x3";
          const node = createSubjectNode(parentSubjectIds);
          const childNode = createSubjectNode(childSubjectId);

          const filteredProvider = moq.Mock.ofType<IFilteredPresentationTreeDataProvider>();
          filteredProvider
            .setup(async (x) => x.getNodes(node))
            .returns(async () => [childNode])
            .verifiable(moq.Times.once());
          filteredProvider
            .setup(async (x) => x.getNodes(childNode))
            .returns(async () => [])
            .verifiable(moq.Times.never());
          filteredProvider.setup((x) => x.nodeMatchesFilter(node)).returns(() => false);
          filteredProvider.setup((x) => x.nodeMatchesFilter(childNode)).returns(() => true);

          const queryProvider = createFakeQueryProvider({
            subjectsHierarchy: new Map([
              [parentSubjectIds[0], [childSubjectId]],
              [parentSubjectIds[1], [childSubjectId]],
            ]),
            subjectModels: new Map([
              [parentSubjectIds[0], [{ id: "0x10" }]],
              [parentSubjectIds[1], [{ id: "0x20" }]],
              [childSubjectId, [{ id: "0x30" }]],
            ]),
          });

          const viewStateMock = moq.Mock.ofType<ViewState3d>();
          viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
          viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => false);
          viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);
          viewStateMock.setup((x) => x.viewsModel("0x30")).returns(() => false);

          const vpMock = mockViewport({ viewState: viewStateMock.object, imodel: imodelMock });

          await using(createHandler({ viewport: vpMock.object, queryProvider }), async (handler) => {
            handler.setFilteredDataProvider(filteredProvider.object);
            const result = handler.getVisibilityStatus(node);
            expect(isPromiseLike(result)).to.be.true;
            if (isPromiseLike(result)) {
              expect(await result).to.include({ state: "hidden" });
            }
            filteredProvider.verifyAll();
          });
        });
      });
    });

    describe("model", () => {
      it("return disabled when active view is not spatial", async () => {
        const node = createModelNode();
        const vpMock = mockViewport();
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });
      });

      it("return 'visible' when displayed", async () => {
        const node = createModelNode();
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(key.id)).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "visible" });
        });
      });

      it("returns 'hidden' when not displayed", async () => {
        const node = createModelNode();
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(key.id)).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(node);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });
    });

    describe("category", () => {
      it("return disabled when model not displayed", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = (parentModelNode.key as ECInstancesNodeKey).instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });
      });

      it("return 'visible' when model displayed, category not displayed but per-model override says it's displayed", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = (parentModelNode.key as ECInstancesNodeKey).instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = (categoryNode.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();
        perModelCategoryVisibilityMock.setup((x) => x.getOverride(parentModelKey.id, categoryKey.id)).returns(() => PerModelCategoryVisibility.Override.Show);

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "visible" });
        });
      });

      it("return 'visible' when model displayed, category displayed and there're no per-model overrides", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = (parentModelNode.key as ECInstancesNodeKey).instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const key = (categoryNode.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(key.id)).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "visible" });
        });
      });

      it("return 'hidden' when model displayed, category displayed but per-model override says it's not displayed", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = (parentModelNode.key as ECInstancesNodeKey).instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = (categoryNode.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();
        perModelCategoryVisibilityMock.setup((x) => x.getOverride(parentModelKey.id, categoryKey.id)).returns(() => PerModelCategoryVisibility.Override.Hide);

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });

      it("return 'hidden' when model displayed, category not displayed and there're no per-model overrides", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = (parentModelNode.key as ECInstancesNodeKey).instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const key = (categoryNode.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(key.id)).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });

      it("return 'hidden' when category has no parent model and category is not displayed", async () => {
        const categoryNode = createCategoryNode();
        const categoryKey = (categoryNode.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = handler.getVisibilityStatus(categoryNode);
          expect(isPromiseLike(result)).to.be.false;
          expect(result).to.include({ state: "hidden" });
        });
      });
    });

    describe("element class grouping", () => {
      it("returns disabled when model not displayed", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => false);
        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async *getElementIds() {
                for (const id of groupedElementIds) {
                  yield id;
                }
              },
            },
          });

          const result = handler.getVisibilityStatus(node);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "hidden", isDisabled: true });
        });
      });

      it("returns 'visible' when model displayed and at least one element is in always displayed list", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const alwaysDrawn = new Set([groupedElementIds[1]]);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDrawn);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async *getElementIds() {
                for (const id of groupedElementIds) {
                  yield id;
                }
              },
            },
          });

          const result = handler.getVisibilityStatus(node);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "visible" });
        });
      });

      it("returns 'hidden' when model displayed and there's at least one element in always exclusive displayed list that's not grouped under node", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const alwaysDrawn = new Set(["0x4"]);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDrawn);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async *getElementIds() {
                for (const id of groupedElementIds) {
                  yield id;
                }
              },
            },
          });

          const result = handler.getVisibilityStatus(node);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "hidden" });
        });
      });

      it("returns 'hidden' when model displayed and all elements are in never displayed list", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const neverDrawn = new Set(groupedElementIds);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async *getElementIds() {
                for (const id of groupedElementIds) {
                  yield id;
                }
              },
            },
          });

          const result = handler.getVisibilityStatus(node);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "hidden" });
        });
      });

      it("returns 'hidden' when model displayed and category not displayed", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const neverDrawn = new Set(["0x11"]);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async *getElementIds() {
                for (const id of groupedElementIds) {
                  yield id;
                }
              },
            },
          });

          const result = handler.getVisibilityStatus(node);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "hidden" });
        });
      });

      it("returns 'visible' when model displayed and category displayed", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const neverDrawn = new Set(["0x11"]);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async *getElementIds() {
                for (const id of groupedElementIds) {
                  yield id;
                }
              },
            },
          });

          const result = handler.getVisibilityStatus(node);
          expect(isPromiseLike(result)).to.be.true;
          expect(await result).to.include({ state: "visible" });
        });
      });
    });

    describe("element", () => {
      it("returns disabled when modelId not set", async () => {
        const node = createElementNode(undefined, "0x1");

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel(moq.It.isAny())).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });
      });

      it("returns disabled when model not displayed", async () => {
        const node = createElementNode("0x2", "0x1");

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => false);
        const vpMock = mockViewport({ viewState: viewStateMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });
      });

      it("returns 'hidden' when model displayed, category displayed, but element is in never displayed list", async () => {
        const node = createElementNode("0x2", "0x1");
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const neverDrawn = new Set([key.id]);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => undefined);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });
      });

      it("returns 'visible' when model displayed and element is in always displayed list", async () => {
        const node = createElementNode("0x2", "0x1");
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        const alwaysDrawn = new Set([key.id]);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDrawn);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });
      });

      it("returns 'visible' when model displayed, category displayed and element is in neither 'never' nor 'always' displayed", async () => {
        const node = createElementNode("0x2", "0x1");

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.alwaysDrawn).returns(() => undefined);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });
      });

      it("returns 'hidden' when model displayed, category not displayed and element is in neither 'never' nor 'always' displayed", async () => {
        const node = createElementNode("0x2", "0x1");

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.alwaysDrawn).returns(() => undefined);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });
      });

      it("returns 'hidden' when model displayed, category displayed and some other element is exclusively 'always' displayed", async () => {
        const node = createElementNode("0x2", "0x1");

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set(["0x1"]));
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });
      });

      it("returns 'hidden' when model displayed, categoryId not set and element is in neither 'never' nor 'always' displayed", async () => {
        const node = createElementNode("0x2", undefined);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(moq.It.isAny())).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());
        vpMock.setup((x) => x.neverDrawn).returns(() => new Set());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });
      });
    });
  });

  describe("changeVisibility", () => {
    it("does nothing when node is not an instance node", async () => {
      const node: PresentationTreeNodeItem = {
        key: {
          type: "custom",
          version: 0,
          pathFromRoot: [],
        },
        id: "custom",
        label: PropertyRecord.fromString("custom"),
      };

      const vpMock = mockViewport();
      vpMock.setup(async (x) => x.addViewedModels(moq.It.isAny())).verifiable(moq.Times.never());

      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        await handler.changeVisibility(node, true);
        vpMock.verifyAll();
      });
    });

    it("does nothing when node is not PresentationTreeNodeItem", async () => {
      const vpMock = mockViewport();
      vpMock.setup(async (x) => x.addViewedModels(moq.It.isAny())).verifiable(moq.Times.never());

      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        await handler.changeVisibility({} as TreeNodeItem, false);
        vpMock.verifyAll();
      });
    });

    describe("subject", () => {
      it("does nothing for non-spatial views", async () => {
        const node = createSubjectNode();

        const viewStateMock = moq.Mock.ofType<ViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup(async (x) => x.addViewedModels(moq.It.isAny())).verifiable(moq.Times.never());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getSubjectModelIds = async () => ["0x1", "0x2"];

          await handler.changeVisibility(node, true);
          vpMock.verifyAll();
        });
      });

      it("makes all subject models visible", async () => {
        const node = createSubjectNode();
        const subjectModelIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<ViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup(async (x) => x.addViewedModels(subjectModelIds)).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getSubjectModelIds = async () => subjectModelIds;

          await handler.changeVisibility(node, true);
          vpMock.verifyAll();
        });
      });

      it("makes all subject models hidden", async () => {
        const node = createSubjectNode();
        const subjectModelIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<ViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.changeModelDisplay(subjectModelIds, false)).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getSubjectModelIds = async () => subjectModelIds;

          await handler.changeVisibility(node, false);
          vpMock.verifyAll();
        });
      });

      describe("filtered", () => {
        ["visible", "hidden"].map((mode) => {
          it(`makes all subject models ${mode} when subject node does not have children`, async () => {
            const node = createSubjectNode();
            const key = (node.key as ECInstancesNodeKey).instanceKeys[0];
            const subjectModelIds = ["0x1", "0x2"];

            const filteredDataProvider = moq.Mock.ofType<IFilteredPresentationTreeDataProvider>();
            filteredDataProvider
              .setup(async (x) => x.getNodes(node))
              .returns(async () => [])
              .verifiable(moq.Times.never());
            filteredDataProvider.setup((x) => x.nodeMatchesFilter(node)).returns(() => true);

            const viewStateMock = moq.Mock.ofType<ViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            const queryProvider = createFakeQueryProvider({
              subjectsHierarchy: new Map([]),
              subjectModels: new Map([[key.id, [{ id: subjectModelIds[0], content: "reference" }, { id: subjectModelIds[1] }]]]),
            });

            const vpMock = mockViewport({ viewState: viewStateMock.object, imodel: imodelMock });
            if (mode === "visible") {
              vpMock.setup(async (x) => x.addViewedModels(subjectModelIds)).verifiable();
            } else {
              vpMock.setup((x) => x.changeModelDisplay(subjectModelIds, false)).verifiable();
            }

            await using(createHandler({ viewport: vpMock.object, queryProvider }), async (handler) => {
              handler.setFilteredDataProvider(filteredDataProvider.object);
              await handler.changeVisibility(node, mode === "visible");
              vpMock.verifyAll();
              filteredDataProvider.verifyAll();
            });
          });

          it(`makes only children ${mode} if parent node does not match filter`, async () => {
            const node = createSubjectNode("0x1");
            const childNode = createSubjectNode("0x2");
            const parentSubjectModelIds = ["0x10", "0x11"];
            const childSubjectModelIds = ["0x20"];

            const filteredDataProvider = moq.Mock.ofType<IFilteredPresentationTreeDataProvider>();
            filteredDataProvider
              .setup(async (x) => x.getNodes(node))
              .returns(async () => [childNode])
              .verifiable(moq.Times.once());
            filteredDataProvider
              .setup(async (x) => x.getNodes(childNode))
              .returns(async () => [])
              .verifiable(moq.Times.never());
            filteredDataProvider.setup((x) => x.nodeMatchesFilter(node)).returns(() => false);
            filteredDataProvider.setup((x) => x.nodeMatchesFilter(childNode)).returns(() => true);

            const viewStateMock = moq.Mock.ofType<ViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            const queryProvider = createFakeQueryProvider({
              subjectsHierarchy: new Map([["0x1", ["0x2"]]]),
              subjectModels: new Map([
                ["0x1", [{ id: parentSubjectModelIds[0] }, { id: parentSubjectModelIds[1] }]],
                ["0x2", [{ id: childSubjectModelIds[0] }]],
              ]),
            });

            const vpMock = mockViewport({ viewState: viewStateMock.object, imodel: imodelMock });
            if (mode === "visible") {
              vpMock.setup(async (x) => x.addViewedModels(childSubjectModelIds)).verifiable();
            } else {
              vpMock.setup((x) => x.changeModelDisplay(childSubjectModelIds, false)).verifiable();
            }

            await using(createHandler({ viewport: vpMock.object, queryProvider }), async (handler) => {
              handler.setFilteredDataProvider(filteredDataProvider.object);
              await handler.changeVisibility(node, mode === "visible");
              vpMock.verifyAll();
              filteredDataProvider.verifyAll();
            });
          });
        });
      });
    });

    describe("model", () => {
      it("does nothing for non-spatial views", async () => {
        const node = createModelNode();

        const viewStateMock = moq.Mock.ofType<ViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup(async (x) => x.addViewedModels(moq.It.isAny())).verifiable(moq.Times.never());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(node, true);
          vpMock.verifyAll();
        });
      });

      it("makes model visible", async () => {
        const node = createModelNode();
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup(async (x) => x.addViewedModels([key.id])).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(node, true);
          vpMock.verifyAll();
        });
      });

      it("makes model hidden", async () => {
        const node = createModelNode();
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState>();
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });
        vpMock.setup((x) => x.changeModelDisplay([key.id], false)).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(node, false);
          vpMock.verifyAll();
        });
      });
    });

    describe("category", () => {
      it("makes category visible through per-model override when it's not visible through category selector", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = (parentModelNode.key as ECInstancesNodeKey).instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = (categoryNode.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, true);
          perModelCategoryVisibilityMock.verify(
            (x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.Show),
            moq.Times.once(),
          );
          vpMock.verify((x) => x.changeCategoryDisplay(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        });
      });

      it("makes category hidden through override when it's visible through category selector", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = (parentModelNode.key as ECInstancesNodeKey).instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = (categoryNode.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => true);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, false);
          perModelCategoryVisibilityMock.verify(
            (x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.Hide),
            moq.Times.once(),
          );
          vpMock.verify((x) => x.changeCategoryDisplay(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        });
      });

      it("removes category override and enables all sub-categories when making visible and it's visible through category selector", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = (parentModelNode.key as ECInstancesNodeKey).instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = (categoryNode.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => true);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, true);
          perModelCategoryVisibilityMock.verify(
            (x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.None),
            moq.Times.once(),
          );
          vpMock.verify((x) => x.changeCategoryDisplay([categoryKey.id], true, true), moq.Times.once());
        });
      });

      it("removes category override when making hidden and it's hidden through category selector", async () => {
        const parentModelNode = createModelNode();
        const parentModelKey = (parentModelNode.key as ECInstancesNodeKey).instanceKeys[0];
        const categoryNode = createCategoryNode(parentModelKey);
        const categoryKey = (categoryNode.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);

        const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

        const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, false);
          perModelCategoryVisibilityMock.verify(
            (x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.None),
            moq.Times.once(),
          );
          vpMock.verify((x) => x.changeCategoryDisplay(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        });
      });

      it("makes category visible in selector and enables all sub-categories when category has no parent model", async () => {
        const categoryNode = createCategoryNode();
        const categoryKey = (categoryNode.key as ECInstancesNodeKey).instanceKeys[0];

        const vpMock = mockViewport();
        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, true);
          vpMock.verify((x) => x.changeCategoryDisplay([categoryKey.id], true, true), moq.Times.once());
        });
      });

      it("makes category hidden in selector when category has no parent model", async () => {
        const categoryNode = createCategoryNode();
        const categoryKey = (categoryNode.key as ECInstancesNodeKey).instanceKeys[0];

        const vpMock = mockViewport();
        vpMock.setup((x) => x.changeCategoryDisplay([categoryKey.id], false)).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          await handler.changeVisibility(categoryNode, false);
          vpMock.verify((x) => x.changeCategoryDisplay([categoryKey.id], false, false), moq.Times.once());
        });
      });
    });

    describe("element class grouping", () => {
      it("makes elements visible by removing from never displayed list and adding to always displayed list when category is not displayed", async () => {
        const groupedElementIds = ["0x11", "0x12", "0x13"];
        const node = createElementClassGroupingNode(groupedElementIds);

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set<string>();
        const neverDisplayed = new Set([groupedElementIds[0]]);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
        groupedElementIds.forEach((elId) => {
          vpMock
            .setup((x) =>
              x.setAlwaysDrawn(
                moq.It.is((set) => set.has(elId)),
                false,
              ),
            )
            .verifiable(moq.Times.once());
        });
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => set.size === 0))).verifiable(moq.Times.once());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getGroupedElementIds = async () => ({
            categoryId: "0x1",
            modelId: "0x2",
            elementIds: {
              async *getElementIds() {
                for (const id of groupedElementIds) {
                  yield id;
                }
              },
            },
          });

          await handler.changeVisibility(node, true);
          vpMock.verifyAll();
        });
      });
    });

    describe("element", () => {
      it("makes element visible by only removing from never displayed list when element's category is displayed", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];
        const assemblyChildrenIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set<string>();
        const neverDisplayed = new Set([key.id]);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => set.size === 0))).verifiable();
        vpMock
          .setup((x) =>
            x.setAlwaysDrawn(
              moq.It.is((set) => set.size === 0),
              false,
            ),
          )
          .verifiable(moq.Times.never());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async *getElementIds() {
              for (const id of assemblyChildrenIds) {
                yield id;
              }
            },
          });

          await handler.changeVisibility(node, true);
          vpMock.verifyAll();
        });
      });

      it("makes element visible by removing from never displayed list and adding to always displayed list when category is not displayed", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];
        const assemblyChildrenIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x4")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x3")).returns(() => false);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set<string>();
        const neverDisplayed = new Set([key.id]);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
        [key.id, ...assemblyChildrenIds].forEach((elId) => {
          vpMock
            .setup((x) =>
              x.setAlwaysDrawn(
                moq.It.is((set) => set.has(elId)),
                false,
              ),
            )
            .verifiable(moq.Times.once());
        });

        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => set.size === 0))).verifiable();

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async *getElementIds() {
              for (const id of assemblyChildrenIds) {
                yield id;
              }
            },
          });

          await handler.changeVisibility(node, true);
          vpMock.verifyAll();
        });
      });

      it("makes element visible by adding to always displayed list when category is displayed, but element is hidden due to other elements exclusively always drawn", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x4")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x3")).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set<Id64String>(["0x1"]);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
        vpMock
          .setup((x) =>
            x.setAlwaysDrawn(
              moq.It.is((set) => {
                return set.size === 2 && set.has(key.id);
              }),
              true,
            ),
          )
          .verifiable(moq.Times.once());
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => set.size === 0))).verifiable(moq.Times.never());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async *getElementIds() {},
          });

          await handler.changeVisibility(node, true);
          vpMock.verifyAll();
        });
      });

      it("makes element hidden by only removing from always displayed list when element's category is not displayed", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];
        const assemblyChildrenIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => false);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set([key.id]);
        const neverDisplayed = new Set<string>();
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => set.size === 0))).verifiable(moq.Times.never());
        vpMock
          .setup((x) =>
            x.setAlwaysDrawn(
              moq.It.is((set) => set.size === 0),
              false,
            ),
          )
          .verifiable(moq.Times.once());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running queries on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async *getElementIds() {
              for (const id of assemblyChildrenIds) {
                yield id;
              }
            },
          });

          await handler.changeVisibility(node, false);
          vpMock.verifyAll();
        });
      });

      it("makes element hidden by removing from always displayed list and adding to never displayed list when category is displayed", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];
        const assemblyChildrenIds = ["0x1", "0x2"];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set([key.id]);
        const neverDisplayed = new Set<string>();
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
        vpMock
          .setup((x) =>
            x.setAlwaysDrawn(
              moq.It.is((set) => set.size === 0),
              false,
            ),
          )
          .verifiable(moq.Times.once());
        [key.id, ...assemblyChildrenIds].forEach((elId) => {
          vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => set.has(elId)))).verifiable(moq.Times.once());
        });

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async *getElementIds() {
              for (const id of assemblyChildrenIds) {
                yield id;
              }
            },
          });

          await handler.changeVisibility(node, false);
          vpMock.verifyAll();
        });
      });

      it("makes element hidden by removing from always displayed list when category is displayed and there are exclusively always drawn elements", async () => {
        const node = createElementNode("0x4", "0x3");
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        const alwaysDisplayed = new Set([key.id, "0x1"]);
        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
        vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
        vpMock
          .setup((x) =>
            x.setAlwaysDrawn(
              moq.It.is((set) => set.size === 1 && !set.has(key.id)),
              true,
            ),
          )
          .verifiable();
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => set.size === 0))).verifiable(moq.Times.never());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          // note: need to override to avoid running a query on the imodel
          (handler as any).getAssemblyElementIds = () => ({
            async *getElementIds() {},
          });

          await handler.changeVisibility(node, false);
          vpMock.verifyAll();
        });
      });

      it("does not look for assembly children when element is not an assembly", async () => {
        const node = createElementNode("0x4", "0x3", false);
        const key = (node.key as ECInstancesNodeKey).instanceKeys[0];

        const viewStateMock = moq.Mock.ofType<ViewState3d>();
        viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => true);
        viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
        viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

        const vpMock = mockViewport({ viewState: viewStateMock.object });

        vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
        vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());
        vpMock.setup((x) => x.neverDrawn).returns(() => new Set());
        vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => set.size === 1 && set.has(key.id)))).verifiable(moq.Times.once());

        await using(createHandler({ viewport: vpMock.object }), async (handler) => {
          const spy = sinon.spy(handler as any, "getAssemblyElementIds");

          await handler.changeVisibility(node, false);
          vpMock.verifyAll();
          expect(spy).to.not.be.called;
        });
      });
    });
  });

  describe("showAllModels", () => {
    it("checks if showAllModels calls expected functions", async () => {
      const vpMock = mockViewport();
      const toggleAllCategoriesSpy = sinon.stub(categoriesVisibilityUtils, "toggleAllCategories");
      await showAllModels(
        modelsInfo.map((model) => model.id),
        vpMock.object,
      );
      vpMock.verify(async (x) => x.addViewedModels(modelsInfo.map((model) => model.id)), moq.Times.once());
      vpMock.verify((x) => x.clearNeverDrawn(), moq.Times.once());
      vpMock.verify((x) => x.clearNeverDrawn(), moq.Times.once());
      expect(toggleAllCategoriesSpy).to.be.calledWith(IModelApp.viewManager, vpMock.object.iModel, true, vpMock.object, false);
    });
  });

  describe("hideAllModels", () => {
    it("checks if hideAllModels calls expected functions", async () => {
      const vpMock = mockViewport();
      await hideAllModels(
        modelsInfo.map((model) => model.id),
        vpMock.object,
      );
      vpMock.verify(
        (x) =>
          x.changeModelDisplay(
            modelsInfo.map((model) => model.id),
            false,
          ),
        moq.Times.once(),
      );
    });
  });

  describe("invertAllModels", () => {
    it("checks if invertAllModels calls expected functions", async () => {
      const vpMock = mockViewport();
      vpMock.setup((x) => x.viewsModel("ModelId1")).returns(() => true);
      vpMock.setup((x) => x.viewsModel("ModelId2")).returns(() => false);
      await invertAllModels(
        modelsInfo.map((model) => model.id),
        vpMock.object,
      );
      vpMock.verify(async (x) => x.addViewedModels(["ModelId2"]), moq.Times.once());
      vpMock.verify((x) => x.changeModelDisplay(["ModelId1"], false), moq.Times.once());
    });
  });

  describe("toggleModels", () => {
    it("disables models when toggle is active", async () => {
      const vpMock = mockViewport();
      await toggleModels(
        modelsInfo.map((model) => model.id),
        true,
        vpMock.object,
      );
      vpMock.verify(
        async (vp) =>
          vp.changeModelDisplay(
            modelsInfo.map((modelInfo) => modelInfo.id),
            false,
          ),
        moq.Times.once(),
      );
    });

    it("enables models when toggle is not active", async () => {
      const vpMock = mockViewport();
      await toggleModels(
        modelsInfo.map((x) => x.id),
        false,
        vpMock.object,
      );
      vpMock.verify(async (vp) => vp.addViewedModels(modelsInfo.map((modelInfo) => modelInfo.id)), moq.Times.once());
    });
  });

  describe("areAllModelsVisible", () => {
    it("returns false if models array is empty", () => {
      const val = areAllModelsVisible([], mockViewport().object);
      expect(val).to.be.false;
    });

    it("returns false if at least one model is not visible", () => {
      const vpMock = mockViewport();
      vpMock.setup((x) => x.viewsModel("ModelId1")).returns(() => true);
      vpMock.setup((x) => x.viewsModel("ModelId2")).returns(() => false);
      const val = areAllModelsVisible(
        modelsInfo.map((model) => model.id),
        vpMock.object,
      );
      expect(val).to.be.false;
    });

    it("returns true if all models are visible", () => {
      const vpMock = mockViewport();
      vpMock.setup((x) => x.viewsModel("ModelId1")).returns(() => true);
      vpMock.setup((x) => x.viewsModel("ModelId2")).returns(() => true);
      const val = areAllModelsVisible(
        modelsInfo.map((model) => model.id),
        vpMock.object,
      );
      expect(val).to.be.true;
    });
  });

  describe("visibility change event", () => {
    it("raises event on `onAlwaysDrawnChanged` event", async () => {
      const evt = new BeEvent();
      const vpMock = mockViewport({ onAlwaysDrawnChanged: evt });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evt.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("raises event on `onNeverDrawnChanged` event", async () => {
      const evt = new BeEvent();
      const vpMock = mockViewport({ onNeverDrawnChanged: evt });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evt.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("raises event on `onViewedCategoriesChanged` event", async () => {
      const evt = new BeEvent();
      const vpMock = mockViewport({ onViewedCategoriesChanged: evt });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evt.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("raises event on `onViewedModelsChanged` event", async () => {
      const evt = new BeEvent();
      const vpMock = mockViewport({ onViewedModelsChanged: evt });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evt.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("raises event on `onViewedCategoriesPerModelChanged` event", async () => {
      const evt = new BeEvent();
      const vpMock = mockViewport({ onViewedCategoriesPerModelChanged: evt });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evt.raiseEvent(vpMock.object);
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });

    it("raises event once when multiple affecting events are fired", async () => {
      const evts = {
        onViewedCategoriesPerModelChanged: new BeEvent<(vp: Viewport) => void>(),
        onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
        onViewedModelsChanged: new BeEvent<(vp: Viewport) => void>(),
        onAlwaysDrawnChanged: new BeEvent<() => void>(),
        onNeverDrawnChanged: new BeEvent<() => void>(),
      };
      const vpMock = mockViewport({ ...evts });
      await using(createHandler({ viewport: vpMock.object }), async (handler) => {
        const spy = sinon.spy();
        handler.onVisibilityChange.addListener(spy);
        evts.onViewedCategoriesPerModelChanged.raiseEvent(vpMock.object);
        evts.onViewedCategoriesChanged.raiseEvent(vpMock.object);
        evts.onViewedModelsChanged.raiseEvent(vpMock.object);
        evts.onAlwaysDrawnChanged.raiseEvent();
        evts.onNeverDrawnChanged.raiseEvent();
        await new Promise((resolve) => setTimeout(resolve));
        expect(spy).to.be.calledOnce;
      });
    });
  });
});

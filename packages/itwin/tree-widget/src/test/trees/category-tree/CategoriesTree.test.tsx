/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { PropertyFilterRuleOperator } from "@itwin/components-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { KeySet, LabelDefinition, StandardNodeTypes } from "@itwin/presentation-common";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";
import {
  buildTestIModel,
  HierarchyBuilder,
  HierarchyCacheMode,
  initialize as initializePresentationTesting,
  terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { CategoryTree, RULESET_CATEGORIES } from "../../../components/trees/category-tree/CategoriesTree";
import { CategoryVisibilityHandler } from "../../../components/trees/category-tree/CategoryVisibilityHandler";
import { addDrawingCategory, addDrawingGraphic, addModel, addPartition, addPhysicalObject, addSpatialCategory, addSubCategory } from "../../IModelUtils";
import { mockPresentationManager, mockViewport, render, TestUtils, waitFor } from "../../TestUtils";
import {
  createPresentationTreeNodeItem,
  createSimpleTreeModelNode,
  createTestContentDescriptor,
  createTestPropertiesContentField,
  createTestPropertyInfo,
} from "../Common";

import type { TreeNodeItem } from "@itwin/components-react";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection, SpatialViewState, ViewManager, Viewport } from "@itwin/core-frontend";
import type { ECInstancesNodeKey, Node, NodePathElement } from "@itwin/presentation-common";
import type { PresentationInstanceFilterInfo, PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { RulesetVariablesManager, SelectionManager } from "@itwin/presentation-frontend";
import type { VisibilityChangeListener } from "../../../components/trees/VisibilityTreeEventHandler";
import type { CategoryInfo } from "../../../components/trees/category-tree/CategoryVisibilityHandler";
describe("CategoryTree", () => {
  describe("#unit", () => {
    const sizeProps = { width: 200, height: 200 };

    before(async () => {
      await NoRenderApp.startup();
      await TestUtils.initialize();
    });

    after(async () => {
      TestUtils.terminate();
      await IModelApp.shutdown();
    });

    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    let rulesetVariablesMock: moq.IMock<RulesetVariablesManager>;
    let viewportMock = moq.Mock.ofType<Viewport>();
    const viewStateMock = moq.Mock.ofType<SpatialViewState>();
    const viewManagerMock = moq.Mock.ofType<ViewManager>();

    beforeEach(() => {
      viewManagerMock.reset();
      imodelMock.reset();
      selectionManagerMock.reset();
      viewportMock.reset();
      viewStateMock.reset();

      const selectionChangeEvent = new SelectionChangeEvent();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());

      const mocks = mockPresentationManager();
      rulesetVariablesMock = mocks.rulesetVariablesManager;
      sinon.stub(Presentation, "presentation").get(() => mocks.presentationManager.object);
      sinon.stub(Presentation, "selection").get(() => selectionManagerMock.object);

      viewportMock = mockViewport();
      viewStateMock.setup((x) => x.is3d()).returns(() => true);
    });

    afterEach(() => {
      sinon.restore();
    });

    const createKey = (id: Id64String): ECInstancesNodeKey => {
      return {
        type: StandardNodeTypes.ECInstancesNode,
        version: 0,
        instanceKeys: [{ className: "MyDomain:SpatialCategory", id }],
        pathFromRoot: [],
      };
    };

    describe("<CategoryTree />", () => {
      const visibilityHandler = moq.Mock.ofType<CategoryVisibilityHandler>();
      const categories: CategoryInfo[] = [];

      beforeEach(() => {
        sinon.stub(PresentationTreeDataProvider.prototype, "imodel").get(() => imodelMock.object);
        sinon.stub(PresentationTreeDataProvider.prototype, "rulesetId").get(() => "");
        sinon.stub(PresentationTreeDataProvider.prototype, "dispose");
        sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves([]);
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(0);
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").resolves([]);

        resetVisibilityHandlerMock();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
      });

      const setupDataProvider = (nodes: TreeNodeItem[]) => {
        (PresentationTreeDataProvider.prototype.getNodesCount as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(nodes.length);

        (PresentationTreeDataProvider.prototype.getNodes as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").resolves(nodes);
      };

      const resetVisibilityHandlerMock = () => {
        visibilityHandler.reset();
        visibilityHandler.setup((x) => x.onVisibilityChange).returns(() => new BeEvent<VisibilityChangeListener>());
      };

      it("should have expected structure", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        const result = render(
          <CategoryTree
            {...sizeProps}
            categories={categories}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={viewportMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitFor(() => result.getByText("test-node"));
        const tree = result.getByRole("tree");
        const item = result.getByRole("treeitem");
        const check = result.getByRole("checkbox");
        expect(tree.contains(item)).to.be.true;
        expect(item.contains(check)).to.be.true;
        expect(item.contains(node)).to.be.true;
      });

      it("renders without viewport", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        const result = render(
          <CategoryTree
            {...sizeProps}
            categories={categories}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
            activeView={viewportMock.object}
          />,
        );
        await waitFor(() => result.getByText("test-node"));
      });

      it("renders context menu", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        const { user, getByText, queryByText } = render(
          <CategoryTree
            {...sizeProps}
            categories={categories}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
            activeView={viewportMock.object}
            contextMenuItems={[() => <div>Test Menu Item</div>]}
          />,
        );
        const node = await waitFor(() => getByText("test-node"));
        await user.pointer({ keys: "[MouseRight>]", target: node });

        await waitFor(() => expect(queryByText("Test Menu Item")).to.not.be.null);
      });

      it("sets ruleset variable 'ViewType' to '3d'", async () => {
        viewStateMock.reset();
        viewStateMock.setup((x) => x.is3d()).returns(() => true);
        render(
          <CategoryTree
            {...sizeProps}
            categories={categories}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={mockViewport({ viewState: viewStateMock.object }).object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );

        await waitFor(() => {
          rulesetVariablesMock.verify(async (x) => x.setString("ViewType", "3d"), moq.Times.atLeastOnce());
        });
      });

      it("sets ruleset variable 'ViewType' to '2d'", async () => {
        viewStateMock.reset();
        viewStateMock.setup((x) => x.is3d()).returns(() => false);
        render(
          <CategoryTree
            {...sizeProps}
            categories={categories}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={viewportMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );

        await waitFor(() => {
          rulesetVariablesMock.verify(async (x) => x.setString("ViewType", "2d"), moq.Times.atLeastOnce());
        });
      });

      it("renders checked checkbox if category is visible", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        resetVisibilityHandlerMock();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
        const result = render(
          <CategoryTree
            {...sizeProps}
            categories={categories}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={viewportMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitFor(() => result.getByTestId("tree-node"));
        const cb = node.querySelector("input"); // eslint-disable-line deprecation/deprecation
        expect(cb!.checked).to.be.true;
      });

      it("disposes default visibility handler on unmount", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        const disposeSpy = sinon.spy(CategoryVisibilityHandler.prototype, "dispose");
        const result = render(
          <CategoryTree
            {...sizeProps}
            categories={categories}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={viewportMock.object}
          />,
        );
        await waitFor(() => expect(result.queryByTestId("tree-node")).to.not.be.null);
        result.unmount();
        await waitFor(() => expect(disposeSpy).to.be.called);
      });

      describe("categories", () => {
        it("disables category when enabled category checkbox is unchecked", async () => {
          setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
          const { user, getByTestId } = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              activeView={viewportMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
            />,
          );
          const node = await waitFor(() => getByTestId("tree-node"));
          const cb = node.querySelector("input"); // eslint-disable-line deprecation/deprecation
          await user.click(cb!);
          visibilityHandler.verify(async (x) => x.changeVisibility(moq.It.isAny(), false), moq.Times.once());
        });

        it("enabled category when disabled category checkbox is unchecked", async () => {
          setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden", isDisabled: false }));
          const { user, getByTestId } = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              activeView={viewportMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
            />,
          );
          const node = await waitFor(() => getByTestId("tree-node"));
          const cb = node.querySelector("input"); // eslint-disable-line deprecation/deprecation
          await user.click(cb!);
          visibilityHandler.verify(async (x) => x.changeVisibility(moq.It.isAny(), true), moq.Times.once());
        });
      });

      describe("Hierarchy level filtering", () => {
        before(async () => {
          await Presentation.initialize();
        });

        after(async () => {
          Presentation.terminate();
        });

        it("renders enlarged tree node", async () => {
          setupDataProvider([createSimpleTreeModelNode()]);

          const { getByText, container } = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              density={"enlarged"}
              iModel={imodelMock.object}
              activeView={mockViewport().object}
              isHierarchyLevelFilteringEnabled={true}
            />,
          );

          await waitFor(() => getByText("Node Label"));

          const node = container.querySelector(".node-wrapper") as HTMLDivElement;
          expect(node.style.height).to.be.equal("43px");
        });

        it("renders non-filterable node", async () => {
          setupDataProvider([createSimpleTreeModelNode()]);

          const { queryByTitle, getByText } = render(
            <CategoryTree
              {...sizeProps}
              iModel={imodelMock.object}
              categories={categories}
              activeView={mockViewport().object}
              isHierarchyLevelFilteringEnabled={true}
            />,
          );

          await waitFor(() => getByText("Node Label"));
          expect(queryByTitle("tree.filter-hierarchy-level")).to.be.null;
        });

        it("renders filterable node", async () => {
          const nodeItem = createPresentationTreeNodeItem({
            hasChildren: true,
            filtering: { descriptor: createTestContentDescriptor({ fields: [] }), ancestorFilters: [] },
          });

          const simpleNode = createSimpleTreeModelNode(undefined, undefined, { parentId: nodeItem.id });
          setupDataProvider([nodeItem, simpleNode]);

          const { queryByTitle } = render(
            <CategoryTree
              {...sizeProps}
              iModel={imodelMock.object}
              categories={categories}
              activeView={mockViewport().object}
              isHierarchyLevelFilteringEnabled={true}
            />,
          );

          await waitFor(() => expect(queryByTitle("tree.filter-hierarchy-level")).to.not.be.null);
        });

        it("renders node with active filtering", async () => {
          const property = createTestPropertyInfo();
          const field = createTestPropertiesContentField({ properties: [{ property }] });
          const filterInfo: PresentationInstanceFilterInfo = {
            filter: {
              field,
              operator: PropertyFilterRuleOperator.IsNull,
            },
            usedClasses: [],
          };

          const nodeItem = createPresentationTreeNodeItem({
            hasChildren: true,
            filtering: { descriptor: createTestContentDescriptor({ fields: [] }), ancestorFilters: [], active: filterInfo },
          });

          setupDataProvider([nodeItem]);

          const { queryByTitle } = render(
            <CategoryTree
              {...sizeProps}
              iModel={imodelMock.object}
              categories={categories}
              activeView={mockViewport().object}
              isHierarchyLevelFilteringEnabled={true}
            />,
          );

          await waitFor(() => expect(queryByTitle("tree.clear-hierarchy-level-filter")).to.not.be.null);
        });
      });

      describe("subcategories", () => {
        let categoryNode: PresentationTreeNodeItem;
        let subcategoryNode: PresentationTreeNodeItem;

        beforeEach(() => {
          categoryNode = { key: createKey("categoryId"), id: "categoryId", label: PropertyRecord.fromString("category-node"), autoExpand: true };
          subcategoryNode = {
            key: createKey("subcategoryId"),
            id: "subcategoryId",
            label: PropertyRecord.fromString("subcategory-node"),
            parentId: "categoryId",
          };

          (PresentationTreeDataProvider.prototype.getNodesCount as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(1);

          (PresentationTreeDataProvider.prototype.getNodes as any).restore();
          sinon
            .stub(PresentationTreeDataProvider.prototype, "getNodes")
            .callsFake(async (parent) => (parent === categoryNode ? [subcategoryNode] : [categoryNode]));
        });

        const getSubCategoryNode = (elements: HTMLElement[]) => {
          expect(elements.length).to.be.eq(2);
          return elements[1];
        };

        it("renders checked checkbox if subcategory is enabled", async () => {
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
          const result = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              activeView={viewportMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
            />,
          );
          const node = await waitFor(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
          const cb = node.querySelector("input"); // eslint-disable-line deprecation/deprecation
          expect(cb!.checked).to.be.true;
        });

        it("disables subCategory when enabled subCategory checkbox is unchecked", async () => {
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
          const { user, getAllByTestId } = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              activeView={viewportMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
            />,
          );
          const node = await waitFor(() => getSubCategoryNode(getAllByTestId("tree-node")));
          const cb = node.querySelector("input"); // eslint-disable-line deprecation/deprecation
          await user.click(cb!);
          visibilityHandler.verify(async (x) => x.changeVisibility(subcategoryNode, false), moq.Times.once());
        });

        it("enabled subCategory when disabled subCategory checkbox is checked", async () => {
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden", isDisabled: false }));
          const { user, getAllByTestId } = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              activeView={viewportMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
            />,
          );
          const node = await waitFor(() => getSubCategoryNode(getAllByTestId("tree-node")));
          const cb = node.querySelector("input"); // eslint-disable-line deprecation/deprecation
          await user.click(cb!);
          visibilityHandler.verify(async (x) => x.changeVisibility(subcategoryNode, true), moq.Times.once());
        });
      });

      describe("filtering", () => {
        beforeEach(() => {
          resetVisibilityHandlerMock();
          visibilityHandler.setup(async (x) => x.getVisibilityStatus(moq.It.isAny())).returns(async () => ({ state: "hidden" }));
        });

        it("filters nodes", async () => {
          const filteredNode: Node = {
            key: createKey("filtered-node"),
            label: LabelDefinition.fromLabelString("filtered-node"),
          };
          const filterValue: NodePathElement[] = [{ node: filteredNode, children: [], index: 0 }];
          (PresentationTreeDataProvider.prototype.getFilteredNodePaths as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves(filterValue);

          const result = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
              filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }}
              activeView={mockViewport().object}
            />,
          );
          await result.findByText("filtered-node");
        });

        it("invokes onFilterApplied callback", async () => {
          const filteredNode: Node = {
            key: createKey("filtered-node"),
            label: LabelDefinition.fromLabelString("filtered-node"),
          };
          const filterValue: NodePathElement[] = [{ node: filteredNode, children: [], index: 0 }];
          (PresentationTreeDataProvider.prototype.getFilteredNodePaths as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves(filterValue);
          const spy = sinon.spy();

          const result = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
              filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }}
              onFilterApplied={spy}
              activeView={mockViewport().object}
            />,
          );
          await result.findByText("filtered-node");

          expect(spy).to.be.calledOnce;
        });

        it("renders VisibilityTreeNoFilteredData", async () => {
          const result = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
              filterInfo={{ filter: "filtered-node1", activeMatchIndex: 0 }}
              activeView={mockViewport().object}
            />,
          );

          await waitFor(() => result.getByText("categoriesTree.noCategoryFound"));
        });
      });
    });
  });

  describe("#integration", () => {
    beforeEach(async () => {
      await initializePresentationTesting({
        backendProps: {
          caching: {
            hierarchies: {
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        testOutputDir: join(__dirname, "output"),
        backendHostProps: {
          cacheDir: join(__dirname, "cache"),
        },
      });
    });

    afterEach(async () => {
      await terminatePresentationTesting();
    });

    it("does not show private 3d categories with RULESET_CATEGORIES", async () => {
      // eslint-disable-next-line deprecation/deprecation
      const iModel: IModelConnection = await buildTestIModel("CategoriesTree3d", async (builder) => {
        const physicalPartitionId = addPartition(builder, "BisCore:PhysicalPartition", "TestDrawingModel");
        const definitionPartitionId = addPartition(builder, "BisCore:DefinitionPartition", "TestDefinitionModel");
        const physicalModelId = addModel(builder, "BisCore:PhysicalModel", physicalPartitionId);
        const definitionModelId = addModel(builder, "BisCore:DefinitionModel", definitionPartitionId);

        const categoryId = addSpatialCategory(builder, definitionModelId, "Test SpatialCategory");
        addPhysicalObject(builder, physicalModelId, categoryId);

        const privateCategoryId = addSpatialCategory(builder, definitionModelId, "Private Test SpatialCategory", true);
        addPhysicalObject(builder, physicalModelId, privateCategoryId);
      });

      await Presentation.presentation.vars(RULESET_CATEGORIES.id).setString("ViewType", "3d");

      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_CATEGORIES);

      expect(hierarchy).to.matchSnapshot();
      expect(hierarchy).to.be.an("array").with.lengthOf(1);
      expect({ hierarchy }).to.nested.include({ "hierarchy[0].label.value.value": "Test SpatialCategory" });
    });

    it("does not show private 3d subCategories with RULESET_CATEGORIES", async () => {
      // eslint-disable-next-line deprecation/deprecation
      const iModel: IModelConnection = await buildTestIModel("CategoriesTree3d", async (builder) => {
        const physicalPartitionId = addPartition(builder, "BisCore:PhysicalPartition", "TestDrawingModel");
        const definitionPartitionId = addPartition(builder, "BisCore:DefinitionPartition", "TestDefinitionModel");
        const physicalModelId = addModel(builder, "BisCore:PhysicalModel", physicalPartitionId);
        const definitionModelId = addModel(builder, "BisCore:DefinitionModel", definitionPartitionId);

        const categoryId = addSpatialCategory(builder, definitionModelId, "Test SpatialCategory");
        addPhysicalObject(builder, physicalModelId, categoryId);

        addSubCategory(builder, definitionModelId, categoryId, "Test SpatialSubCategory");
        addSubCategory(builder, definitionModelId, categoryId, "Private Test SpatialSubCategory", true);
      });

      await Presentation.presentation.vars(RULESET_CATEGORIES.id).setString("ViewType", "3d");

      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_CATEGORIES);

      expect(hierarchy).to.matchSnapshot();
    });

    it("does not show private 2d categories with RULESET_CATEGORIES", async () => {
      // eslint-disable-next-line deprecation/deprecation
      const iModel: IModelConnection = await buildTestIModel("CategoriesTree2d", async (builder) => {
        const drawingPartitionId = addPartition(builder, "BisCore:Drawing", "TestDrawingModel");
        const definitionPartitionId = addPartition(builder, "BisCore:DefinitionPartition", "TestDefinitionModel");
        const drawingModelId = addModel(builder, "BisCore:DrawingModel", drawingPartitionId);
        const definitionModelId = addModel(builder, "BisCore:DefinitionModel", definitionPartitionId);

        const categoryId = addDrawingCategory(builder, definitionModelId, "Test Drawing Category");
        addDrawingGraphic(builder, drawingModelId, categoryId);

        const privateCategoryId = addDrawingCategory(builder, definitionModelId, "Private Test DrawingCategory", true);
        addDrawingGraphic(builder, drawingModelId, privateCategoryId);
      });

      await Presentation.presentation.vars(RULESET_CATEGORIES.id).setString("ViewType", "2d");

      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_CATEGORIES);

      expect(hierarchy).to.matchSnapshot();
    });

    it("does not show private 2d subCategories with RULESET_CATEGORIES", async () => {
      // eslint-disable-next-line deprecation/deprecation
      const iModel: IModelConnection = await buildTestIModel("CategoriesTree2d", async (builder) => {
        const drawingPartitionId = addPartition(builder, "BisCore:Drawing", "TestDrawingModel");
        const definitionPartitionId = addPartition(builder, "BisCore:DefinitionPartition", "TestDefinitionModel");
        const drawingModelId = addModel(builder, "BisCore:DrawingModel", drawingPartitionId);
        const definitionModelId = addModel(builder, "BisCore:DefinitionModel", definitionPartitionId);

        const categoryId = addDrawingCategory(builder, definitionModelId, "Test Drawing Category");
        addDrawingGraphic(builder, drawingModelId, categoryId);

        addSubCategory(builder, definitionModelId, categoryId, "Test DrawingSubCategory");
        addSubCategory(builder, definitionModelId, categoryId, "Private Test DrawingSubCategory", true);
      });

      await Presentation.presentation.vars(RULESET_CATEGORIES.id).setString("ViewType", "2d");

      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_CATEGORIES);

      expect(hierarchy).to.matchSnapshot();
    });
  });
});

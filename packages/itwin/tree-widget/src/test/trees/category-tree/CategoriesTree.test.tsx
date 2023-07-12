/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { KeySet, LabelDefinition, StandardNodeTypes } from "@itwin/presentation-common";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";
import {
  buildTestIModel, HierarchyBuilder, HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { CategoryTree, RULESET_CATEGORIES } from "../../../components/trees/category-tree/CategoriesTree";
import {
  addDrawingCategory, addDrawingGraphic, addModel, addPartition, addPhysicalObject, addSpatialCategory, addSubCategory,
} from "../../IModelUtils";
import { mockPresentationManager, mockViewport, renderWithUser, TestUtils } from "../../TestUtils";

import type { TreeNodeItem } from "@itwin/components-react";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection, SpatialViewState, ViewManager, Viewport } from "@itwin/core-frontend";
import type { ECInstancesNodeKey, Node, NodePathElement } from "@itwin/presentation-common";
import type { PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { RulesetVariablesManager, SelectionManager } from "@itwin/presentation-frontend";
import type { CategoryVisibilityHandler } from "../../../components/trees/category-tree/CategoryVisibilityHandler";
import type { VisibilityChangeListener } from "../../../components/trees/VisibilityTreeEventHandler";

describe("CategoryTree", () => {

  describe("#unit", () => {
    const sizeProps = { width: 200, height: 200 };

    before(async () => {
      // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
      await NoRenderApp.startup(); // eslint-disable-line @itwin/no-internal
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
      // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
      viewStateMock.setup((x) => x.is3d()).returns(() => true); // eslint-disable-line @itwin/no-internal
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
            categories={[]}
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
            categories={[]}
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
        const { user, getByText, queryByText } = renderWithUser(
          <CategoryTree
            {...sizeProps}
            categories={[]}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
            activeView={viewportMock.object}
            contextMenuItems={[
              () => <div>Test Menu Item</div>,
            ]}
          />,
        );
        const node = await waitFor(() => getByText("test-node"));
        await user.pointer({ keys: "[MouseRight>]", target: node });

        await waitFor(() => expect(queryByText("Test Menu Item")).to.not.be.null);
      });

      it("sets ruleset variable 'ViewType' to '3d'", async () => {
        viewStateMock.reset();
        // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
        viewStateMock.setup((x) => x.is3d()).returns(() => true); // eslint-disable-line @itwin/no-internal
        render(
          <CategoryTree
            {...sizeProps}
            categories={[]}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={mockViewport({ viewState: viewStateMock.object }).object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        rulesetVariablesMock.verify(async (x) => x.setString("ViewType", "3d"), moq.Times.once());
      });

      it("sets ruleset variable 'ViewType' to '2d'", async () => {
        viewStateMock.reset();
        // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
        viewStateMock.setup((x) => x.is3d()).returns(() => false); // eslint-disable-line @itwin/no-internal
        render(
          <CategoryTree
            {...sizeProps}
            categories={[]}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={viewportMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        rulesetVariablesMock.verify(async (x) => x.setString("ViewType", "2d"), moq.Times.once());
      });

      it("renders checked checkbox if category is visible", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        resetVisibilityHandlerMock();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
        const result = render(
          <CategoryTree
            {...sizeProps}
            categories={[]}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={viewportMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitFor(() => result.getByTestId("tree-node"));
        const cb = node.querySelector("input");
        expect(cb!.checked).to.be.true;
      });

      describe("categories", () => {
        it("disables category when enabled category checkbox is unchecked", async () => {
          setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
          const result = render(
            <CategoryTree
              {...sizeProps}
              categories={[]}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              activeView={viewportMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
            />,
          );
          const node = await waitFor(() => result.getByTestId("tree-node"));
          const cb = node.querySelector("input");
          fireEvent.click(cb!);
          visibilityHandler.verify(async (x) => x.changeVisibility(moq.It.isAny(), false), moq.Times.once());
        });

        it("enabled category when disabled category checkbox is unchecked", async () => {
          setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden", isDisabled: false }));
          const result = render(
            <CategoryTree
              {...sizeProps}
              categories={[]}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              activeView={viewportMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
            />,
          );
          const node = await waitFor(() => result.getByTestId("tree-node"));
          const cb = node.querySelector("input");
          fireEvent.click(cb!);
          visibilityHandler.verify(async (x) => x.changeVisibility(moq.It.isAny(), true), moq.Times.once());
        });

      });

      describe("subcategories", () => {
        let categoryNode: PresentationTreeNodeItem;
        let subcategoryNode: PresentationTreeNodeItem;

        beforeEach(() => {
          categoryNode = { key: createKey("categoryId"), id: "categoryId", label: PropertyRecord.fromString("category-node"), autoExpand: true };
          subcategoryNode = { key: createKey("subcategoryId"), id: "subcategoryId", label: PropertyRecord.fromString("subcategory-node"), parentId: "categoryId" };

          (PresentationTreeDataProvider.prototype.getNodesCount as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(1);

          (PresentationTreeDataProvider.prototype.getNodes as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").callsFake(
            async (parent) => parent === categoryNode ? [subcategoryNode] : [categoryNode],
          );
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
              categories={[]}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              activeView={viewportMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
            />,
          );
          const node = await waitFor(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
          const cb = node.querySelector("input");
          expect(cb!.checked).to.be.true;
        });

        it("disables subCategory when enabled subCategory checkbox is unchecked", async () => {
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
          const result = render(
            <CategoryTree
              {...sizeProps}
              categories={[]}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              activeView={viewportMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
            />,
          );
          const node = await waitFor(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
          const cb = node.querySelector("input");
          fireEvent.click(cb!);
          visibilityHandler.verify(async (x) => x.changeVisibility(subcategoryNode, false), moq.Times.once());
        });

        it("enabled subCategory when disabled subCategory checkbox is checked", async () => {
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden", isDisabled: false }));
          const result = render(
            <CategoryTree
              {...sizeProps}
              categories={[]}
              viewManager={viewManagerMock.object}
              iModel={imodelMock.object}
              activeView={viewportMock.object}
              categoryVisibilityHandler={visibilityHandler.object}
            />,
          );
          const node = await waitFor(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
          const cb = node.querySelector("input");
          fireEvent.click(cb!);
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
            // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
            label: LabelDefinition.fromLabelString("filtered-node"), // eslint-disable-line @itwin/no-internal
          };
          const filterValue: NodePathElement[] = [{ node: filteredNode, children: [], index: 0 }];
          (PresentationTreeDataProvider.prototype.getFilteredNodePaths as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves(filterValue);

          const result = render(
            <CategoryTree
              {...sizeProps}
              categories={[]}
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
            // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
            label: LabelDefinition.fromLabelString("filtered-node"), // eslint-disable-line @itwin/no-internal
          };
          const filterValue: NodePathElement[] = [{ node: filteredNode, children: [], index: 0 }];
          (PresentationTreeDataProvider.prototype.getFilteredNodePaths as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves(filterValue);
          const spy = sinon.spy();

          const result = render(
            <CategoryTree
              {...sizeProps}
              categories={[]}
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
          const result = render(<CategoryTree
            {...sizeProps}
            categories={[]}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
            filterInfo={{ filter: "filtered-node1", activeMatchIndex: 0 }}
            activeView={mockViewport().object}
          />);

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
      const iModel: IModelConnection = await buildTestIModel("CategoriesTree3d", (builder) => {
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
      const iModel: IModelConnection = await buildTestIModel("CategoriesTree3d", (builder) => {
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
      const iModel: IModelConnection = await buildTestIModel("CategoriesTree2d", (builder) => {
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
      const iModel: IModelConnection = await buildTestIModel("CategoriesTree2d", (builder) => {
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

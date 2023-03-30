/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import { join } from "path";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { TreeNodeItem } from "@itwin/components-react";
import { BeEvent, Id64String } from "@itwin/core-bentley";
import {
  BisCodeSpec, CategoryProps, Code, ElementProps, IModel, ModelProps, PhysicalElementProps, RelatedElement, RelatedElementProps, SubCategoryProps,
} from "@itwin/core-common";
import { IModelApp, IModelConnection, NoRenderApp, ScreenViewport, SpatialViewState, ViewManager, Viewport } from "@itwin/core-frontend";
import { ECInstancesNodeKey, KeySet, LabelDefinition, Node, NodePathElement, StandardNodeTypes } from "@itwin/presentation-common";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import { Presentation, PresentationManager, RulesetVariablesManager, SelectionChangeEvent, SelectionManager } from "@itwin/presentation-frontend";
import {
  buildTestIModel, HierarchyBuilder, HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
  TestIModelBuilder,
} from "@itwin/presentation-testing";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { CategoryTree, RULESET_CATEGORIES } from "../../../components/trees/category-tree/CategoriesTree";
import { CategoryVisibilityHandler } from "../../../components/trees/category-tree/CategoryVisibilityHandler";
import { VisibilityChangeListener } from "../../../components/trees/VisibilityTreeEventHandler";
import { mockPresentationManager, TestUtils } from "../../TestUtils";

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
      Presentation.terminate();
      await IModelApp.shutdown();
    });

    afterEach(() => {
      sinon.restore();
    });

    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    let presentationManagerMock: moq.IMock<PresentationManager>;
    let rulesetVariablesMock: moq.IMock<RulesetVariablesManager>;
    const viewportMock = moq.Mock.ofType<Viewport>();
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
      presentationManagerMock = mocks.presentationManager;
      rulesetVariablesMock = mocks.rulesetVariablesManager;

      void Presentation.initialize({ presentation: presentationManagerMock.object, selection: selectionManagerMock.object });

      viewportMock.setup((x) => x.view).returns(() => viewStateMock.object);
      // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
      viewStateMock.setup((x) => x.is3d()).returns(() => true); // eslint-disable-line @itwin/no-internal

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
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodeKey").callsFake((node: any) => node.__key);
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(0);
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").resolves([]);

        resetVisibilityHandlerMock();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
      });

      const setupDataProvider = (nodes: TreeNodeItem[]) => {
        (PresentationTreeDataProvider.prototype.getNodesCount as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(nodes.length);

        (PresentationTreeDataProvider.prototype.getNodes as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").callsFake(
          async () => nodes.map((n) => ({ __key: createKey(n.id), ...n })),
        );
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
          />,
        );
        await waitFor(() => result.getByText("test-node"));
      });

      it("takes open view from viewManager", async () => {
        const screenViewportMock = moq.Mock.ofType<ScreenViewport>();
        screenViewportMock.setup((x) => x.view).returns(() => viewStateMock.object);
        viewManagerMock.setup((x) => x.getFirstOpenView()).returns(() => screenViewportMock.object);
        render(
          <CategoryTree
            {...sizeProps}
            categories={[]}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        viewManagerMock.verify((x) => x.getFirstOpenView(), moq.Times.once());
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
            activeView={viewportMock.object}
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
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
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
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
          visibilityHandler.setup(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), false)).returns(async () => { });
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
          visibilityHandler.verify(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), false), moq.Times.once());
        });

        it("enabled category when disabled category checkbox is unchecked", async () => {
          setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden", isDisabled: false }));
          visibilityHandler.setup(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), true)).returns(async () => { });
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
          visibilityHandler.verify(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), true), moq.Times.once());
        });

      });

      describe("subcategories", () => {
        let categoryNode: TreeNodeItem;
        let subcategoryNode: TreeNodeItem;

        beforeEach(() => {
          categoryNode = { id: "categoryId", label: PropertyRecord.fromString("category-node"), autoExpand: true };
          subcategoryNode = { id: "subcategoryId", label: PropertyRecord.fromString("subcategory-node"), parentId: "categoryId" };
          (categoryNode as any).__key = createKey(categoryNode.id);
          (subcategoryNode as any).__key = createKey(subcategoryNode.id);

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
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
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
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
          visibilityHandler.setup(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), false)).returns(async () => { });
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
          visibilityHandler.verify(async (x) => x.changeVisibility(subcategoryNode, moq.It.isAny(), false), moq.Times.once());
        });

        it("enabled subCategory when disabled subCategory checkbox is checked", async () => {
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden", isDisabled: false }));
          visibilityHandler.setup(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), true)).returns(async () => { });
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
          visibilityHandler.verify(async (x) => x.changeVisibility(subcategoryNode, moq.It.isAny(), true), moq.Times.once());
        });

      });

      describe("filtering", () => {
        beforeEach(() => {
          resetVisibilityHandlerMock();
          (PresentationTreeDataProvider.prototype.getNodeKey as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getNodeKey").callsFake(
            (node) => (node as any)["__presentation-components/key"],
          );
          visibilityHandler.setup(async (x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(async () => ({ state: "hidden" }));
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
      });
    });

    afterEach(async () => {
      await terminatePresentationTesting();
    });

    it("does not show private 3d categories with RULESET_CATEGORIES", async () => {
      const iModel: IModelConnection = await buildTestIModel("CategoriesTree3d", (builder) => {
        const physicalPartitionId = addPartition("BisCore:PhysicalPartition", builder, "TestDrawingModel");
        const definitionPartitionId = addPartition("BisCore:DefinitionPartition", builder, "TestDefinitionModel");
        const physicalModelId = addModel("BisCore:PhysicalModel", builder, physicalPartitionId);
        const definitionModelId = addModel("BisCore:DefinitionModel", builder, definitionPartitionId);

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
        const physicalPartitionId = addPartition("BisCore:PhysicalPartition", builder, "TestDrawingModel");
        const definitionPartitionId = addPartition("BisCore:DefinitionPartition", builder, "TestDefinitionModel");
        const physicalModelId = addModel("BisCore:PhysicalModel", builder, physicalPartitionId);
        const definitionModelId = addModel("BisCore:DefinitionModel", builder, definitionPartitionId);

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
        const drawingPartitionId = addPartition("BisCore:Drawing", builder, "TestDrawingModel");
        const definitionPartitionId = addPartition("BisCore:DefinitionPartition", builder, "TestDefinitionModel");
        const drawingModelId = addModel("BisCore:DrawingModel", builder, drawingPartitionId);
        const definitionModelId = addModel("BisCore:DefinitionModel", builder, definitionPartitionId);

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
        const drawingPartitionId = addPartition("BisCore:Drawing", builder, "TestDrawingModel");
        const definitionPartitionId = addPartition("BisCore:DefinitionPartition", builder, "TestDefinitionModel");
        const drawingModelId = addModel("BisCore:DrawingModel", builder, drawingPartitionId);
        const definitionModelId = addModel("BisCore:DefinitionModel", builder, definitionPartitionId);

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

    const addPartition = (classFullName: string, builder: TestIModelBuilder, name: string, parentId = IModel.rootSubjectId) => {
      const parentProps: RelatedElementProps = {
        relClassName: "BisCore:SubjectOwnsPartitionElements",
        id: parentId,
      };

      const partitionProps: ElementProps = {
        classFullName,
        model: IModel.repositoryModelId,
        parent: parentProps,
        code: builder.createCode(parentId, BisCodeSpec.informationPartitionElement, name),
      };
      return builder.insertElement(partitionProps);
    };

    const addModel = (classFullName: string, builder: TestIModelBuilder, partitionId: string) => {
      const modelProps: ModelProps = {
        modeledElement: new RelatedElement({ id: partitionId }),
        classFullName,
        isPrivate: false,
      };
      return builder.insertModel(modelProps);
    };

    const addSpatialCategory = (builder: TestIModelBuilder, modelId: string, name: string, isPrivate?: boolean) => {
      const spatialCategoryProps: CategoryProps = {
        classFullName: "BisCore:SpatialCategory",
        model: modelId,
        code: builder.createCode(modelId, BisCodeSpec.spatialCategory, name),
        isPrivate,
      };
      return builder.insertElement(spatialCategoryProps);
    };

    const addPhysicalObject = (builder: TestIModelBuilder, modelId: string, categoryId: string, elemCode = Code.createEmpty()) => {
      const physicalObjectProps: PhysicalElementProps = {
        classFullName: "Generic:PhysicalObject",
        model: modelId,
        category: categoryId,
        code: elemCode,
      };
      builder.insertElement(physicalObjectProps);
    };

    const addDrawingCategory = (builder: TestIModelBuilder, modelId: string, name: string, isPrivate?: boolean) => {
      const spatialCategoryProps: CategoryProps = {
        classFullName: "BisCore:DrawingCategory",
        model: modelId,
        code: builder.createCode(modelId, BisCodeSpec.drawingCategory, name),
        isPrivate,
      };
      return builder.insertElement(spatialCategoryProps);
    };

    const addDrawingGraphic = (builder: TestIModelBuilder, modelId: string, categoryId: string, elemCode = Code.createEmpty()) => {
      const physicalObjectProps: PhysicalElementProps = {
        classFullName: "BisCore:DrawingGraphic",
        model: modelId,
        category: categoryId,
        code: elemCode,
      };
      builder.insertElement(physicalObjectProps);
    };

    const addSubCategory = (builder: TestIModelBuilder, modelId: string, parentId: string, name: string, isPrivate?: boolean) => {
      const subCategoryProps: SubCategoryProps = {
        classFullName: "BisCore:SubCategory",
        parent: { id: parentId, relClassName: "BisCore:CategoryOwnsSubCategories" },
        model: modelId,
        code: builder.createCode(parentId, BisCodeSpec.subCategory, name),
        isPrivate,
      };
      return builder.insertElement(subCategoryProps);
    };
  });
});

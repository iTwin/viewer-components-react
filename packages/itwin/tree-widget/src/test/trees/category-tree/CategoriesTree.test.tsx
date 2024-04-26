/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord, StandardTypeNames } from "@itwin/appui-abstract";
import { PropertyFilterRuleOperator } from "@itwin/components-react";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { KeySet, LabelDefinition, PropertyValueFormat, StandardNodeTypes } from "@itwin/presentation-common";
import { InfoTreeNodeItemType, PresentationTreeDataProvider } from "@itwin/presentation-components";
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
import { mockPresentationManager, mockViewport, render, stubDOMMatrix, TestUtils, waitFor } from "../../TestUtils";
import {
  createElementNode,
  createInfoNode,
  createModelNode,
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
      sinon.stub(Presentation, "localization").get(() => new EmptyLocalization());

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

      it("reports when node visibility checkbox is clicked", async () => {
        const onFeatureUsedSpy = sinon.spy();
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        resetVisibilityHandlerMock();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
        const { user, getByTestId } = render(
          <CategoryTree
            {...sizeProps}
            categories={categories}
            iModel={imodelMock.object}
            activeView={mockViewport().object}
            onFeatureUsed={onFeatureUsedSpy}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitFor(() => getByTestId("tree-node"));
        const visibilityCheckbox = node.querySelector("input"); // eslint-disable-line deprecation/deprecation
        await user.click(visibilityCheckbox!);

        expect(onFeatureUsedSpy).to.be.calledTwice;
        expect(onFeatureUsedSpy).to.be.calledWith("use-categories-tree");
        expect(onFeatureUsedSpy).to.be.calledWith("categories-tree-visibility-change");
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

      it("renders enlarged tree node", async () => {
        setupDataProvider([createSimpleTreeModelNode()]);

        const { getByText, container } = render(
          <CategoryTree {...sizeProps} categories={categories} density={"enlarged"} iModel={imodelMock.object} activeView={mockViewport().object} />,
        );

        await waitFor(() => getByText("Node Label"));

        const node = container.querySelector(".node-wrapper") as HTMLDivElement;
        expect(node.style.height).to.be.equal("43px");
      });

      describe("hierarchy level filtering", () => {
        stubDOMMatrix();

        beforeEach(() => {
          const localization = new EmptyLocalization();
          sinon.stub(Presentation, "localization").get(() => localization);
        });

        it("renders non-filterable node", async () => {
          setupDataProvider([createSimpleTreeModelNode()]);

          const { queryByTitle, getByText } = render(
            <CategoryTree
              {...sizeProps}
              iModel={imodelMock.object}
              categories={categories}
              activeView={mockViewport().object}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
            />,
          );

          await waitFor(() => getByText("Node Label"));
          expect(queryByTitle("tree.filter-hierarchy-level")).to.be.null;
        });

        it("renders information message when node item is of `ResultSetTooLarge` type", async () => {
          const nodeItem = createInfoNode(undefined, "filtering message", InfoTreeNodeItemType.ResultSetTooLarge);
          setupDataProvider([nodeItem]);

          const { queryByText } = render(
            <CategoryTree
              {...sizeProps}
              iModel={imodelMock.object}
              categories={categories}
              activeView={mockViewport().object}
              hierarchyLevelConfig={{ isFilteringEnabled: true, sizeLimit: 0 }}
            />,
          );

          await waitFor(() => expect(queryByText("filtering message")).to.not.be.null);
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
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
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
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
            />,
          );

          await waitFor(() => expect(queryByTitle("tree.clear-hierarchy-level-filter")).to.not.be.null);
        });

        it("reports when node visibility checkbox is clicked", async () => {
          const onFeatureUsedSpy = sinon.spy();
          setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
          const { user, getByTestId } = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              iModel={imodelMock.object}
              activeView={mockViewport().object}
              onFeatureUsed={onFeatureUsedSpy}
              categoryVisibilityHandler={visibilityHandler.object}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
            />,
          );
          const node = await waitFor(() => getByTestId("tree-node"));
          const visibilityCheckbox = node.querySelector("input"); // eslint-disable-line deprecation/deprecation
          await user.click(visibilityCheckbox!);

          expect(onFeatureUsedSpy).to.be.calledTwice;
          expect(onFeatureUsedSpy).to.be.calledWith("use-categories-tree");
          expect(onFeatureUsedSpy).to.be.calledWith("categories-tree-visibility-change");
        });

        it("reports when hierarchy level filter is applied", async () => {
          const property = createTestPropertyInfo({ name: "TestProperty", type: StandardTypeNames.Bool });
          const propertyField = createTestPropertiesContentField({
            properties: [{ property }],
            name: property.name,
            label: property.name,
            type: { typeName: StandardTypeNames.Bool, valueFormat: PropertyValueFormat.Primitive },
          });
          const initialFilter: PresentationInstanceFilterInfo = {
            filter: { field: propertyField, operator: "is-false" },
            usedClasses: [],
          };
          const model = createModelNode();
          model.hasChildren = true;
          model.filtering = { descriptor: createTestContentDescriptor({ fields: [propertyField] }), active: initialFilter, ancestorFilters: [] };
          const element = createElementNode(model.id);
          const onFeatureUsedSpy = sinon.spy();
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
          setupDataProvider([model, element]);
          const { baseElement, user, getByTitle } = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              iModel={imodelMock.object}
              activeView={mockViewport().object}
              categoryVisibilityHandler={visibilityHandler.object}
              onFeatureUsed={onFeatureUsedSpy}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
            />,
          );

          const filterButton = await waitFor(() => getByTitle("tree.filter-hierarchy-level"));
          await user.click(filterButton);

          // open property selector
          const propertySelector = await waitFor(() => baseElement.querySelector(".fb-property-name input"));
          expect(propertySelector).to.not.be.null;
          await user.click(propertySelector!);

          // select property
          await user.click(getByTitle(propertyField.label));

          // wait until apply button is enabled
          const applyButton = await waitFor(() => {
            const button = baseElement.querySelector<HTMLInputElement>(".presentation-instance-filter-dialog-apply-button");
            expect(button?.disabled).to.be.false;
            return button;
          });
          await user.click(applyButton!);

          // wait until dialog closes
          await waitFor(() => {
            expect(baseElement.querySelector(".presentation-instance-filter-dialog")).to.be.null;
          });

          expect(onFeatureUsedSpy).to.be.calledWith(`use-categories-tree`);
        });

        it("reports when hierarchy level filter is cleared", async () => {
          const property = createTestPropertyInfo({ name: "TestProperty", type: StandardTypeNames.Bool });
          const propertyField = createTestPropertiesContentField({
            properties: [{ property }],
            name: property.name,
            label: property.name,
            type: { typeName: StandardTypeNames.Bool, valueFormat: PropertyValueFormat.Primitive },
          });
          const initialFilter: PresentationInstanceFilterInfo = {
            filter: { field: propertyField, operator: "is-false" },
            usedClasses: [],
          };
          const model = createModelNode();
          model.hasChildren = true;
          model.filtering = { descriptor: createTestContentDescriptor({ fields: [propertyField] }), active: initialFilter, ancestorFilters: [] };
          const element = createElementNode(model.id);
          const onFeatureUsedSpy = sinon.spy();
          resetVisibilityHandlerMock();
          visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
          setupDataProvider([model, element]);
          const { user, getByTitle, queryAllByTitle } = render(
            <CategoryTree
              {...sizeProps}
              categories={categories}
              iModel={imodelMock.object}
              activeView={mockViewport().object}
              categoryVisibilityHandler={visibilityHandler.object}
              onFeatureUsed={onFeatureUsedSpy}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
            />,
          );

          const clearFilterButton = await waitFor(() => getByTitle("tree.clear-hierarchy-level-filter"));
          await user.click(clearFilterButton);

          // wait until dialog closes
          await waitFor(() => {
            expect(queryAllByTitle(".tree.clear-hierarchy-level-filter")).to.be.empty;
          });

          expect(onFeatureUsedSpy).to.be.calledWith(`use-categories-tree`);
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

      describe("performance reporting", () => {
        const onPerformanceMeasuredSpy = sinon.spy();
        const imodelMock2 = moq.Mock.ofType<IModelConnection>();

        beforeEach(() => {
          onPerformanceMeasuredSpy.resetHistory();
        });

        it("reports initial load performance metric", async () => {
          setupDataProvider([createSimpleTreeModelNode()]);

          const { getByText } = render(
            <CategoryTree
              {...sizeProps}
              iModel={imodelMock.object}
              categories={categories}
              activeView={mockViewport().object}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
              onPerformanceMeasured={onPerformanceMeasuredSpy}
            />,
          );

          await waitFor(() => getByText("Node Label"));
          expect(onPerformanceMeasuredSpy.callCount).to.be.eq(1);
          expect(onPerformanceMeasuredSpy.getCall(0).calledWith("categories-tree-initial-load")).to.be.true;
        });

        it("reports initial load performance metric on iModel change", async () => {
          setupDataProvider([createSimpleTreeModelNode()]);

          const { getByText, rerender } = render(
            <CategoryTree
              {...sizeProps}
              iModel={imodelMock.object}
              categories={categories}
              activeView={mockViewport().object}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
              onPerformanceMeasured={onPerformanceMeasuredSpy}
            />,
          );

          await waitFor(() => getByText("Node Label"));

          rerender(
            <CategoryTree
              {...sizeProps}
              iModel={imodelMock2.object}
              categories={categories}
              activeView={mockViewport().object}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
              onPerformanceMeasured={onPerformanceMeasuredSpy}
            />,
          );

          await waitFor(() => getByText("Node Label"));
          expect(onPerformanceMeasuredSpy.callCount).to.be.eq(2);
          expect(onPerformanceMeasuredSpy.getCall(0).calledWith("categories-tree-initial-load")).to.be.true;
          expect(onPerformanceMeasuredSpy.getCall(1).calledWith("categories-tree-initial-load")).to.be.true;
        });

        it("reports hierarchy load performance metric", async () => {
          const nodeItem = createPresentationTreeNodeItem({ hasChildren: true });
          setupDataProvider([nodeItem]);

          const { user, getByText, getByTestId } = render(
            <CategoryTree
              {...sizeProps}
              iModel={imodelMock.object}
              categories={categories}
              activeView={mockViewport().object}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
              onPerformanceMeasured={onPerformanceMeasuredSpy}
            />,
          );

          await waitFor(() => getByText("Node Label"));
          const expandButton = getByTestId("tree-node-expansion-toggle");
          await user.click(expandButton);

          expect(onPerformanceMeasuredSpy.callCount).to.be.eq(2);
          expect(onPerformanceMeasuredSpy.getCall(0).calledWith("categories-tree-initial-load")).to.be.true;
          expect(onPerformanceMeasuredSpy.getCall(1).calledWith("categories-tree-hierarchy-level-load")).to.be.true;
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

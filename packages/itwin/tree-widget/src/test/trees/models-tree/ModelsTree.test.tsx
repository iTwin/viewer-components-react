/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { SelectionMode } from "@itwin/components-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { KeySet, LabelDefinition } from "@itwin/presentation-common";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";
import {
  buildTestIModel,
  createFileNameFromString,
  HierarchyBuilder,
  HierarchyCacheMode,
  initialize as initializePresentationTesting,
  terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { ClassGroupingOption } from "../../../components/trees/common/Types";
import { ModelsTree } from "../../../components/trees/models-tree/ModelsTree";
import { ModelsTreeNodeType } from "../../../components/trees/models-tree/ModelsVisibilityHandler";
import * as modelsTreeUtils from "../../../components/trees/models-tree/Utils";
import { addModel, addPartition, addPhysicalObject, addSpatialCategory, addSpatialLocationElement, addSubject } from "../../IModelUtils";
import { deepEquals, mockPresentationManager, mockViewport, render, TestUtils, waitFor } from "../../TestUtils";
import { createCategoryNode, createElementClassGroupingNode, createElementNode, createKey, createModelNode, createSubjectNode } from "../Common";

import type { ECInstancesNodeKey, Node, NodeKey, NodePathElement } from "@itwin/presentation-common";
import type { ModelsVisibilityHandler } from "../../../components/trees/models-tree/ModelsVisibilityHandler";
import type { TreeNodeItem } from "@itwin/components-react";
import type { ModelsTreeHierarchyConfiguration } from "../../../components/trees/models-tree/ModelsTree";
import type { IModelConnection } from "@itwin/core-frontend";
import type { SelectionManager } from "@itwin/presentation-frontend";
import type { VisibilityChangeListener } from "../../../components/trees/VisibilityTreeEventHandler";

describe("ModelsTree", () => {
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

  afterEach(() => {
    imodelMock.reset();
    sinon.restore();
  });

  describe("#unit", () => {
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();

    beforeEach(() => {
      imodelMock.reset();
      selectionManagerMock.reset();
      sinon.stub(PresentationTreeDataProvider.prototype, "imodel").get(() => imodelMock.object);
      sinon.stub(PresentationTreeDataProvider.prototype, "rulesetId").get(() => "");
      sinon.stub(PresentationTreeDataProvider.prototype, "dispose");
      sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves([]);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(0);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").resolves([]);

      const selectionChangeEvent = new SelectionChangeEvent();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());

      const mocks = mockPresentationManager();
      sinon.stub(Presentation, "presentation").get(() => mocks.presentationManager.object);
      sinon.stub(Presentation, "selection").get(() => selectionManagerMock.object);
    });

    const setupDataProvider = (nodes: TreeNodeItem[]) => {
      (PresentationTreeDataProvider.prototype.getNodesCount as any).restore();
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(nodes.length);

      (PresentationTreeDataProvider.prototype.getNodes as any).restore();
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").resolves(nodes);
    };

    const setupDataProviderForEachNodeType = () => {
      setupDataProvider([createSubjectNode(), createModelNode(), createCategoryNode(), createElementNode()]);
    };

    describe("<ModelsTree />", () => {
      const visibilityChangeEvent = new BeEvent<VisibilityChangeListener>();
      const visibilityHandlerMock = {
        onVisibilityChange: visibilityChangeEvent,
        setFilteredDataProvider: () => {},
      } as unknown as ModelsVisibilityHandler;

      beforeEach(() => {
        visibilityChangeEvent.clear();
      });

      const isNodeChecked = (node: HTMLElement): boolean => {
        const cb = node.querySelector("input"); // eslint-disable-line deprecation/deprecation
        return cb!.checked;
      };

      it("should match snapshot", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node"), isCheckboxVisible: true }]);
        visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });
        const result = render(
          <ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock} activeView={mockViewport().object} />,
        );
        await waitFor(() => result.getByText("test-node"), { container: result.container });
        expect(result.baseElement).to.matchSnapshot();
      });

      it("renders root node without expansion toggle", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node"), isCheckboxVisible: true }]);
        visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });
        const { getByTestId } = render(
          <ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock} activeView={mockViewport().object} />,
        );
        const node = await waitFor(() => getByTestId("tree-node"));
        expect(node.className.includes("disable-expander")).to.be.true;
      });

      it("renders context menu", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node"), isCheckboxVisible: true }]);
        visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden", isDisabled: false });

        const { user, getByText, queryByText } = render(
          <ModelsTree
            {...sizeProps}
            iModel={imodelMock.object}
            modelsVisibilityHandler={visibilityHandlerMock}
            activeView={mockViewport().object}
            contextMenuItems={[() => <div>Test Menu Item</div>]}
          />,
        );

        const node = await waitFor(() => getByText("test-node"));
        await user.pointer({ keys: "[MouseRight>]", target: node });

        await waitFor(() => expect(queryByText("Test Menu Item")).to.not.be.null);
      });

      it("renders nodes as unchecked when they're not displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });

        const result = render(
          <ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock} activeView={mockViewport().object} />,
        );
        await waitFor(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.false);
      });

      it("renders nodes as checked when they're displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "visible" });

        const result = render(
          <ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock} activeView={mockViewport().object} />,
        );
        await waitFor(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.true);
      });

      it("re-renders nodes on `onVisibilityChange` event", async () => {
        const node = createModelNode();
        setupDataProvider([node]);

        visibilityHandlerMock.getVisibilityStatus = sinon.stub().resolves({ state: "hidden", isDisabled: false });
        const result = render(
          <ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock} activeView={mockViewport().object} />,
        );
        await waitFor(() => {
          const renderedNode = result.getByTestId("tree-node");
          if (isNodeChecked(renderedNode)) {
            throw new Error("expecting unchecked node");
          }
          return renderedNode;
        });
        expect(visibilityHandlerMock.getVisibilityStatus).to.be.calledTwice;

        visibilityHandlerMock.getVisibilityStatus = sinon.stub().resolves({ state: "visible", isDisabled: false });
        visibilityChangeEvent.raiseEvent();
        await waitFor(() => {
          const renderedNode = result.getByTestId("tree-node");
          if (!isNodeChecked(renderedNode)) {
            throw new Error("expecting checked node");
          }
          return renderedNode;
        });
        expect(visibilityHandlerMock.getVisibilityStatus).to.be.calledTwice;
      });

      it("re-renders nodes without checkboxes if visibility handler does not exist", async () => {
        const node = createModelNode();
        setupDataProvider([node]);

        visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "visible" });
        const result = render(
          <ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock} activeView={mockViewport().object} />,
        );
        const renderedNode = await result.findByTestId("tree-node");
        expect(renderedNode.querySelectorAll("input").length).to.eq(1); // eslint-disable-line deprecation/deprecation

        result.rerender(<ModelsTree {...sizeProps} iModel={imodelMock.object} activeView={mockViewport().object} />);
        const rerenderedNode = await result.findByTestId("tree-node");
        expect(rerenderedNode.querySelectorAll("input").length).to.eq(1); // eslint-disable-line deprecation/deprecation
      });

      it("calls visibility handler's `changeVisibility` on node checkbox state changes to 'checked'", async () => {
        const node = createModelNode();
        setupDataProvider([node]);
        visibilityHandlerMock.changeVisibility = sinon.spy();
        visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });
        const { user, queryByText, getByTestId } = render(
          <ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock} activeView={mockViewport().object} />,
        );
        await waitFor(() => expect(queryByText("model")).to.not.be.null);
        const renderedNode = getByTestId("tree-node");
        const cb = renderedNode.querySelector("input"); // eslint-disable-line deprecation/deprecation
        await user.click(cb!);

        expect(visibilityHandlerMock.changeVisibility).to.be.calledOnce;
      });

      it("respects `hierarchyConfig` prop", async () => {
        const createRulesetSpy = sinon.stub(modelsTreeUtils, "createRuleset").returns({
          id: "testRulesetId",
          rules: [],
        });
        const hierarchyConfig: ModelsTreeHierarchyConfiguration = {
          enableElementsClassGrouping: ClassGroupingOption.YesWithCounts,
          elementClassSpecification: {
            schemaName: "testSchemaName",
            className: "testClassName",
          },
          showEmptyModels: false,
        };
        render(
          <ModelsTree
            {...sizeProps}
            iModel={imodelMock.object}
            modelsVisibilityHandler={visibilityHandlerMock}
            activeView={mockViewport().object}
            hierarchyConfig={hierarchyConfig}
          />,
        );
        await waitFor(() =>
          expect(createRulesetSpy).to.be.calledWith({
            ...hierarchyConfig,
            enableElementsClassGrouping: true, // `createRuleset` takes a boolean for this prop - counts are handled after the nodes are loaded
          }),
        );
      });

      it("should create and dispose visibilityHandler when factory function is passed", async () => {
        const node: TreeNodeItem = { id: "test", label: PropertyRecord.fromString("test-node"), isCheckboxVisible: true };
        setupDataProvider([node]);
        const newHandler = {
          dispose: sinon.stub(),
          onVisibilityChange: new BeEvent(),
          setFilteredDataProvider: sinon.stub(),
        };
        const visibilityHandlerSpy = sinon.stub().returns(newHandler);
        const result = render(
          <ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerSpy} activeView={mockViewport().object} />,
        );
        await waitFor(() => result.getByText("test-node"), { container: result.container });
        expect(visibilityHandlerSpy).to.be.called;

        result.unmount();
        await waitFor(() => {
          expect(newHandler.dispose).to.be.called;
        });
      });

      it("should dispose of the visibilityHandler when ModelTree component is unmounted", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node"), isCheckboxVisible: true }]);
        visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });
        visibilityHandlerMock.dispose = sinon.spy();
        const visibilityHandlerCallback = () => visibilityHandlerMock;
        const result = render(
          <ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerCallback} activeView={mockViewport().object} />,
        );
        await waitFor(() => result.getByText("test-node"), { container: result.container });
        result.unmount();
        expect(visibilityHandlerMock.dispose).to.be.called;
      });

      describe("selection", () => {
        it("adds node to unified selection", async () => {
          const element = createElementNode();
          setupDataProvider([element]);
          visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });

          const { user, queryByText, getByTestId } = render(
            <ModelsTree
              {...sizeProps}
              iModel={imodelMock.object}
              modelsVisibilityHandler={visibilityHandlerMock}
              selectionMode={SelectionMode.Extended}
              activeView={mockViewport().object}
            />,
          );
          await waitFor(() => expect(queryByText("element")).to.not.be.null);

          const renderedNode = getByTestId("tree-node");
          await user.click(renderedNode);
          selectionManagerMock.verify(
            (x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals((element.key as ECInstancesNodeKey).instanceKeys), 0, ""),
            moq.Times.once(),
          );
        });

        it("adds element node to unified selection according to `selectionPredicate`", async () => {
          const element = createElementNode();
          setupDataProvider([element]);
          visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Element;

          const { user, queryByText, getByTestId } = render(
            <ModelsTree
              {...sizeProps}
              iModel={imodelMock.object}
              modelsVisibilityHandler={visibilityHandlerMock}
              selectionMode={SelectionMode.Extended}
              selectionPredicate={predicate}
              activeView={mockViewport().object}
            />,
          );
          await waitFor(() => expect(queryByText("element")).to.not.be.null);

          const renderedNode = getByTestId("tree-node");
          await user.click(renderedNode);
          selectionManagerMock.verify(
            (x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals((element.key as ECInstancesNodeKey).instanceKeys), 0, ""),
            moq.Times.once(),
          );
        });

        it("adds multiple model nodes to unified selection according to `selectionPredicate`", async () => {
          const node1 = createModelNode();
          const node2 = createModelNode();
          node2.id = "model2";
          setupDataProvider([node1, node2]);
          visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Model;

          const { user, queryAllByText, getAllByTestId } = render(
            <ModelsTree
              {...sizeProps}
              iModel={imodelMock.object}
              modelsVisibilityHandler={visibilityHandlerMock}
              selectionMode={SelectionMode.Extended}
              selectionPredicate={predicate}
              activeView={mockViewport().object}
            />,
          );
          await waitFor(() => expect(queryAllByText("model").length).to.be.eq(2));

          const renderedNodes = getAllByTestId("tree-node");
          expect(renderedNodes.length).to.be.eq(2);
          await user.click(renderedNodes[0]);
          await user.keyboard("[ControlLeft>]");
          await user.click(renderedNodes[1]);

          selectionManagerMock.verify(
            (x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals((node1.key as ECInstancesNodeKey).instanceKeys), 0, ""),
            moq.Times.once(),
          );
          selectionManagerMock.verify(
            (x) => x.addToSelection(moq.It.isAny(), imodelMock.object, deepEquals((node2.key as ECInstancesNodeKey).instanceKeys), 0, ""),
            moq.Times.once(),
          );
        });

        it("adds subject node to unified selection according to `selectionPredicate`", async () => {
          const subject = createSubjectNode();
          setupDataProvider([subject]);
          visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Subject;

          const { user, queryByText, getByTestId } = render(
            <ModelsTree
              {...sizeProps}
              iModel={imodelMock.object}
              modelsVisibilityHandler={visibilityHandlerMock}
              selectionMode={SelectionMode.Extended}
              selectionPredicate={predicate}
              activeView={mockViewport().object}
            />,
          );
          await waitFor(() => expect(queryByText("subject")).to.not.be.null);

          const renderedNode = getByTestId("tree-node");
          await user.click(renderedNode);
          selectionManagerMock.verify(
            (x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals((subject.key as ECInstancesNodeKey).instanceKeys), 0, ""),
            moq.Times.once(),
          );
        });

        it("adds node without extendedData to unified selection according to `selectionPredicate`", async () => {
          const node = createElementNode();
          (node as any).extendedData = undefined;
          setupDataProvider([node]);
          visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Unknown;

          const { user, queryByText, getByTestId } = render(
            <ModelsTree
              {...sizeProps}
              iModel={imodelMock.object}
              modelsVisibilityHandler={visibilityHandlerMock}
              selectionMode={SelectionMode.Extended}
              selectionPredicate={predicate}
              activeView={mockViewport().object}
            />,
          );
          await waitFor(() => expect(queryByText("element")).to.not.be.null);

          const renderedNode = getByTestId("tree-node");
          await user.click(renderedNode);
          selectionManagerMock.verify(
            (x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals((node.key as ECInstancesNodeKey).instanceKeys), 0, ""),
            moq.Times.once(),
          );
        });

        it("adds element class grouping node to unified selection according to `selectionPredicate`", async () => {
          const node = createElementClassGroupingNode(["0x1", "0x2"]);
          setupDataProvider([node]);
          visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Grouping;

          const { user, queryByText, getByTestId } = render(
            <ModelsTree
              {...sizeProps}
              iModel={imodelMock.object}
              modelsVisibilityHandler={visibilityHandlerMock}
              selectionMode={SelectionMode.Extended}
              selectionPredicate={predicate}
              activeView={mockViewport().object}
            />,
          );
          await waitFor(() => expect(queryByText("grouping")).to.not.be.null);

          const renderedNode = getByTestId("tree-node");
          await user.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals([node.key]), 0, ""), moq.Times.once());
        });

        it("does not add category node to unified selection according to `selectionPredicate`", async () => {
          const node = createCategoryNode();
          setupDataProvider([node]);
          visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Model;

          const { user, queryByText, getByTestId } = render(
            <ModelsTree
              {...sizeProps}
              iModel={imodelMock.object}
              modelsVisibilityHandler={visibilityHandlerMock}
              selectionMode={SelectionMode.Extended}
              selectionPredicate={predicate}
              activeView={mockViewport().object}
            />,
          );
          await waitFor(() => expect(queryByText("category")).to.not.be.null);

          const renderedNode = getByTestId("tree-node");
          await user.click(renderedNode);
          selectionManagerMock.verify(
            (x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()),
            moq.Times.never(),
          );
        });
      });

      describe("filtering", () => {
        beforeEach(() => {
          const filteredNode: Node = {
            key: createKey("element", "filtered-element"),
            label: LabelDefinition.fromLabelString("filtered-node"),
          };
          const filter: NodePathElement[] = [{ node: filteredNode, children: [], index: 0 }];
          (PresentationTreeDataProvider.prototype.getFilteredNodePaths as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves(filter);

          visibilityHandlerMock.getVisibilityStatus = async () => ({ state: "hidden" });
        });

        it("filters nodes", async () => {
          const result = render(
            <ModelsTree
              {...sizeProps}
              iModel={imodelMock.object}
              modelsVisibilityHandler={visibilityHandlerMock}
              filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }}
              activeView={mockViewport().object}
            />,
          );
          await result.findByText("filtered-node");
        });

        it("invokes onFilterApplied callback", async () => {
          const spy = sinon.spy();

          const result = render(
            <ModelsTree
              {...sizeProps}
              iModel={imodelMock.object}
              modelsVisibilityHandler={visibilityHandlerMock}
              filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }}
              onFilterApplied={spy}
              activeView={mockViewport().object}
            />,
          );
          await result.findByText("filtered-node");

          expect(spy).to.be.calledOnce;
        });
      });
    });
  });

  describe("#integration", () => {
    const createRuleset = modelsTreeUtils.createRuleset;

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

    it("does not load private categories", async () => {
      // eslint-disable-next-line deprecation/deprecation
      const iModel: IModelConnection = await buildTestIModel("ModelsTree", async (builder) => {
        const partitionId = addPartition(builder, "BisCore:PhysicalPartition", "TestPhysicalModel");
        const definitionPartitionId = addPartition(builder, "BisCore:DefinitionPartition", "TestDefinitionModel");
        const modelId = addModel(builder, "BisCore:PhysicalModel", partitionId);
        const definitionModelId = addModel(builder, "BisCore:DefinitionModel", definitionPartitionId);

        const categoryId = addSpatialCategory(builder, definitionModelId, "Test Spatial Category");
        addPhysicalObject(builder, modelId, categoryId);

        const privateCategoryId = addSpatialCategory(builder, definitionModelId, "Private Test Spatial Category", true);
        addPhysicalObject(builder, modelId, privateCategoryId);
      });

      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(createRuleset({}));

      expect(hierarchy).to.matchSnapshot();
    });

    it("groups elements by class", async () => {
      // eslint-disable-next-line deprecation/deprecation
      const iModel: IModelConnection = await buildTestIModel("ModelsTree", async (builder) => {
        const partitionId = addPartition(builder, "BisCore:PhysicalPartition", "TestPhysicalModel");
        const modelId = addModel(builder, "BisCore:PhysicalModel", partitionId);
        const categoryId = addSpatialCategory(builder, IModel.dictionaryId, "Test Spatial Category");
        addPhysicalObject(builder, modelId, categoryId);
      });

      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(createRuleset({ enableElementsClassGrouping: true }));

      expect(hierarchy).to.matchSnapshot();
    });

    it("loads specified type of elements", async () => {
      // eslint-disable-next-line deprecation/deprecation
      const iModel: IModelConnection = await buildTestIModel("ModelsTree", async (builder) => {
        const partitionId = addPartition(builder, "BisCore:PhysicalPartition", "TestPhysicalModel");
        const modelId = addModel(builder, "BisCore:PhysicalModel", partitionId);
        const categoryId = addSpatialCategory(builder, IModel.dictionaryId, "Test Spatial Category");
        addPhysicalObject(builder, modelId, categoryId);
        addSpatialLocationElement(builder, modelId, categoryId);
      });

      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(
        createRuleset({
          elementClassSpecification: { schemaName: "BisCore", className: "SpatialLocationElement" },
        }),
      );

      expect(hierarchy).to.matchSnapshot();
    });

    describe("search", () => {
      const createSearchRuleset = modelsTreeUtils.createSearchRuleset;

      it("hides subjects with `Subject.Job.Bridge` json property", async function () {
        /*
        Create the following hierarchy:
        - Root subject                     // visible
          - Child subject X                // hidden - `Subject.Job.Bridge` json property
            - Model X (with elements)      // visible
        */
        // eslint-disable-next-line deprecation/deprecation
        const iModel: IModelConnection = await buildTestIModel(createIModelName(this), async (builder) => {
          const category = addSpatialCategory(builder, IModel.dictionaryId, "Test Spatial Category");
          const subjectX = addSubject(builder, "Subject X", IModel.rootSubjectId, { jsonProperties: { Subject: { Job: { Bridge: "Test" } } } });
          const modelX = addModel(builder, "BisCore:PhysicalModel", addPartition(builder, "BisCore:PhysicalPartition", "Model X", subjectX));
          addPhysicalObject(builder, modelX, category);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
        const hierarchy = await hierarchyBuilder.createHierarchy(createSearchRuleset({}));
        expect(hierarchy).to.matchSnapshot();
      });

      it('hides subjects with `Subject.Model.Type = "Hierarchy"` json property', async function () {
        /*
        Create the following hierarchy:
        - Root subject                     // visible
          - Child subject X                // hidden - `Subject.Model.Type = \"Hierarchy\"` json property
            - Model X (with elements)      // visible
        */
        // eslint-disable-next-line deprecation/deprecation
        const iModel: IModelConnection = await buildTestIModel(createIModelName(this), async (builder) => {
          const category = addSpatialCategory(builder, IModel.dictionaryId, "Test Spatial Category");
          const subjectX = addSubject(builder, "Subject X", IModel.rootSubjectId, { jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } } });
          const modelX = addModel(builder, "BisCore:PhysicalModel", addPartition(builder, "BisCore:PhysicalPartition", "Model X", subjectX));
          addPhysicalObject(builder, modelX, category);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
        const hierarchy = await hierarchyBuilder.createHierarchy(createSearchRuleset({}));
        expect(hierarchy).to.matchSnapshot();
      });

      it("hides subjects with childless models", async function () {
        /*
        Create the following hierarchy:
        - Root subject                     // visible
          - Child subject X                // hidden - no child nodes
            - Model X (no elements)        // hidden - no elements
        */
        // eslint-disable-next-line deprecation/deprecation
        const iModel: IModelConnection = await buildTestIModel(createIModelName(this), async (builder) => {
          const subjectX = addSubject(builder, "Subject X", IModel.rootSubjectId);
          addModel(builder, "BisCore:PhysicalModel", addPartition(builder, "BisCore:PhysicalPartition", "Model X", subjectX));
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
        const hierarchy = await hierarchyBuilder.createHierarchy(createSearchRuleset({}));
        expect(hierarchy).to.matchSnapshot();
      });

      it("shows subjects with child models", async function () {
        /*
        Create the following hierarchy:
        - Root subject                     // visible
          - Child subject X                // visible
            - Model X (with elements)      // visible
        */
        // eslint-disable-next-line deprecation/deprecation
        const iModel: IModelConnection = await buildTestIModel(createIModelName(this), async (builder) => {
          const category = addSpatialCategory(builder, IModel.dictionaryId, "Test Spatial Category");
          const subjectX = addSubject(builder, "Subject X", IModel.rootSubjectId);
          const modelX = addModel(builder, "BisCore:PhysicalModel", addPartition(builder, "BisCore:PhysicalPartition", "Model X", subjectX));
          addPhysicalObject(builder, modelX, category);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
        const hierarchy = await hierarchyBuilder.createHierarchy(createSearchRuleset({}));
        expect(hierarchy).to.matchSnapshot();
      });

      it("shows subjects with child models related with subject through `Subject.Model.TargetPartition` json property", async function () {
        /*
        Create the following hierarchy:
        - Root subject                     // visible
          - Child subject X                // visible
            - Model X                      // visible - related through json property
          - Model X                        // visible - related through direct relationship
        */
        // eslint-disable-next-line deprecation/deprecation
        const iModel: IModelConnection = await buildTestIModel(createIModelName(this), async (builder) => {
          const category = addSpatialCategory(builder, IModel.dictionaryId, "Test Spatial Category");
          const partitionX = addPartition(builder, "BisCore:PhysicalPartition", "Model X", IModel.rootSubjectId);
          const modelX = addModel(builder, "BisCore:PhysicalModel", partitionX);
          addPhysicalObject(builder, modelX, category);
          addSubject(builder, "Subject X", IModel.rootSubjectId, { jsonProperties: { Subject: { Model: { TargetPartition: partitionX } } } });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
        const hierarchy = await hierarchyBuilder.createHierarchy(createSearchRuleset({}));
        expect(hierarchy).to.matchSnapshot();
      });

      it("shows childless subjects with hidden child models that have `PhysicalPartition.Model.Content` json property", async function () {
        /*
        Create the following hierarchy:
        - Root subject                     // visible
          - Child subject X                // visible
            - Model X (with elements)      // hidden - `PhysicalPartition.Model.Content` json property
        */
        // eslint-disable-next-line deprecation/deprecation
        const iModel: IModelConnection = await buildTestIModel(createIModelName(this), async (builder) => {
          const category = addSpatialCategory(builder, IModel.dictionaryId, "Test Spatial Category");
          const subjectX = addSubject(builder, "Subject X", IModel.rootSubjectId);
          const modelX = addModel(
            builder,
            "BisCore:PhysicalModel",
            addPartition(builder, "BisCore:PhysicalPartition", "Model X", subjectX, { jsonProperties: { PhysicalPartition: { Model: { Content: true } } } }),
          );
          addPhysicalObject(builder, modelX, category);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
        const hierarchy = await hierarchyBuilder.createHierarchy(createSearchRuleset({}));
        expect(hierarchy).to.matchSnapshot();
      });

      it("shows childless subjects with hidden child models that have `GraphicalPartition3d.Model.Content` json property", async function () {
        /*
        Create the following hierarchy:
        - Root subject                     // visible
          - Child subject X                // visible
            - Model X (with elements)      // hidden - `PhysicalPartition.Model.Content` json property
        */
        // eslint-disable-next-line deprecation/deprecation
        const iModel: IModelConnection = await buildTestIModel(createIModelName(this), async (builder) => {
          const category = addSpatialCategory(builder, IModel.dictionaryId, "Test Spatial Category");
          const subjectX = addSubject(builder, "Subject X", IModel.rootSubjectId);
          const modelX = addModel(
            builder,
            "BisCore:PhysicalModel",
            addPartition(builder, "BisCore:PhysicalPartition", "Model X", subjectX, { jsonProperties: { PhysicalPartition: { Model: { Content: true } } } }),
          );
          addPhysicalObject(builder, modelX, category);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
        const hierarchy = await hierarchyBuilder.createHierarchy(createSearchRuleset({}));
        expect(hierarchy).to.matchSnapshot();
      });

      it("hides private models", async function () {
        /*
        Create the following hierarchy:
        - Root subject                  // visible
          - Model X                     // hidden - private
        */
        // eslint-disable-next-line deprecation/deprecation
        const iModel: IModelConnection = await buildTestIModel(createIModelName(this), async (builder) => {
          const category = addSpatialCategory(builder, IModel.dictionaryId, "Test Spatial Category");
          const subjectX = addSubject(builder, "Subject X", IModel.rootSubjectId);
          const modelX = addModel(builder, "BisCore:PhysicalModel", addPartition(builder, "BisCore:PhysicalPartition", "Model X", subjectX), {
            isPrivate: true,
          });
          addPhysicalObject(builder, modelX, category);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
        const hierarchy = await hierarchyBuilder.createHierarchy(createSearchRuleset({}));
        expect(hierarchy).to.matchSnapshot();
      });

      function createIModelName(m: Mocha.Context) {
        const MAX_FILENAME_LENGTH = 40;
        // eslint-disable-next-line @itwin/no-internal
        const name = createFileNameFromString(m.test!.fullTitle());
        if (name.length <= MAX_FILENAME_LENGTH) {
          return name;
        }
        const substringLength = Math.floor(MAX_FILENAME_LENGTH / 2);
        return `${name.slice(0, substringLength)}..${name.slice(name.length - substringLength)}`;
      }
    });
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { join } from "path";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { SelectionMode, TreeNodeItem } from "@itwin/components-react";
import { BeEvent } from "@itwin/core-bentley";
import {
  BisCodeSpec, CategoryProps, Code, ElementProps, IModel, ModelProps, PhysicalElementProps, RelatedElement, RelatedElementProps,
} from "@itwin/core-common";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { ECInstancesNodeKey, KeySet, LabelDefinition, Node, NodeKey, NodePathElement } from "@itwin/presentation-common";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import { Presentation, SelectionChangeEvent, SelectionManager } from "@itwin/presentation-frontend";
import {
  buildTestIModel, HierarchyBuilder, HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
  TestIModelBuilder,
} from "@itwin/presentation-testing";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ModelsTree, RULESET_MODELS, RULESET_MODELS_GROUPED_BY_CLASS } from "../../../components/trees/models-tree/ModelsTree";
import { ModelsTreeNodeType, ModelsVisibilityHandler } from "../../../components/trees/models-tree/ModelsVisibilityHandler";
import { VisibilityChangeListener } from "../../../components/trees/VisibilityTreeEventHandler";
import { deepEquals, mockPresentationManager, TestUtils } from "../../TestUtils";
import { createCategoryNode, createElementClassGroupingNode, createElementNode, createKey, createModelNode, createSubjectNode } from "../Common";

describe("ModelsTree", () => {

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

  afterEach(() => {
    sinon.restore();
  });

  describe("#unit", () => {
    const imodelMock = moq.Mock.ofType<IModelConnection>();
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
      setupDataProvider([
        createSubjectNode(),
        createModelNode(),
        createCategoryNode(),
        createElementNode(),
      ]);
    };

    describe("<ModelsTree />", () => {
      const visibilityChangeEvent = new BeEvent<VisibilityChangeListener>();
      const visibilityHandlerMock = moq.Mock.ofType<ModelsVisibilityHandler>();

      beforeEach(() => {
        visibilityChangeEvent.clear();
        visibilityHandlerMock.reset();
        visibilityHandlerMock.setup((x) => x.onVisibilityChange).returns(() => visibilityChangeEvent);
      });

      const isNodeChecked = (node: HTMLElement): boolean => {
        const cb = node.querySelector("input");
        return cb!.checked;
      };

      it("should match snapshot", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node"), isCheckboxVisible: true }]);
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden" }));
        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        await waitFor(() => result.getByText("test-node"), { container: result.container });
        expect(result.baseElement).to.matchSnapshot();
      });

      it("renders nodes as unchecked when they're not displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden" }));

        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        await waitFor(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.false);
      });

      it("renders nodes as checked when they're displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible" }));

        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        await waitFor(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.true);
      });

      it("re-renders nodes on `onVisibilityChange` event", async () => {
        const node = createModelNode();
        setupDataProvider([node]);

        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden", isDisabled: false })).verifiable(moq.Times.exactly(2));
        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        await waitFor(() => {
          const renderedNode = result.getByTestId("tree-node");
          if (isNodeChecked(renderedNode))
            throw new Error("expecting unchecked node");
          return renderedNode;
        });
        visibilityHandlerMock.verifyAll();

        visibilityHandlerMock.reset();
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false })).verifiable(moq.Times.exactly(2));
        visibilityChangeEvent.raiseEvent();
        await waitFor(() => {
          const renderedNode = result.getByTestId("tree-node");
          if (!isNodeChecked(renderedNode))
            throw new Error("expecting checked node");
          return renderedNode;
        });
        visibilityHandlerMock.verifyAll();
      });

      it("re-renders nodes without checkboxes if visibility handler does not exist", async () => {
        const node = createModelNode();
        setupDataProvider([node]);

        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "visible" }));
        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        const renderedNode = await result.findByTestId("tree-node");
        expect(renderedNode.querySelectorAll("input").length).to.eq(1);

        result.rerender(<ModelsTree {...sizeProps} iModel={imodelMock.object} />);
        const rerenderedNode = await result.findByTestId("tree-node");
        expect(rerenderedNode.querySelectorAll("input").length).to.eq(0);
      });

      it("calls visibility handler's `changeVisibility` on node checkbox state changes to 'checked'", async () => {
        const node = createModelNode();
        setupDataProvider([node]);
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden" }));
        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        await result.findByText("model");
        const renderedNode = result.getByTestId("tree-node");
        const cb = renderedNode.querySelector("input");
        fireEvent.click(cb!);

        visibilityHandlerMock.verify(async (x) => x.changeVisibility(node, true), moq.Times.once());
      });

      describe("selection", () => {
        it("adds node to unified selection", async () => {
          const element = createElementNode();
          setupDataProvider([element]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} />);
          await result.findByText("element");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals((element.key as ECInstancesNodeKey).instanceKeys), 0, ""), moq.Times.once());
        });

        it("adds element node to unified selection according to `selectionPredicate`", async () => {
          const element = createElementNode();
          setupDataProvider([element]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Element;

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findByText("element");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals((element.key as ECInstancesNodeKey).instanceKeys), 0, ""), moq.Times.once());
        });

        it("adds multiple model nodes to unified selection according to `selectionPredicate`", async () => {
          const node1 = createModelNode();
          const node2 = createModelNode();
          node2.id = "model2";
          setupDataProvider([node1, node2]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Model;

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findAllByText("model");

          const renderedNodes = result.queryAllByTestId("tree-node");
          expect(renderedNodes.length).to.be.eq(2);
          fireEvent.click(renderedNodes[0]);
          fireEvent.click(renderedNodes[1], { ctrlKey: true });

          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals((node1.key as ECInstancesNodeKey).instanceKeys), 0, ""), moq.Times.once());
          selectionManagerMock.verify((x) => x.addToSelection(moq.It.isAny(), imodelMock.object, deepEquals((node2.key as ECInstancesNodeKey).instanceKeys), 0, ""), moq.Times.once());
        });

        it("adds subject node to unified selection according to `selectionPredicate`", async () => {
          const subject = createSubjectNode();
          setupDataProvider([subject]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Subject;

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findByText("subject");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals((subject.key as ECInstancesNodeKey).instanceKeys), 0, ""), moq.Times.once());
        });

        it("adds node without extendedData to unified selection according to `selectionPredicate`", async () => {
          const node = createElementNode();
          (node as any).extendedData = undefined;
          setupDataProvider([node]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Unknown;

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findByText("element");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals((node.key as ECInstancesNodeKey).instanceKeys), 0, ""), moq.Times.once());
        });

        it("adds element class grouping node to unified selection according to `selectionPredicate`", async () => {
          const node = createElementClassGroupingNode(["0x1", "0x2"]);
          setupDataProvider([node]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => (type === ModelsTreeNodeType.Grouping);

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findByText("grouping");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals([node.key]), 0, ""), moq.Times.once());
        });

        it("does not add category node to unified selection according to `selectionPredicate`", async () => {
          const node = createCategoryNode();
          setupDataProvider([node]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Model;

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findByText("category");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        });

      });

      describe("filtering", () => {
        beforeEach(() => {
          const filteredNode: Node = {
            key: createKey("element", "filtered-element"),
            // TODO: remove this eslint rule when tree-widget uses itwinjs-core 4.0.0 version
            label: LabelDefinition.fromLabelString("filtered-node"), // eslint-disable-line @itwin/no-internal
          };
          const filter: NodePathElement[] = [{ node: filteredNode, children: [], index: 0 }];
          (PresentationTreeDataProvider.prototype.getFilteredNodePaths as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves(filter);

          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny())).returns(() => ({ state: "hidden" }));
        });

        it("filters nodes", async () => {
          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }} />);
          await result.findByText("filtered-node");
        });

        it("invokes onFilterApplied callback", async () => {
          const spy = sinon.spy();

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }} onFilterApplied={spy} />);
          await result.findByText("filtered-node");

          expect(spy).to.be.calledOnce;
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

    it("does not show private categories with RULESET_MODELS", async () => {
      const iModel: IModelConnection = await buildTestIModel("ModelsTreeModels", (builder) => {
        const partitionId = addPartition("BisCore:PhysicalPartition", builder, "TestPhysicalModel");
        const definitionPartitionId = addPartition("BisCore:DefinitionPartition", builder, "TestDefinitionModel");
        const modelId = addModel("BisCore:PhysicalModel", builder, partitionId);
        const definitionModelId = addModel("BisCore:DefinitionModel", builder, definitionPartitionId);

        const categoryId = addSpatialCategory(builder, definitionModelId, "Test Spatial Category");
        addPhysicalObject(builder, modelId, categoryId);

        const privateCategoryId = addSpatialCategory(builder, definitionModelId, "Private Test Spatial Category", true);
        addPhysicalObject(builder, modelId, privateCategoryId);
      });

      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_MODELS);

      expect(hierarchy).to.matchSnapshot();
    });

    it("does not show private categories with RULESET_MODELS_GROUPED_BY_CLASS", async () => {
      const iModel: IModelConnection = await buildTestIModel("ModelsTreeModelsGroupedByClass", (builder) => {
        const partitionId = addPartition("BisCore:PhysicalPartition", builder, "TestPhysicalModel");
        const definitionPartitionId = addPartition("BisCore:DefinitionPartition", builder, "TestDefinitionModel");
        const modelId = addModel("BisCore:PhysicalModel", builder, partitionId);
        const definitionModelId = addModel("BisCore:DefinitionModel", builder, definitionPartitionId);

        const categoryId = addSpatialCategory(builder, definitionModelId, "Test Spatial Category");
        addPhysicalObject(builder, modelId, categoryId);

        const privateCategoryId = addSpatialCategory(builder, definitionModelId, "Private Test Spatial Category", true);
        addPhysicalObject(builder, modelId, privateCategoryId);
      });

      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_MODELS_GROUPED_BY_CLASS);

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
        model: IModel.dictionaryId,
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
  });
});

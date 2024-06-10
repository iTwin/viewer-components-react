/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyFilterRuleOperator } from "@itwin/components-react";
import { EmptyLocalization, IModel } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { LabelDefinition } from "@itwin/presentation-common";
import { InfoTreeNodeItemType, PresentationTreeDataProvider } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import {
  buildTestIModel,
  HierarchyBuilder,
  HierarchyCacheMode,
  initialize as initializePresentationTesting,
  terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { IModelContentTree, RULESET_IMODEL_CONTENT } from "../../../components/trees/imodel-content-tree/IModelContentTree";
import {
  insertDrawingCategory,
  insertDrawingElement,
  insertDrawingGraphic,
  insertDrawingSubModel,
  insertGroupInformationElement,
  insertGroupInformationModelWithPartition,
  insertModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubject,
  insertSubModel,
} from "../../IModelUtils";
import { createAsyncIterator, mockPresentationManager, render, TestUtils, waitFor } from "../../TestUtils";
import {
  createInfoNode,
  createPresentationTreeNodeItem,
  createSimpleTreeModelNode,
  createTestContentDescriptor,
  createTestPropertiesContentField,
  createTestPropertyInfo,
} from "../Common";

import type { TreeNodeItem } from "@itwin/components-react";
import type { PresentationInstanceFilterInfo } from "@itwin/presentation-components";
import type { PresentationManager } from "@itwin/presentation-frontend";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Node, NodeKey } from "@itwin/presentation-common";

describe("IModelContentTree", () => {
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
    let presentationManagerMock: moq.IMock<PresentationManager>;

    beforeEach(() => {
      imodelMock.reset();
      const mocks = mockPresentationManager();
      presentationManagerMock = mocks.presentationManager;
      sinon.stub(Presentation, "presentation").get(() => presentationManagerMock.object);
      sinon.stub(Presentation, "localization").get(() => new EmptyLocalization());
    });

    afterEach(() => {
      sinon.restore();
    });

    describe("<IModelContentTree />", () => {
      let nodeKeysCounter = 0;
      const createInvalidNodeKey = (): NodeKey => {
        return { type: "invalid", version: 0, pathFromRoot: [`${++nodeKeysCounter}`] };
      };

      const setupDataProvider = (nodes: TreeNodeItem[]) => {
        (PresentationTreeDataProvider.prototype.getNodesCount as any).restore && (PresentationTreeDataProvider.prototype.getNodesCount as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(nodes.length);

        (PresentationTreeDataProvider.prototype.getNodes as any).restore && (PresentationTreeDataProvider.prototype.getNodes as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").resolves(nodes);
      };

      function setupHierarchy(nodes: Node[]) {
        presentationManagerMock
          .setup(async (x) => x.getNodesIterator(moq.It.isAny()))
          .returns(async () => ({ total: nodes.length, items: createAsyncIterator(nodes) }));
      }

      it("should render hierarchy", async () => {
        setupHierarchy([{ key: createInvalidNodeKey(), label: LabelDefinition.fromLabelString("test-node") }]);
        const result = render(<IModelContentTree {...sizeProps} iModel={imodelMock.object} />);
        const node = await waitFor(() => result.getByText("test-node"));
        const tree = result.getByRole("tree");
        const item = result.getByRole("treeitem");
        expect(tree.contains(item)).to.be.true;
        expect(item.contains(node)).to.be.true;
      });

      it("renders context menu", async () => {
        setupHierarchy([{ key: createInvalidNodeKey(), label: LabelDefinition.fromLabelString("test-node") }]);
        const { user, getByText, queryByText } = render(
          <IModelContentTree {...sizeProps} iModel={imodelMock.object} contextMenuItems={[() => <div>Test Menu Item</div>]} />,
        );
        const node = await waitFor(() => getByText("test-node"));
        await user.pointer({ keys: "[MouseRight>]", target: node });

        await waitFor(() => expect(queryByText("Test Menu Item")).to.not.be.null);
      });

      it("renders enlarged tree node", async () => {
        setupDataProvider([createSimpleTreeModelNode()]);

        const { getByText, container } = render(
          <IModelContentTree {...sizeProps} density={"enlarged"} iModel={imodelMock.object} hierarchyLevelConfig={{ isFilteringEnabled: true }} />,
        );

        await waitFor(() => getByText("Node Label"));

        const node = container.querySelector(".node-wrapper") as HTMLDivElement;
        expect(node.style.height).to.be.equal("43px");
      });

      it("reports on interaction", async () => {
        const onFeaturedUsedSpy = sinon.spy();
        setupDataProvider([createPresentationTreeNodeItem({ hasChildren: true })]);

        const { user, getByText, getByTestId } = render(
          <IModelContentTree
            {...sizeProps}
            density={"enlarged"}
            iModel={imodelMock.object}
            hierarchyLevelConfig={{ isFilteringEnabled: true }}
            onFeatureUsed={onFeaturedUsedSpy}
          />,
        );

        await waitFor(() => getByText("Node Label"));
        const expandButton = getByTestId("tree-node-expansion-toggle");
        await user.click(expandButton);

        await waitFor(() => expect(onFeaturedUsedSpy).to.be.calledWith("use-imodel-content-tree"));
      });

      describe("hierarchy level filtering", () => {
        beforeEach(() => {
          const localization = new EmptyLocalization();
          imodelMock.reset();
          sinon.stub(Presentation, "localization").get(() => localization);
          sinon.stub(PresentationTreeDataProvider.prototype, "imodel").get(() => imodelMock.object);
          sinon.stub(PresentationTreeDataProvider.prototype, "rulesetId").get(() => "");
          sinon.stub(PresentationTreeDataProvider.prototype, "dispose");
          sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves([]);
          sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(0);
          sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").resolves([]);
        });

        it("renders non-filterable node", async () => {
          setupDataProvider([createSimpleTreeModelNode()]);

          const { queryByTitle, getByText } = render(
            <IModelContentTree {...sizeProps} iModel={imodelMock.object} hierarchyLevelConfig={{ isFilteringEnabled: true }} />,
          );

          await waitFor(() => getByText("Node Label"));
          expect(queryByTitle("tree.filter-hierarchy-level")).to.be.null;
        });

        it("renders information message when node item is of `ResultSetTooLarge` type", async () => {
          const nodeItem = createInfoNode(undefined, "filtering message", InfoTreeNodeItemType.ResultSetTooLarge);
          setupDataProvider([nodeItem]);

          const { queryByText } = render(
            <IModelContentTree {...sizeProps} iModel={imodelMock.object} hierarchyLevelConfig={{ isFilteringEnabled: true, sizeLimit: 0 }} />,
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

          const { queryByTitle } = render(<IModelContentTree {...sizeProps} iModel={imodelMock.object} hierarchyLevelConfig={{ isFilteringEnabled: true }} />);

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

          const { queryByTitle } = render(<IModelContentTree {...sizeProps} iModel={imodelMock.object} hierarchyLevelConfig={{ isFilteringEnabled: true }} />);

          await waitFor(() => expect(queryByTitle("tree.clear-hierarchy-level-filter")).to.not.be.null);
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
            <IModelContentTree
              {...sizeProps}
              iModel={imodelMock.object}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
              onPerformanceMeasured={onPerformanceMeasuredSpy}
            />,
          );

          await waitFor(() => getByText("Node Label"));
          expect(onPerformanceMeasuredSpy.callCount).to.be.eq(1);
          expect(onPerformanceMeasuredSpy.getCall(0).calledWith("imodel-content-tree-initial-load")).to.be.true;
        });

        it("reports initial load performance metric on iModel change", async () => {
          setupDataProvider([createSimpleTreeModelNode()]);

          const { getByText, rerender } = render(
            <IModelContentTree
              {...sizeProps}
              iModel={imodelMock.object}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
              onPerformanceMeasured={onPerformanceMeasuredSpy}
            />,
          );

          await waitFor(() => getByText("Node Label"));

          rerender(
            <IModelContentTree
              {...sizeProps}
              iModel={imodelMock2.object}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
              onPerformanceMeasured={onPerformanceMeasuredSpy}
            />,
          );

          await waitFor(() => getByText("Node Label"));
          expect(onPerformanceMeasuredSpy.callCount).to.be.eq(2);
          expect(onPerformanceMeasuredSpy.getCall(0).calledWith("imodel-content-tree-initial-load")).to.be.true;
          expect(onPerformanceMeasuredSpy.getCall(1).calledWith("imodel-content-tree-initial-load")).to.be.true;
        });

        it("reports hierarchy load performance metric", async () => {
          const nodeItem = createPresentationTreeNodeItem({ hasChildren: true });
          setupDataProvider([nodeItem]);

          const { user, getByText, getByTestId } = render(
            <IModelContentTree
              {...sizeProps}
              iModel={imodelMock.object}
              hierarchyLevelConfig={{ isFilteringEnabled: true }}
              onPerformanceMeasured={onPerformanceMeasuredSpy}
            />,
          );

          await waitFor(() => getByText("Node Label"));
          const expandButton = getByTestId("tree-node-expansion-toggle");
          await user.click(expandButton);

          expect(onPerformanceMeasuredSpy.callCount).to.be.eq(2);
          expect(onPerformanceMeasuredSpy.getCall(0).calledWith("imodel-content-tree-initial-load")).to.be.true;
          expect(onPerformanceMeasuredSpy.getCall(1).calledWith("imodel-content-tree-hierarchy-level-load")).to.be.true;
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

    describe("subjects' children", () => {
      it("creates subjects hierarchy", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          insertSubject({ builder, codeValue: "A", parentId: IModel.rootSubjectId });
          const b = insertSubject({ builder, codeValue: "B", parentId: IModel.rootSubjectId });
          insertSubject({ builder, codeValue: "C", parentId: b.id });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates 3d model nodes child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          insertPhysicalModelWithPartition({ builder, codeValue: "test partition", partitionParentId: IModel.rootSubjectId });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });
    });

    describe("models' children", () => {
      it("creates drawing category child nodes for 2d models", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const documentModel = insertModelWithPartition({
            builder,
            modelClassFullName: "BisCore:DocumentListModel",
            partitionClassFullName: "BisCore:DocumentPartition",
            partitionParentId: IModel.rootSubjectId,
            codeValue: "test partition",
          });
          const modeledElement = insertDrawingElement({ builder, modelId: documentModel.id, codeValue: "test document" });
          const drawingModel = insertDrawingSubModel({
            builder,
            modeledElementId: modeledElement.id,
          });
          const drawingCategory = insertDrawingCategory({ builder, modelId: IModel.dictionaryId, codeValue: "drawing category" });
          insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: drawingCategory.id });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates spatial category child nodes for 3d models", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "test partition" });
          const category = insertSpatialCategory({ builder, codeValue: "test category" });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates element child nodes for non-graphical models", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const model = insertModelWithPartition({
            builder,
            partitionClassFullName: "BisCore:DocumentPartition",
            modelClassFullName: "BisCore:DocumentListModel",
            codeValue: "test partition",
          });
          insertDrawingElement({ builder, modelId: model.id, codeValue: "test document" });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });
    });

    describe("groups' children", () => {
      it("creates childless node when group has no child or grouped elements", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const model = insertGroupInformationModelWithPartition({ builder, codeValue: "test partition" });
          insertGroupInformationElement({ builder, modelId: model.id, codeValue: "test group" });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates child elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const model = insertGroupInformationModelWithPartition({ builder, codeValue: "test partition" });
          const parentGroup = insertGroupInformationElement({ builder, modelId: model.id, codeValue: "parent group" });
          insertGroupInformationElement({ builder, modelId: model.id, parentId: parentGroup.id, codeValue: "child group" });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates grouped elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const groupModel = insertGroupInformationModelWithPartition({ builder, codeValue: "group partition" });
          const group = insertGroupInformationElement({ builder, modelId: groupModel.id, codeValue: "group" });
          const documentModel = insertModelWithPartition({
            builder,
            modelClassFullName: "BisCore:DocumentListModel",
            partitionClassFullName: "BisCore:DocumentPartition",
            codeValue: "document partition",
          });
          const document = insertDrawingElement({ builder, modelId: documentModel.id, codeValue: "test document" });
          builder.insertRelationship({
            classFullName: "BisCore:ElementGroupsMembers",
            sourceId: group.id,
            targetId: document.id,
          });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });
    });

    describe("elements' children", () => {
      it("creates childless node when element has no child or modeling elements", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "test partition" });
          const category = insertSpatialCategory({ builder, codeValue: "test category" });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates child elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "test partition" });
          const category = insertSpatialCategory({ builder, codeValue: "test category" });
          const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates modeling elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const documentModel = insertModelWithPartition({
            builder,
            modelClassFullName: "BisCore:DocumentListModel",
            partitionClassFullName: "BisCore:DocumentPartition",
            codeValue: "test partition",
          });
          const parentDocument = insertDrawingElement({ builder, modelId: documentModel.id, codeValue: "parent document" });
          const childModel = insertSubModel({ builder, classFullName: "BisCore:DocumentListModel", modeledElementId: parentDocument.id });
          insertDrawingElement({ builder, modelId: childModel.id, codeValue: "child document" });
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });
    });
  });
});

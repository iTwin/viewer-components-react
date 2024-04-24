/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyFilterRuleOperator } from "@itwin/components-react";
import { BisCodeSpec, EmptyLocalization, IModel } from "@itwin/core-common";
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
import { IModelContentTree, RULESET_IMODEL_CONTENT } from "../../../tree-widget-react";
import {
  addDocument,
  addDrawingCategory,
  addDrawingGraphic,
  addGroup,
  addModel,
  addPartition,
  addPhysicalObject,
  addSpatialCategory,
  addSubject,
} from "../../IModelUtils";
import { mockPresentationManager, render, TestUtils, waitFor } from "../../TestUtils";
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

      async function* createAsyncIterator<T>(values: T[]): AsyncIterableIterator<T> {
        for (const value of values) {
          yield value;
        }
      }

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

        await waitFor(() => expect(onFeaturedUsedSpy).to.be.calledOnceWith("use-imodel-content-tree"));
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
          addSubject(builder, "A", IModel.rootSubjectId);
          const b = addSubject(builder, "B", IModel.rootSubjectId);
          addSubject(builder, "C", b);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates 3d model nodes child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const partitionId = addPartition(builder, "BisCore:PhysicalPartition", "test partition", IModel.rootSubjectId);
          addModel(builder, "BisCore:PhysicalModel", partitionId);
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
          const documentModelId = addModel(
            builder,
            "BisCore:DocumentListModel",
            addPartition(builder, "BisCore:DocumentPartition", "test partition", IModel.rootSubjectId),
          );
          const modeledElementId = addDocument(builder, documentModelId, builder.createCode(documentModelId, BisCodeSpec.nullCodeSpec, "test document"));
          const drawingModelId = addModel(builder, "BisCore:DrawingModel", modeledElementId);
          const drawingCategoryId = addDrawingCategory(builder, IModel.dictionaryId, "drawing category");
          addDrawingGraphic(builder, drawingModelId, drawingCategoryId);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates spatial category child nodes for 3d models", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const partitionId = addPartition(builder, "BisCore:PhysicalPartition", "test partition", IModel.rootSubjectId);
          const modelId = addModel(builder, "BisCore:PhysicalModel", partitionId);
          const categoryId = addSpatialCategory(builder, IModel.dictionaryId, "test category");
          addPhysicalObject(builder, modelId, categoryId);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates element child nodes for non-graphical models", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const partitionId = addPartition(builder, "BisCore:DocumentPartition", "test partition", IModel.rootSubjectId);
          const modelId = addModel(builder, "BisCore:DocumentListModel", partitionId);
          addDocument(builder, modelId, builder.createCode(partitionId, BisCodeSpec.nullCodeSpec, "test document"));
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
          const partitionId = addPartition(builder, "BisCore:GroupInformationPartition", "test partition", IModel.rootSubjectId);
          const modelId = addModel(builder, "Generic:GroupModel", partitionId);
          addGroup(builder, modelId, builder.createCode(partitionId, BisCodeSpec.nullCodeSpec, "test group"));
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates child elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const partitionId = addPartition(builder, "BisCore:GroupInformationPartition", "test partition", IModel.rootSubjectId);
          const modelId = addModel(builder, "Generic:GroupModel", partitionId);
          const parentGroupId = addGroup(builder, modelId, builder.createCode(partitionId, BisCodeSpec.nullCodeSpec, "parent group"));
          addGroup(builder, modelId, builder.createCode(parentGroupId, BisCodeSpec.nullCodeSpec, "child group"), parentGroupId);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates grouped elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const groupPartitionId = addPartition(builder, "BisCore:GroupInformationPartition", "group partition", IModel.rootSubjectId);
          const groupModelId = addModel(builder, "Generic:GroupModel", groupPartitionId);
          const groupId = addGroup(builder, groupModelId, builder.createCode(groupPartitionId, BisCodeSpec.nullCodeSpec, "group"));

          const documentPartitionId = addPartition(builder, "BisCore:DocumentPartition", "document partition", IModel.rootSubjectId);
          const documentModelId = addModel(builder, "BisCore:DocumentListModel", documentPartitionId);
          const documentId = addDocument(builder, documentModelId, builder.createCode(documentPartitionId, BisCodeSpec.nullCodeSpec, "test document"));

          builder.insertRelationship({
            classFullName: "BisCore:ElementGroupsMembers",
            sourceId: groupId,
            targetId: documentId,
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
          const partitionId = addPartition(builder, "BisCore:PhysicalPartition", "test partition", IModel.rootSubjectId);
          const modelId = addModel(builder, "BisCore:PhysicalModel", partitionId);
          const categoryId = addSpatialCategory(builder, IModel.dictionaryId, "test category");
          addPhysicalObject(builder, modelId, categoryId);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates child elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const partitionId = addPartition(builder, "BisCore:PhysicalPartition", "test partition", IModel.rootSubjectId);
          const modelId = addModel(builder, "BisCore:PhysicalModel", partitionId);
          const categoryId = addSpatialCategory(builder, IModel.dictionaryId, "test category");
          const parentElementId = addPhysicalObject(builder, modelId, categoryId);
          addPhysicalObject(builder, modelId, categoryId, undefined, parentElementId);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates modeling elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const imodel = await buildTestIModel(this, async (builder) => {
          const partitionId = addPartition(builder, "BisCore:DocumentPartition", "test partition", IModel.rootSubjectId);
          const modelId = addModel(builder, "BisCore:DocumentListModel", partitionId);
          const parentElementId = addDocument(builder, modelId, builder.createCode(partitionId, BisCodeSpec.nullCodeSpec, "parent document"));
          const childModelId = addModel(builder, "BisCore:DocumentListModel", parentElementId);
          addDocument(builder, childModelId, builder.createCode(parentElementId, BisCodeSpec.nullCodeSpec, "child document"));
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });
    });
  });
});

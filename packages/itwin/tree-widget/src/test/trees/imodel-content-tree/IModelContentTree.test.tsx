/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BisCodeSpec, IModel } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import {
  buildTestIModel, HierarchyBuilder, HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { render, waitFor } from "@testing-library/react";
import { IModelContentTree, RULESET_IMODEL_CONTENT } from "../../../tree-widget-react";
import {
  addDocument, addDrawingCategory, addDrawingGraphic, addGroup, addModel, addPartition, addPhysicalObject, addSpatialCategory, addSubject,
} from "../../IModelUtils";
import { mockPresentationManager, TestUtils } from "../../TestUtils";

import type { TreeNodeItem } from "@itwin/components-react";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection} from "@itwin/core-frontend";
import type { ECInstancesNodeKey} from "@itwin/presentation-common";

describe("IModelContentTree", () => {

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

    beforeEach(() => {
      imodelMock.reset();
      const mocks = mockPresentationManager();
      sinon.stub(Presentation, "presentation").get(() => mocks.presentationManager.object);
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

    describe("<IModelContentTree />", () => {
      beforeEach(() => {
        sinon.stub(PresentationTreeDataProvider.prototype, "imodel").get(() => imodelMock.object);
        sinon.stub(PresentationTreeDataProvider.prototype, "rulesetId").get(() => "");
        sinon.stub(PresentationTreeDataProvider.prototype, "dispose");
        sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves([]);
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodeKey").callsFake((node: any) => node.__key);
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(0);
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").resolves([]);
      });

      const setupDataProvider = (nodes: TreeNodeItem[]) => {
        (PresentationTreeDataProvider.prototype.getNodesCount as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(nodes.length);

        (PresentationTreeDataProvider.prototype.getNodes as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").callsFake(
          async () => nodes.map((n) => ({ __key: createKey(n.id), ...n })),
        );
      };

      it("should have expected structure", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        const result = render(
          <IModelContentTree
            {...sizeProps}
            iModel={imodelMock.object}
          />,
        );
        const node = await waitFor(() => result.getByText("test-node"));
        const tree = result.getByRole("tree");
        const item = result.getByRole("treeitem");
        expect(tree.contains(item)).to.be.true;
        expect(item.contains(node)).to.be.true;
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

    describe("subjects' children", () => {
      it("creates subjects hierarchy", async function () {
        const imodel = await buildTestIModel(this, (builder) => {
          addSubject(builder, "A", IModel.rootSubjectId);
          const b = addSubject(builder, "B", IModel.rootSubjectId);
          addSubject(builder, "C", b);
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates 3d model nodes child nodes", async function () {
        const imodel = await buildTestIModel(this, (builder) => {
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
        const imodel = await buildTestIModel(this, (builder) => {
          const documentModelId = addModel(builder, "BisCore:DocumentListModel", addPartition(builder, "BisCore:DocumentPartition", "test partition", IModel.rootSubjectId));
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
        const imodel = await buildTestIModel(this, (builder) => {
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
        const imodel = await buildTestIModel(this, (builder) => {
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
        const imodel = await buildTestIModel(this, (builder) => {
          const partitionId = addPartition(builder, "BisCore:GroupInformationPartition", "test partition", IModel.rootSubjectId);
          const modelId = addModel(builder, "Generic:GroupModel", partitionId);
          addGroup(builder, modelId, builder.createCode(partitionId, BisCodeSpec.nullCodeSpec, "test group"));
        });
        const hierarchyBuilder = new HierarchyBuilder({ imodel });
        const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_IMODEL_CONTENT);
        expect(hierarchy).to.matchSnapshot();
      });

      it("creates child elements as child nodes", async function () {
        const imodel = await buildTestIModel(this, (builder) => {
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
        const imodel = await buildTestIModel(this, (builder) => {
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
        const imodel = await buildTestIModel(this, (builder) => {
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
        const imodel = await buildTestIModel(this, (builder) => {
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
        const imodel = await buildTestIModel(this, (builder) => {
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

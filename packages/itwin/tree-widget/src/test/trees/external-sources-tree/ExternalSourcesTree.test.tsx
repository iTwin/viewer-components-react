/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { join } from "path";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { Guid } from "@itwin/core-bentley";
import { BisCodeSpec, IModel } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { KeySet, LabelDefinition } from "@itwin/presentation-common";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";
import {
  buildTestIModel, HierarchyBuilder, HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { render, waitFor } from "@testing-library/react";
import { ExternalSourcesTree, RULESET_EXTERNAL_SOURCES } from "../../../components/trees/external-sources-tree/ExternalSourcesTree";
import { mockPresentationManager, renderWithUser, TestUtils } from "../../TestUtils";

import type { Id64String } from "@itwin/core-bentley";
import type { ElementProps } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Node, NodeKey } from "@itwin/presentation-common";
import type { PresentationManager, SelectionManager } from "@itwin/presentation-frontend";
import type { TestIModelBuilder } from "@itwin/presentation-testing";

describe("ExternalSourcesTree", () => {

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
    let presentationManagerMock: moq.IMock<PresentationManager>;

    beforeEach(() => {
      imodelMock.reset();
      selectionManagerMock.reset();

      const selectionChangeEvent = new SelectionChangeEvent();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());

      const mocks = mockPresentationManager();
      presentationManagerMock = mocks.presentationManager;
      sinon.stub(Presentation, "presentation").get(() => presentationManagerMock.object);
      sinon.stub(Presentation, "selection").get(() => selectionManagerMock.object);
    });

    afterEach(() => {
      sinon.restore();
    });

    let nodeKeysCounter = 0;
    const createInvalidNodeKey = (): NodeKey => {
      return { type: "invalid", version: 0, pathFromRoot: [`${++nodeKeysCounter}`] };
    };

    describe("<ExternalSourcesTree />", () => {

      function setupHierarchy(nodes: Node[]) {
        presentationManagerMock.setup(async (x) => x.getNodesAndCount(moq.It.isAny())).returns(async () => ({
          count: nodes.length,
          nodes,
        }));
      }

      it("should render hierarchy", async () => {
        setupHierarchy([{
          key: createInvalidNodeKey(),
          label: LabelDefinition.fromLabelString("test-node-no-icon"), // eslint-disable-line @itwin/no-internal
        }, {
          key: createInvalidNodeKey(),
          label: LabelDefinition.fromLabelString("test-node-with-icon"), // eslint-disable-line @itwin/no-internal
          extendedData: {
            imageId: "test-icon-id",
          },
        }]);
        const { getByRole, getAllByRole, getByText } = render(
          <ExternalSourcesTree {...sizeProps} iModel={imodelMock.object} />,
        );
        await waitFor(() => getByText("test-node-no-icon"));
        getByRole("tree");
        const treeItems = getAllByRole("treeitem");
        expect(treeItems).to.have.lengthOf(2);
        expect(treeItems[0]).to.satisfy((item: HTMLElement) => item.querySelector(`span[title="test-node-no-icon"]`))
          .and.to.satisfy((item: HTMLElement) => !item.querySelector(`span.bui-webfont-icon`));
        expect(treeItems[1]).to.satisfy((item: HTMLElement) => item.querySelector(`span[title="test-node-with-icon"]`))
          .and.to.satisfy((item: HTMLElement) => item.querySelector(`span.bui-webfont-icon.test-icon-id`));
      });

      it("renders context menu", async () => {
        setupHierarchy([{
          key: createInvalidNodeKey(),
          label: LabelDefinition.fromLabelString("test-node"), // eslint-disable-line @itwin/no-internal
        }]);
        const { user, getByText, queryByText } = renderWithUser(
          <ExternalSourcesTree
            {...sizeProps}
            iModel={imodelMock.object}
            contextMenuItems={[
              () => <div>Test Menu Item</div>,
            ]}
          />,
        );
        const node = await waitFor(() => getByText("test-node"));
        await user.pointer({ keys: "[MouseRight>]", target: node });

        await waitFor(() => expect(queryByText("Test Menu Item")).to.not.be.null);
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

    it("creates auto-expanded root nodes with correct icons", async function () {
      const iModel: IModelConnection = await buildTestIModel(this, (builder) => {
        addRootExternalSource(builder, "Test external source");
      });
      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_EXTERNAL_SOURCES);
      expect(hierarchy).to.have.lengthOf(1).and.to.containSubset([{
        label: { value: { displayValue: "Root repo link - Test external source" } },
        autoExpand: true,
        extendedData: {
          // note: would be better to test this through `TreeNodeItem.icon`, but `HierarchyBuilder` doesn't
          // allow us to pass the node customization function used by the external sources tree
          imageId: "icon-document",
        },
      }]);
    });

    it("creates external sources as external source group node children", async function () {
      const iModel: IModelConnection = await buildTestIModel(this, (builder) => {
        const { externalSourceId: rootSourceId } = addRootExternalSource(builder, "Root external source");
        const groupId = addExternalSourceGroup(builder, "External source group");
        addExternalSourceAttachment(builder, rootSourceId, groupId);
        const childId = addExternalSource(builder, "Child external source");
        groupExternalSources(builder, groupId, [childId]);
      });
      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_EXTERNAL_SOURCES);
      expect(hierarchy).to.have.lengthOf(1).and.to.containSubset([{
        label: { value: { displayValue: "Root repo link - Root external source" } },
        extendedData: {
          imageId: "icon-document",
        },
        children: [{
          label: { value: { displayValue: "External source group" } },
          extendedData: {
            imageId: "icon-document",
          },
          children: [{
            label: { value: { displayValue: "Child external source" } },
            extendedData: {
              imageId: "icon-document",
            },
          }],
        }],
      }]);
    });

    it("creates attached external sources as external source node children", async function () {
      const iModel: IModelConnection = await buildTestIModel(this, (builder) => {
        const { externalSourceId: rootSourceId } = addRootExternalSource(builder, "Root external source");
        const childSourceId = addExternalSource(builder, "Child external source");
        addExternalSourceAttachment(builder, rootSourceId, childSourceId);
      });
      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_EXTERNAL_SOURCES);
      expect(hierarchy).to.have.lengthOf(1).and.to.containSubset([{
        label: { value: { displayValue: "Root repo link - Root external source" } },
        extendedData: {
          imageId: "icon-document",
        },
        children: [{
          label: { value: { displayValue: "Child external source" } },
          extendedData: {
            imageId: "icon-document",
          },
        }],
      }]);
    });

    it("creates elements as external source node children", async function () {
      const iModel: IModelConnection = await buildTestIModel(this, (builder) => {
        const { externalSourceId } = addRootExternalSource(builder, "Root external source");
        const modelId = addPhysicalModel(builder, "Model", IModel.rootSubjectId);
        const categoryId = addSpatialCategory(builder, "Category");
        addPhysicalObject(builder, "Element 1", modelId, categoryId, externalSourceId);
        addPhysicalObject(builder, "Element 2", modelId, categoryId, externalSourceId);
      });
      const hierarchyBuilder = new HierarchyBuilder({ imodel: iModel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_EXTERNAL_SOURCES);
      expect(hierarchy).to.have.lengthOf(1).and.to.containSubset([{
        label: { value: { displayValue: "Root repo link - Root external source" } },
        extendedData: {
          imageId: "icon-document",
        },
        children: [{
          label: { value: { displayValue: "Elements" } },
          extendedData: {
            imageId: "icon-ec-schema",
          },
          children: [{
            label: { value: { displayValue: "Physical Object" } },
            extendedData: {
              imageId: "icon-ec-class",
            },
            children: [{
              label: { value: { displayValue: "Code:Element 1" } },
              extendedData: {
                imageId: "icon-item",
              },
            }, {
              label: { value: { displayValue: "Code:Element 2" } },
              extendedData: {
                imageId: "icon-item",
              },
            }],
          }],
        }],
      }]);
    });

    function addSynchronizationConfigLink(builder: TestIModelBuilder, label: string) {
      const props: ElementProps = {
        classFullName: "BisCore:SynchronizationConfigLink",
        model: IModel.repositoryModelId,
        code: builder.createCode(IModel.repositoryModelId, BisCodeSpec.linkElement, `Code:${label}`),
      };
      return builder.insertElement(props);
    }

    function addRepositoryLink(builder: TestIModelBuilder, label: string) {
      const repositoryLinkProps: ElementProps = {
        classFullName: "BisCore:RepositoryLink",
        model: IModel.repositoryModelId,
        code: builder.createCode(IModel.repositoryModelId, BisCodeSpec.linkElement, `Code:${label}`),
        userLabel: label,
      };
      return builder.insertElement(repositoryLinkProps);
    }

    function addExternalSourceGroup(builder: TestIModelBuilder, label: string, repositoryLinkId?: Id64String) {
      const externalSourceProps: ElementProps = {
        classFullName: "BisCore:ExternalSourceGroup",
        model: IModel.repositoryModelId,
        code: builder.createCode(IModel.repositoryModelId, BisCodeSpec.nullCodeSpec, `Code:${label}`),
        userLabel: label,
        ...(repositoryLinkId ? { repository: { id: repositoryLinkId } } : undefined),
      };
      return builder.insertElement(externalSourceProps);
    }

    function addExternalSource(builder: TestIModelBuilder, label: string, repositoryLinkId?: Id64String) {
      const externalSourceProps: ElementProps = {
        classFullName: "BisCore:ExternalSource",
        model: IModel.repositoryModelId,
        code: builder.createCode(IModel.repositoryModelId, BisCodeSpec.nullCodeSpec, `Code:${label}`),
        userLabel: label,
        ...(repositoryLinkId ? { repository: { id: repositoryLinkId } } : undefined),
      };
      return builder.insertElement(externalSourceProps);
    }

    function addRootExternalSource(builder: TestIModelBuilder, label: string) {
      const configLinkId = addSynchronizationConfigLink(builder, "Root config link");
      const repoLinkId = addRepositoryLink(builder, "Root repo link");
      const externalSourceId = addExternalSource(builder, label, repoLinkId);
      builder.insertRelationship({
        classFullName: "BisCore:SynchronizationConfigSpecifiesRootSources",
        sourceId: configLinkId,
        targetId: externalSourceId,
      });
      return { configLinkId, repoLinkId, externalSourceId };
    }

    function addExternalSourceAttachment(builder: TestIModelBuilder, parentExternalSourceId: Id64String, attachedExternalSourceId: Id64String) {
      return builder.insertElement({
        classFullName: "BisCore:ExternalSourceAttachment",
        model: IModel.repositoryModelId,
        code: builder.createCode(IModel.repositoryModelId, BisCodeSpec.nullCodeSpec, `Code:${Guid.createValue()}`),
        parent: {
          relClassName: "BisCore:ExternalSourceOwnsAttachments",
          id: parentExternalSourceId,
        },
        attaches: {
          relClassName: "BisCore:ExternalSourceAttachmentAttachesSource",
          id: attachedExternalSourceId,
        },
      });
    }

    function groupExternalSources(builder: TestIModelBuilder, groupId: Id64String, groupedExternalSourceIds: Id64String[]) {
      groupedExternalSourceIds.forEach((groupedExternalSourceId) => {
        builder.insertRelationship({
          classFullName: "BisCore:ExternalSourceGroupGroupsSources",
          sourceId: groupId,
          targetId: groupedExternalSourceId,
        });
      });
    }

    function addPhysicalModel(builder: TestIModelBuilder, label: string, subjectId: Id64String) {
      const partitionId = builder.insertElement({
        classFullName: "BisCore:PhysicalPartition",
        model: IModel.repositoryModelId,
        parent: {
          relClassName: "BisCore:SubjectOwnsPartitionElements",
          id: subjectId,
        },
        code: builder.createCode(subjectId, BisCodeSpec.informationPartitionElement, `Code:${label}`),
      });
      return builder.insertModel({
        classFullName: "BisCore:PhysicalModel",
        modeledElement: { id: partitionId },
      });
    }

    function addSpatialCategory(builder: TestIModelBuilder, label: string, modelId?: string) {
      if (!modelId) {
        modelId = builder.insertModel({
          classFullName: "BisCore:DefinitionModel",
          modeledElement: {
            id: builder.insertElement({
              classFullName: "BisCore:DefinitionPartition",
              model: IModel.repositoryModelId,
              parent: {
                relClassName: "BisCore:SubjectOwnsPartitionElements",
                id: IModel.rootSubjectId,
              },
              code: builder.createCode(IModel.rootSubjectId, BisCodeSpec.informationPartitionElement, `Code:RootDefinitionModel`),
            }),
          },
        });
      }
      return builder.insertElement({
        classFullName: "BisCore:SpatialCategory",
        model: modelId,
        code: builder.createCode(modelId, BisCodeSpec.spatialCategory, `Code:${label}`),
      });
    }

    function addPhysicalObject(builder: TestIModelBuilder, label: string, modelId: string, categoryId: string, externalSourceId?: Id64String) {
      const elementId = builder.insertElement({
        classFullName: "Generic:PhysicalObject",
        model: modelId,
        category: categoryId,
        code: builder.createCode(modelId, BisCodeSpec.nullCodeSpec, `Code:${label}`),
        userLabel: label,
      });
      if (externalSourceId) {
        builder.insertAspect({
          classFullName: "BisCore:ExternalSourceAspect",
          element: { id: elementId },
          source: { id: externalSourceId },
        });
      }
      return elementId;
    }
  });
});

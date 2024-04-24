/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY } from "rxjs";
import sinon from "sinon";
import { MutableTreeModel, TreeModelSource } from "@itwin/components-react";
import { BeEvent, using } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { ModelsTreeEventHandler } from "../../../components/trees/models-tree/ModelsTreeEventHandler";
import { TestUtils } from "../../TestUtils";
import { createCategoryNode, createElementNode, createModelNode, createSimpleTreeModelNode, createSubjectNode } from "../Common";

import type { IModelConnection } from "@itwin/core-frontend";
import type { IVisibilityHandler, VisibilityChangeListener } from "../../../components/trees/VisibilityTreeEventHandler";
import type { AbstractTreeNodeLoaderWithProvider } from "@itwin/components-react";
import type { PresentationTreeDataProvider, PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { SelectionChangesListener, SelectionHandler } from "@itwin/presentation-frontend";
describe("ModelsTreeEventHandler", () => {
  const selectionHandlerStub = {
    getSelection: () => {},
  } as any as SelectionHandler;

  const onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  const visibilityHandler = { onVisibilityChange } as IVisibilityHandler;

  const selectionManagerStub = {
    selectionChange: { addListener: sinon.stub<[SelectionChangesListener, any], () => void>() },
    getSelection: sinon.stub<[IModelConnection, number], Readonly<KeySet>>(),
  };

  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  beforeEach(() => {
    selectionManagerStub.selectionChange.addListener.returns(() => {});
    selectionManagerStub.getSelection.returns(new KeySet());
    sinon.stub(Presentation, "selection").get(() => selectionManagerStub);
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  afterEach(() => {
    selectionManagerStub.selectionChange.addListener.reset();
    selectionManagerStub.getSelection.reset();
    onVisibilityChange.clear();
    sinon.restore();
  });

  function setupTreeModel(nodeIds: string[], item?: PresentationTreeNodeItem) {
    const model = new MutableTreeModel();
    model.setChildren(
      undefined,
      nodeIds.map((nodeId) => {
        return { ...createSimpleTreeModelNode(nodeId), isLoading: false, item: item ?? createSimpleTreeModelNode("node-item") };
      }),
      0,
    );
    const modelSource = new TreeModelSource(model);

    const nodeLoaderStub = {
      loadNode: () => EMPTY,
      modelSource,
      dataProvider: {} as any as PresentationTreeDataProvider,
    } as any as AbstractTreeNodeLoaderWithProvider<PresentationTreeDataProvider>;

    return { modelSource, nodeLoader: nodeLoaderStub };
  }

  function createHandler(nodeLoader: AbstractTreeNodeLoaderWithProvider<PresentationTreeDataProvider>): ModelsTreeEventHandler {
    return new ModelsTreeEventHandler({ visibilityHandler, nodeLoader, selectionHandler: selectionHandlerStub });
  }

  describe("onNodeDoubleClick", () => {
    [{ nodeItem: createSubjectNode() }, { nodeItem: createModelNode() }, { nodeItem: createCategoryNode() }].forEach(({ nodeItem }) => {
      it(`does not call zoomToElement when node item is ${nodeItem.id} node.`, async () => {
        const { nodeLoader, modelSource } = setupTreeModel(["testId"], nodeItem);
        modelSource.modifyModel = () => {};
        const eventHandler = createHandler(nodeLoader);

        const zoomSpy = sinon.spy();
        sinon.stub(IModelApp, "viewManager").get(() => ({ selectedView: { zoomToElements: zoomSpy } }));

        await using(eventHandler, async (_) => {
          await eventHandler.onNodeDoubleClick({ nodeId: "testId" });
        });

        expect(zoomSpy).to.not.be.called;
      });
    });

    it(`calls zoomToElement when node is element node.`, async () => {
      const { nodeLoader, modelSource } = setupTreeModel(["testId"], createElementNode());
      modelSource.modifyModel = () => {};
      const eventHandler = createHandler(nodeLoader);

      const zoomSpy = sinon.spy();
      sinon.stub(IModelApp, "viewManager").get(() => ({ selectedView: { zoomToElements: zoomSpy } }));

      await using(eventHandler, async (_) => {
        await eventHandler.onNodeDoubleClick({ nodeId: "testId" });
      });

      expect(zoomSpy).to.be.called;
    });

    it(`reports on zoom to node.`, async () => {
      const { nodeLoader, modelSource } = setupTreeModel(["testId"], createElementNode());
      modelSource.modifyModel = () => {};
      const reportUsageSpy = sinon.spy();
      const eventHandler = new ModelsTreeEventHandler({
        visibilityHandler,
        nodeLoader,
        selectionHandler: selectionHandlerStub,
        reportUsage: reportUsageSpy,
      });

      await using(eventHandler, async (_) => {
        await eventHandler.onNodeDoubleClick({ nodeId: "testId" });
      });

      expect(reportUsageSpy).to.be.calledOnceWith({ featureId: "zoom-to-node", reportInteraction: false });
    });
  });
});

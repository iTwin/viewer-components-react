/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, from, Subject } from "rxjs";
import sinon from "sinon";
import { MutableTreeModel, TreeModelSource } from "@itwin/components-react";
import { BeEvent, using } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { CheckBoxState } from "@itwin/core-react";
import { waitFor } from "@testing-library/react";
import { VisibilityTreeEventHandler } from "../../components/trees/VisibilityTreeEventHandler";
import { flushAsyncOperations, TestUtils } from "../TestUtils";
import { createCategoryNode, createElementNode, createModelNode, createSimpleTreeModelNode, createSubjectNode } from "./Common";

import type { AbstractTreeNodeLoaderWithProvider, CheckboxStateChange } from "@itwin/components-react";
import type { PresentationTreeDataProvider, PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { SelectionHandler } from "@itwin/presentation-frontend";
import type { IVisibilityHandler, VisibilityChangeListener, VisibilityStatus } from "../../components/trees/VisibilityTreeEventHandler";

describe("VisibilityTreeEventHandler", () => {
  const selectionHandlerStub = {
    getSelection: () => {},
  } as any as SelectionHandler;

  const testVisibilityStatus: VisibilityStatus = {
    state: "visible",
    isDisabled: false,
  };

  const getVisibilityStatus = sinon.stub().returns(testVisibilityStatus);
  const changeVisibility = sinon.stub();
  const onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  const visibilityHandler: IVisibilityHandler = {
    changeVisibility,
    getVisibilityStatus,
    onVisibilityChange,
    dispose: sinon.fake(),
  };

  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  afterEach(() => {
    changeVisibility.reset();
    onVisibilityChange.clear();
    getVisibilityStatus.resetHistory();
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

  function createHandler(nodeLoader: AbstractTreeNodeLoaderWithProvider<PresentationTreeDataProvider>): VisibilityTreeEventHandler {
    return new VisibilityTreeEventHandler({ visibilityHandler, nodeLoader, selectionHandler: selectionHandlerStub });
  }

  describe("onVisibilityChange", () => {
    it("calls 'getVisibilityStatus' for nodes whose visibility status is not known when updating all nodes", async () => {
      const visibilityStatus: Map<string, VisibilityStatus> = new Map([["testId2", testVisibilityStatus]]);

      const { nodeLoader } = setupTreeModel(["testId1", "testId2", "testId3"]);

      await using(createHandler(nodeLoader), async (_) => {
        await flushAsyncOperations();
        getVisibilityStatus.resetHistory();
        onVisibilityChange.raiseEvent(undefined, visibilityStatus);
        await flushAsyncOperations();
      });

      expect(getVisibilityStatus).to.be.calledTwice;
    });

    it("calls 'getVisibilityStatus' for all nodes if visibility status is not provided", async () => {
      const { nodeLoader } = setupTreeModel(["testId1", "testId2"]);
      await using(createHandler(nodeLoader), async (_) => {
        // we need to wait for 2 calls on creating and 2 calls on onModelChanged event
        await waitFor(() => expect(getVisibilityStatus).to.be.callCount(4));
        getVisibilityStatus.resetHistory();
        onVisibilityChange.raiseEvent(["testId1", "testId2"]);
        await flushAsyncOperations();
      });
      expect(getVisibilityStatus).to.be.calledTwice;
    });

    it("calls 'getVisibilityStatus' for nodes whose visibility status is not known when updating affected nodes", async () => {
      const visibilityStatus: Map<string, VisibilityStatus> = new Map([["testId1", testVisibilityStatus]]);

      const { nodeLoader } = setupTreeModel(["testId1", "testId2"]);

      await using(createHandler(nodeLoader), async (_) => {
        // we need to wait for 2 calls on creating and 2 calls on onModelChanged event
        await waitFor(() => expect(getVisibilityStatus).to.be.callCount(4));
        getVisibilityStatus.resetHistory();
        onVisibilityChange.raiseEvent(["testId1", "testId2"], visibilityStatus);
        await flushAsyncOperations();
      });
      expect(getVisibilityStatus).to.be.calledOnce;
    });

    it("does not call 'getVisibilityStatus' while changing visibility", async () => {
      const { nodeLoader, modelSource } = setupTreeModel(["testId1"]);
      const node = modelSource.getModel().getNode("testId1");

      const eventHandler = createHandler(nodeLoader);
      const changes: CheckboxStateChange[] = [{ nodeItem: node!.item, newState: CheckBoxState.On }];
      const changesSubject = new Subject<CheckboxStateChange[]>();

      changeVisibility.returns(EMPTY);
      await using(eventHandler, async (_) => {
        await waitFor(() => expect(getVisibilityStatus).to.be.calledOnce);
        getVisibilityStatus.resetHistory();
        eventHandler.onCheckboxStateChanged({
          stateChanges: changesSubject,
        });
        changesSubject.next(changes);
        onVisibilityChange.raiseEvent(["testId1"]);
        // assure that getVisibilityStatus is not called before the changes are complete.
        await waitFor(() => expect(getVisibilityStatus).to.not.be.called);
        changesSubject.complete();
        onVisibilityChange.raiseEvent(["testId1"]);
        await flushAsyncOperations();
      });

      expect(getVisibilityStatus).to.be.calledTwice;
    });

    it("handles errors while changing visibility", async () => {
      const { modelSource, nodeLoader } = setupTreeModel(["testId1"]);
      const node = modelSource.getModel().getNode("testId1");

      const eventHandler = createHandler(nodeLoader);
      const changes: CheckboxStateChange[] = [{ nodeItem: node!.item, newState: CheckBoxState.Off }];
      const errorSubject = new Subject();

      changeVisibility.returns(errorSubject);
      await using(eventHandler, async (_) => {
        await waitFor(() => expect(getVisibilityStatus).to.be.calledOnce);
        getVisibilityStatus.resetHistory();
        eventHandler.onCheckboxStateChanged({
          // eslint-disable-next-line deprecation/deprecation
          stateChanges: from([changes]),
        });
        onVisibilityChange.raiseEvent(["testId1"]);
        errorSubject.error(new Error());
        onVisibilityChange.raiseEvent(["testId1"]);
        await flushAsyncOperations();
      });
      expect(getVisibilityStatus).to.be.calledTwice;
    });
  });

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
        await waitFor(() => expect(getVisibilityStatus).to.be.calledOnce);
        await eventHandler.onNodeDoubleClick({ nodeId: "testId" });
      });

      expect(zoomSpy).to.be.called;
    });
  });
});

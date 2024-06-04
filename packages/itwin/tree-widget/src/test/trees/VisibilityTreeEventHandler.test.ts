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
import { KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { waitFor } from "@testing-library/react";
import { VisibilityTreeEventHandler } from "../../components/trees/VisibilityTreeEventHandler";
import { createResolvablePromise, flushAsyncOperations, TestUtils } from "../TestUtils";
import { createSimpleTreeModelNode } from "./Common";

import type { IModelConnection } from "@itwin/core-frontend";
import type { SelectionChangesListener, SelectionHandler } from "@itwin/presentation-frontend";
import type { AbstractTreeNodeLoaderWithProvider, CheckboxStateChange } from "@itwin/components-react";
import type { PresentationTreeDataProvider, PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { IVisibilityHandler, VisibilityChangeListener, VisibilityStatus } from "../../components/trees/VisibilityTreeEventHandler";

describe("VisibilityTreeEventHandler", () => {
  const selectionHandlerStub = {
    getSelection: () => {},
  } as any as SelectionHandler;

  const selectionManagerStub = {
    selectionChange: { addListener: sinon.stub<[SelectionChangesListener, any], () => void>() },
    getSelection: sinon.stub<[IModelConnection, number], Readonly<KeySet>>(),
  };

  const testVisibilityStatus: VisibilityStatus = {
    state: "visible",
    isDisabled: false,
  };

  const getVisibilityStatus = sinon.stub<any[], VisibilityStatus>().returns(testVisibilityStatus);
  const changeVisibility = sinon.stub<any[], Promise<void>>();
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

      changeVisibility.resolves(undefined);
      await using(eventHandler, async (_) => {
        await waitFor(() => expect(getVisibilityStatus).to.be.called);
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
      const { promise: changeVisibilityPromise, reject: rejectChangeVisibilityPromise } = createResolvablePromise<void>();

      changeVisibility.returns(changeVisibilityPromise);
      await using(eventHandler, async (_) => {
        await waitFor(() => expect(getVisibilityStatus).to.be.called);
        getVisibilityStatus.resetHistory();
        eventHandler.onCheckboxStateChanged({
          // eslint-disable-next-line deprecation/deprecation
          stateChanges: from([changes]),
        });
        onVisibilityChange.raiseEvent(["testId1"]);
        await waitFor(() => expect(changeVisibility).to.be.calledOnce);
        rejectChangeVisibilityPromise(new Error());
        onVisibilityChange.raiseEvent(["testId1"]);
        await flushAsyncOperations();
      });
      // If `changeVisibility` throws an error, checkbox update isn't called in subscribe next callback
      expect(getVisibilityStatus).to.be.calledOnce;
    });
  });
});

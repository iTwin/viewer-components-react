/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, from, Subject } from "rxjs";
import sinon from "sinon";
import { MutableTreeModel, TreeModelSource } from "@itwin/components-react";
import { BeEvent, using } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { CheckBoxState } from "@itwin/core-react";
import { waitFor } from "@testing-library/react";
import { VisibilityTreeEventHandler } from "../../components/trees/VisibilityTreeEventHandler";
import { flushAsyncOperations } from "../TestUtils";
import { createCategoryNode, createElementNode, createModelNode, createSimpleTreeModelNode, createSubjectNode } from "./Common";

import type { AbstractTreeNodeLoaderWithProvider, CheckboxStateChange, ITreeNodeLoader } from "@itwin/components-react";
import type { PresentationTreeDataProvider, PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { SelectionHandler } from "@itwin/presentation-frontend";
import type {
  IVisibilityHandler,
  VisibilityChangeListener,
  VisibilityStatus,
  VisibilityTreeEventHandlerParams,
} from "../../components/trees/VisibilityTreeEventHandler";
describe("VisibilityTreeEventHandler", () => {
  const selectionHandlerStub = { getSelection: () => {} } as any as SelectionHandler;

  const nodeLoaderStub = {
    loadNode: sinon.stub<Parameters<ITreeNodeLoader["loadNode"]>, ReturnType<ITreeNodeLoader["loadNode"]>>(),
    modelSource: {},
    dataProvider: {} as any as PresentationTreeDataProvider,
  };

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

  beforeEach(() => {
    nodeLoaderStub.loadNode.returns(EMPTY);
  });

  afterEach(() => {
    nodeLoaderStub.loadNode.reset();
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
    nodeLoaderStub.modelSource = modelSource;
    modelSource.modifyModel = () => {};

    return { modelSource, nodeLoader: nodeLoaderStub as unknown as AbstractTreeNodeLoaderWithProvider<PresentationTreeDataProvider> };
  }

  const createHandler = (partialProps?: Partial<VisibilityTreeEventHandlerParams>): VisibilityTreeEventHandler => {
    if (!partialProps) partialProps = {};
    const props: VisibilityTreeEventHandlerParams = {
      visibilityHandler: partialProps.visibilityHandler || visibilityHandler,
      nodeLoader: partialProps.nodeLoader || (nodeLoaderStub as unknown as AbstractTreeNodeLoaderWithProvider<PresentationTreeDataProvider>),
      selectionHandler: partialProps.selectionHandler || selectionHandlerStub,
    };
    return new VisibilityTreeEventHandler(props);
  };

  describe("onVisibilityChange", () => {
    it("calls 'getVisibilityStatus' for nodes whose visibility status is not known when updating all nodes", async () => {
      const visibilityStatus: Map<string, VisibilityStatus> = new Map([["testId2", testVisibilityStatus]]);

      const { nodeLoader } = setupTreeModel(["testId1", "testId2", "testId3"]);

      await using(createHandler({ visibilityHandler, nodeLoader }), async (_) => {
        await flushAsyncOperations();
        getVisibilityStatus.resetHistory();
        onVisibilityChange.raiseEvent(undefined, visibilityStatus);
        await flushAsyncOperations();
      });

      expect(getVisibilityStatus).to.be.calledTwice;
    });

    it("calls 'getVisibilityStatus' for all nodes if visibility status is not provided", async () => {
      const { nodeLoader } = setupTreeModel(["testId1", "testId2"]);
      await using(createHandler({ visibilityHandler, nodeLoader }), async (_) => {
        await waitFor(() => expect(getVisibilityStatus).to.be.calledTwice);
        getVisibilityStatus.resetHistory();
        onVisibilityChange.raiseEvent(["testId1", "testId2"]);
        await flushAsyncOperations();
      });
      expect(getVisibilityStatus).to.be.calledTwice;
    });

    it("calls 'getVisibilityStatus' for nodes whose visibility status is not known when updating affected nodes", async () => {
      const visibilityStatus: Map<string, VisibilityStatus> = new Map([["testId1", testVisibilityStatus]]);

      const { nodeLoader } = setupTreeModel(["testId1", "testId2"]);

      await using(createHandler({ visibilityHandler, nodeLoader }), async (_) => {
        await waitFor(() => expect(getVisibilityStatus).to.be.calledTwice);
        getVisibilityStatus.resetHistory();
        onVisibilityChange.raiseEvent(["testId1", "testId2"], visibilityStatus);
        await flushAsyncOperations();
      });
      expect(getVisibilityStatus).to.be.calledOnce;
    });

    it("does not call 'getVisibilityStatus' while changing visibility", async () => {
      const { nodeLoader } = setupTreeModel(["testId1"]);
      const node = nodeLoader.modelSource.getModel().getNode("testId1");

      const eventHandler = createHandler({ visibilityHandler, nodeLoader });
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
      const { nodeLoader } = setupTreeModel(["testId1"]);
      const node = nodeLoader.modelSource.getModel().getNode("testId1");

      const eventHandler = createHandler({ visibilityHandler });
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

  describe("onNodeDoubleClick", async () => {
    [{ nodeItem: createSubjectNode() }, { nodeItem: createModelNode() }, { nodeItem: createCategoryNode() }].forEach(({ nodeItem }) => {
      it(`does not call zoomToElement when node item is ${nodeItem.id} node.`, async () => {
        const { nodeLoader } = setupTreeModel(["testId"], nodeItem);
        const eventHandler = createHandler({ visibilityHandler, nodeLoader });

        const zoomSpy = sinon.spy();
        sinon.stub(IModelApp, "viewManager").get(() => ({ selectedView: { zoomToElements: zoomSpy } }));

        await using(eventHandler, async (_) => {
          await eventHandler.onNodeDoubleClick({ nodeId: "testId" });
        });

        expect(zoomSpy).to.not.be.called;
      });
    });

    it(`calls zoomToElement when node is element node.`, async () => {
      const { nodeLoader } = setupTreeModel(["testId"], createElementNode());
      const eventHandler = createHandler({ visibilityHandler, nodeLoader });

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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, from, Subject } from "rxjs";
import sinon from "sinon";
import { BeEvent, BeUiEvent, using } from "@itwin/core-bentley";
import { CheckBoxState } from "@itwin/core-react";
import { VisibilityTreeEventHandler } from "../../components/trees/VisibilityTreeEventHandler";
import { flushAsyncOperations } from "../TestUtils";
import { createCategoryNode, createElementNode, createModelNode, createSimpleTreeModelNode, createSubjectNode } from "./Common";

import type { AbstractTreeNodeLoaderWithProvider, CheckboxStateChange, TreeModel, TreeModelChanges, TreeModelSource } from "@itwin/components-react";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { SelectionHandler } from "@itwin/presentation-frontend";
import type { IVisibilityHandler, VisibilityChangeListener, VisibilityStatus, VisibilityTreeEventHandlerParams } from "../../components/trees/VisibilityTreeEventHandler";
import { IModelApp } from "@itwin/core-frontend";

describe("VisibilityTreeEventHandler", () => {
  const modelStub = { getNode: () => createSimpleTreeModelNode(), iterateTreeModelNodes: () => {} } as any as TreeModel;
  const modelSourceStub = {
    onModelChanged: new BeUiEvent<[TreeModel, TreeModelChanges]>(),
    getModel: () => modelStub,
    modifyModel: () => {},
  } as any as TreeModelSource;

  const nodeLoaderStub = { dataProvider: {} as any as IPresentationTreeDataProvider, modelSource: modelSourceStub } as any as AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
  const selectionHandlerStub = { getSelection: () => {} } as any as SelectionHandler;

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

  afterEach(() => {
    changeVisibility.reset();
    modelSourceStub.onModelChanged.clear();
    onVisibilityChange.clear();
    sinon.restore();
  });

  const createHandler = (partialProps?: Partial<VisibilityTreeEventHandlerParams>): VisibilityTreeEventHandler => {
    if (!partialProps)
      partialProps = {};
    const props: VisibilityTreeEventHandlerParams = {
      visibilityHandler: partialProps.visibilityHandler || visibilityHandler,
      nodeLoader: partialProps.nodeLoader || nodeLoaderStub,
      selectionHandler: partialProps.selectionHandler || selectionHandlerStub,
    };
    return new VisibilityTreeEventHandler(props);
  };

  describe("onVisibilityChange", () => {
    it("calls 'getVisibilityStatus' for nodes whose visibility status is not known when updating all nodes", async () => {
      const visibilityStatus: Map<string, VisibilityStatus> = new Map([
        ["testId2", testVisibilityStatus],
      ]);

      const treeModelNodes = [
        createSimpleTreeModelNode("testId1"),
        createSimpleTreeModelNode("testId2"),
        createSimpleTreeModelNode("testId3"),
      ];

      modelStub.iterateTreeModelNodes = sinon.stub().returns(treeModelNodes);

      await using(createHandler({ visibilityHandler }), async (_) => {
        await flushAsyncOperations();
        getVisibilityStatus.resetHistory();
        onVisibilityChange.raiseEvent(undefined, visibilityStatus);
        await flushAsyncOperations();
      });

      modelStub.iterateTreeModelNodes = sinon.stub();
      expect(getVisibilityStatus).to.be.calledTwice;
    });

    it("calls 'getVisibilityStatus' for all nodes if visibility status is not provided", async () => {
      await using(createHandler({ visibilityHandler }), async (_) => {
        getVisibilityStatus.resetHistory();
        onVisibilityChange.raiseEvent(["testId1", "testId2"]);
        await flushAsyncOperations();
      });
      expect(getVisibilityStatus).to.be.calledTwice;
    });

    it("calls 'getVisibilityStatus' for nodes whose visibility status is not known when updating affected nodes", async () => {
      const visibilityStatus: Map<string, VisibilityStatus> = new Map([
        ["testId1", testVisibilityStatus],
      ]);

      const node1 = createSimpleTreeModelNode("testId1");
      const node2 = createSimpleTreeModelNode("testId2");

      const getNodeCallback = sinon.stub();
      getNodeCallback.withArgs("testId1").returns(node1);
      getNodeCallback.withArgs("testId2").returns(node2);

      modelStub.getNode = getNodeCallback;

      await using(createHandler({ visibilityHandler }), async (_) => {
        getVisibilityStatus.resetHistory();
        onVisibilityChange.raiseEvent(["testId1", "testId2"], visibilityStatus);
        await flushAsyncOperations();
      });
      expect(getVisibilityStatus).to.be.calledOnce;
    });

    it("does not call 'getVisibilityStatus' while changing visibility", async () => {
      const node1 = createSimpleTreeModelNode("testId1");

      const eventHandler = createHandler({ visibilityHandler });
      const changes: CheckboxStateChange[] = [{ nodeItem: node1.item, newState: CheckBoxState.On }];
      const changesSubject = new Subject<CheckboxStateChange[]>();

      changeVisibility.returns(EMPTY);
      await using(eventHandler, async (_) => {
        getVisibilityStatus.resetHistory();
        eventHandler.onCheckboxStateChanged({
          stateChanges: changesSubject,
        });
        changesSubject.next(changes);
        onVisibilityChange.raiseEvent(["testId1"]);
        changesSubject.complete();
        onVisibilityChange.raiseEvent(["testId1"]);
        await flushAsyncOperations();
      });

      expect(getVisibilityStatus).to.be.calledOnce;
    });

    it("handles errors while changing visibility", async () => {
      const node1 = createSimpleTreeModelNode("testId1");

      modelStub.getNode = sinon.stub().returns(node1);
      const eventHandler = createHandler({ visibilityHandler });
      const changes: CheckboxStateChange[] = [{ nodeItem: node1.item, newState: CheckBoxState.Off }];
      const errorSubject = new Subject();

      changeVisibility.returns(errorSubject);
      await using(eventHandler, async (_) => {
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
      expect(getVisibilityStatus).to.be.calledOnce;
    });

  });

  describe("onNodeDoubleClick", async () => {
    [
      { nodeItem: createSubjectNode() },
      { nodeItem: createModelNode() },
      { nodeItem: createCategoryNode() },
    ].forEach(({ nodeItem }) => {
      it(`does not call zoomToElement when node item is ${nodeItem.id} node.`, async () => {
        const eventHandler = createHandler({ visibilityHandler });
        const node = createSimpleTreeModelNode("testId", undefined, { item: nodeItem });
        modelStub.getNode = sinon.stub().returns(node);

        const zoomSpy = sinon.spy();
        sinon.stub(IModelApp, "viewManager").get(() => ({ selectedView: { zoomToElements: zoomSpy } }));

        await using(eventHandler, async (_) => {
          await eventHandler.onNodeDoubleClick({ nodeId: "testId" });
        });

        expect(zoomSpy).to.not.be.called;
      });
    });

    it(`calls zoomToElement when node is element node.`, async () => {
      const eventHandler = createHandler({ visibilityHandler });
      const node = createSimpleTreeModelNode("testId", undefined, { item: createElementNode() });

      modelStub.getNode = sinon.stub().returns(node);

      const zoomSpy = sinon.spy();
      sinon.stub(IModelApp, "viewManager").get(() => ({ selectedView: { zoomToElements: zoomSpy } }));

      await using(eventHandler, async (_) => {
        await eventHandler.onNodeDoubleClick({ nodeId: "testId" });
      });

      expect(zoomSpy).to.be.called;
    });
  });
});

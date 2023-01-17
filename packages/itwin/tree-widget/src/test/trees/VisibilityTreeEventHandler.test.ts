/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { BeEvent, BeUiEvent, using } from "@itwin/core-bentley";
import { VisibilityTreeEventHandler } from "../../components/trees/VisibilityTreeEventHandler";
import { flushAsyncOperations } from "../TestUtils";
import { createSimpleTreeModelNode } from "./Common";
import type { AbstractTreeNodeLoaderWithProvider, CheckboxStateChange, TreeModel, TreeModelChanges, TreeModelSource } from "@itwin/components-react";
import type { SelectionHandler } from "@itwin/presentation-frontend";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { IVisibilityHandler, VisibilityChangeListener, VisibilityStatus, VisibilityTreeEventHandlerParams } from "../../components/trees/VisibilityTreeEventHandler";
import { EMPTY, from, Subject } from "rxjs";
import { CheckBoxState } from "@itwin/core-react";

describe("VisibilityTreeEventHandler", () => {

  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const modelMock = moq.Mock.ofType<TreeModel>();
  const nodeLoaderMock = moq.Mock.ofType<AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();

  const getVisibilityStatus = sinon.stub();
  const changeVisibility = sinon.stub();
  const onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  const visibilityHandler: IVisibilityHandler = {
    changeVisibility,
    getVisibilityStatus,
    onVisibilityChange,
    dispose: sinon.fake(),
  };

  const testVisibilityStatus: VisibilityStatus = {
    state: "visible",
    isDisabled: false,
  };

  beforeEach(async () => {
    modelSourceMock.reset();
    modelMock.reset();
    nodeLoaderMock.reset();
    dataProviderMock.reset();
    selectionHandlerMock.reset();
    getVisibilityStatus.reset();
    changeVisibility.reset();

    getVisibilityStatus.returns(testVisibilityStatus);
    modelMock.setup((x) => x.getNode(moq.It.isAny())).returns(() => createSimpleTreeModelNode());
    modelSourceMock.setup((x) => x.onModelChanged).returns(() => new BeUiEvent<[TreeModel, TreeModelChanges]>());
    modelSourceMock.setup((x) => x.getModel()).returns(() => modelMock.object);
    nodeLoaderMock.setup((x) => x.dataProvider).returns(() => dataProviderMock.object);
    nodeLoaderMock.setup((x) => x.modelSource).returns(() => modelSourceMock.object);
  });

  const createHandler = (partialProps?: Partial<VisibilityTreeEventHandlerParams>): VisibilityTreeEventHandler => {
    if (!partialProps)
      partialProps = {};
    const props: VisibilityTreeEventHandlerParams = {
      visibilityHandler: partialProps.visibilityHandler || undefined,
      nodeLoader: partialProps.nodeLoader || nodeLoaderMock.object,
      selectionHandler: partialProps.selectionHandler || selectionHandlerMock.object,
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

      modelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => treeModelNodes[Symbol.iterator]());

      await using(createHandler({ visibilityHandler }), async (_) => {
        await flushAsyncOperations();
        getVisibilityStatus.resetHistory();
        onVisibilityChange.raiseEvent(undefined, visibilityStatus);
        await flushAsyncOperations();
      });
      expect(getVisibilityStatus.callCount).to.eq(2);
    });

    it("calls 'getVisibilityStatus' for all nodes if visibility status is not provided", async () => {
      await using(createHandler({ visibilityHandler }), async (_) => {
        onVisibilityChange.raiseEvent(["testId1", "testId2"]);
        await flushAsyncOperations();
      });
      expect(getVisibilityStatus.callCount).to.eq(2);
    });

    it("calls 'getVisibilityStatus' for nodes whose visibility status is not known when updating affected nodes", async () => {
      const visibilityStatus: Map<string, VisibilityStatus> = new Map([
        ["testId1", testVisibilityStatus],
      ]);

      const node1 = createSimpleTreeModelNode("testId1");
      const node2 = createSimpleTreeModelNode("testId2");

      modelMock.reset();
      modelMock.setup((x) => x.getNode("testId1")).returns(() => node1);
      modelMock.setup((x) => x.getNode("testId2")).returns(() => node2);

      await using(createHandler({ visibilityHandler }), async (_) => {
        onVisibilityChange.raiseEvent(["testId1", "testId2"], visibilityStatus);
        await flushAsyncOperations();
      });
      expect(getVisibilityStatus.callCount).to.eq(1);
    });

    it("does not call 'getVisibilityStatus' while changing visibility", async () => {
      const node1 = createSimpleTreeModelNode("testId1");
      modelMock.reset();
      modelMock.setup((x) => x.getNode("testId1")).returns(() => node1);
      const eventHandler = createHandler({ visibilityHandler });
      const changes: CheckboxStateChange[] = [{ nodeItem: node1.item, newState: CheckBoxState.On }];
      const changesSubject = new Subject<CheckboxStateChange[]>();
      changesSubject.subscribe({
        next: (change) => {
          return change;
        },
        complete: () => { },
      });

      changeVisibility.returns(EMPTY);
      await using(eventHandler, async (_) => {
        eventHandler.onCheckboxStateChanged({
          stateChanges: changesSubject,
        });
        changesSubject.next(changes);
        onVisibilityChange.raiseEvent(["testId1"]);
        changesSubject.complete();
        onVisibilityChange.raiseEvent(["testId1"]);
        await flushAsyncOperations();
      });

      expect(getVisibilityStatus.callCount).to.eq(1);
    });

    it("handles errors while changing visibility", async () => {
      const node1 = createSimpleTreeModelNode("testId1");
      modelMock.reset();
      modelMock.setup((x) => x.getNode("testId1")).returns(() => node1);
      const eventHandler = createHandler({ visibilityHandler });
      const changes: CheckboxStateChange[] = [{ nodeItem: node1.item, newState: CheckBoxState.Off }];
      const errorSubject = new Subject();
      errorSubject.subscribe({
        error: (err) => {
          return err;
        },
      });

      changeVisibility.returns(errorSubject);
      await using(eventHandler, async (_) => {
        eventHandler.onCheckboxStateChanged({
          stateChanges: from([changes]),
        });
        onVisibilityChange.raiseEvent(["testId1"]);
        errorSubject.error(new Error());
        onVisibilityChange.raiseEvent(["testId1"]);
        await flushAsyncOperations();
      });
      expect(getVisibilityStatus.callCount).to.eq(1);
    });

  });
});

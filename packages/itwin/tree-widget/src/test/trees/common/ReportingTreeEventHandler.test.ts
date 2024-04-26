/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { TreeEventHandler } from "@itwin/components-react";
import { ReportingTreeEventHandler } from "../../../components/trees/common/ReportingTreeEventHandler";

import type {
  AbstractTreeNodeLoaderWithProvider,
  Subscription,
  TreeCheckboxStateChangeEventArgs,
  TreeNodeEventArgs,
  TreeSelectionModificationEventArgs,
  TreeSelectionReplacementEventArgs,
} from "@itwin/components-react";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";

describe("ReportingTreeEventHandler", () => {
  const wrappedHandler = {
    dispose: sinon.stub<[], void>(),
    onNodeExpanded: sinon.stub<[any], void>(),
    onNodeCollapsed: sinon.stub<[any], void>(),
    onSelectionModified: sinon.stub<[TreeSelectionModificationEventArgs], Subscription | undefined>(),
    onSelectionReplaced: sinon.stub<[any], Subscription | undefined>(),
    onCheckboxStateChanged: sinon.stub<[any], Subscription | undefined>(),
    onDelayedNodeClick: sinon.stub<[any], void>(),
    onNodeDoubleClick: sinon.stub<[any], void>(),
    onNodeEditorActivated: sinon.stub<[any], void>(),
  };

  const reportUsageSpy = sinon.spy();

  function createHandler() {
    return new ReportingTreeEventHandler({
      eventHandler: wrappedHandler as unknown as TreeEventHandler,
      nodeLoader: {} as unknown as AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
      reportUsage: reportUsageSpy,
    });
  }

  afterEach(() => {
    reportUsageSpy.resetHistory();
    wrappedHandler.onNodeExpanded.reset();
    wrappedHandler.onNodeCollapsed.reset();
    wrappedHandler.onSelectionModified.reset();
    wrappedHandler.onSelectionReplaced.reset();
    wrappedHandler.onCheckboxStateChanged.reset();
    wrappedHandler.onDelayedNodeClick.reset();
    wrappedHandler.onNodeDoubleClick.reset();
    wrappedHandler.onNodeEditorActivated.reset();
    sinon.restore();
  });

  describe("`dispose`", () => {
    it("disposes wrapped and base handlers", () => {
      const baseHandlerDisposeSpy = sinon.stub(TreeEventHandler.prototype, "dispose");
      baseHandlerDisposeSpy.callsFake(() => {});
      createHandler().dispose();
      expect(wrappedHandler.dispose).to.be.calledOnce;
      expect(baseHandlerDisposeSpy).to.be.calledOnce;
    });
  });

  describe("`onNodeExpanded`", () => {
    it("calls wrapped function", () => {
      createHandler().onNodeExpanded({} as unknown as TreeNodeEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onNodeExpanded).to.be.calledOnce;
    });
  });

  describe("`onNodeCollapsed`", () => {
    it("calls wrapped function", () => {
      createHandler().onNodeCollapsed({} as unknown as TreeNodeEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onNodeCollapsed).to.be.calledOnce;
    });
  });

  describe("`onSelectionModified`", () => {
    it("calls wrapped function", () => {
      createHandler().onSelectionModified({} as unknown as TreeSelectionModificationEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onSelectionModified).to.be.calledOnce;
    });
  });

  describe("`onSelectionReplaced`", () => {
    it("calls wrapped function", () => {
      createHandler().onSelectionReplaced({} as unknown as TreeSelectionReplacementEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onSelectionReplaced).to.be.calledOnce;
    });
  });

  describe("`onCheckboxStateChanged`", () => {
    it("calls wrapped function", () => {
      createHandler().onCheckboxStateChanged({} as unknown as TreeCheckboxStateChangeEventArgs);
      expect(wrappedHandler.onCheckboxStateChanged).to.be.calledOnce;
      expect(reportUsageSpy).to.not.be.called;
    });
  });

  describe("`onDelayedNodeClick`", () => {
    it("calls wrapped function", () => {
      createHandler().onDelayedNodeClick({} as unknown as TreeNodeEventArgs);
      expect(wrappedHandler.onDelayedNodeClick).to.be.calledOnce;
      expect(reportUsageSpy).to.not.be.called;
    });
  });

  describe("`onNodeDoubleClick`", () => {
    it("calls wrapped function", () => {
      createHandler().onNodeDoubleClick({} as unknown as TreeNodeEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onNodeDoubleClick).to.be.calledOnce;
    });
  });

  describe("`onNodeEditorActivated`", () => {
    it("calls wrapped function", () => {
      createHandler().onNodeEditorActivated({} as unknown as TreeNodeEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onNodeEditorActivated).to.be.calledOnce;
    });
  });
});

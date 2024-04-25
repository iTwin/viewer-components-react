/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Subject } from "rxjs";
import sinon from "sinon";
import { TreeEventHandler } from "@itwin/components-react";
import { ReportingTreeEventHandler } from "../../../components/trees/common/ReportingTreeEventHandler";

import type {
  AbstractTreeNodeLoaderWithProvider,
  Subscription,
  TreeCheckboxStateChangeEventArgs,
  TreeNodeEventArgs,
  TreeSelectionChange,
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
      const baseHandleronNodeExpandedSpy = sinon.stub(TreeEventHandler.prototype, "onNodeExpanded");
      baseHandleronNodeExpandedSpy.callsFake(() => {});
      createHandler().onNodeExpanded({} as unknown as TreeNodeEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onNodeExpanded).to.be.calledOnce;
      expect(baseHandleronNodeExpandedSpy).to.not.be.called;
    });
  });

  describe("`onNodeCollapsed`", () => {
    it("calls wrapped function", () => {
      const baseHandleronNodeCollapsedSpy = sinon.stub(TreeEventHandler.prototype, "onNodeCollapsed");
      baseHandleronNodeCollapsedSpy.callsFake(() => {});
      createHandler().onNodeCollapsed({} as unknown as TreeNodeEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onNodeCollapsed).to.be.calledOnce;
      expect(baseHandleronNodeCollapsedSpy).to.not.be.called;
    });
  });

  describe("`onSelectionModified`", () => {
    it("calls wrapped function and reports when selection change has values", () => {
      const subject = new Subject<TreeSelectionChange>();
      const baseHandleronSelectionModifiedSpy = sinon.stub(TreeEventHandler.prototype, "onSelectionModified");
      baseHandleronSelectionModifiedSpy.callsFake(() => undefined);
      wrappedHandler.onSelectionModified.callsFake(({ modifications }) => modifications.subscribe());
      createHandler().onSelectionModified({ modifications: subject });

      subject.next({} as unknown as TreeSelectionChange);
      subject.complete();

      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onSelectionModified).to.be.calledOnce;
      expect(baseHandleronSelectionModifiedSpy).to.not.be.called;
    });

    it("calls wrapped function and does not report when selection change is empty", () => {
      const subject = new Subject<TreeSelectionChange>();
      const baseHandleronSelectionModifiedSpy = sinon.stub(TreeEventHandler.prototype, "onSelectionModified");
      baseHandleronSelectionModifiedSpy.callsFake(() => undefined);
      wrappedHandler.onSelectionModified.callsFake(({ modifications }) => modifications.subscribe());
      createHandler().onSelectionModified({ modifications: subject });

      subject.complete();

      expect(reportUsageSpy).to.not.be.called;
      expect(wrappedHandler.onSelectionModified).to.be.calledOnce;
      expect(baseHandleronSelectionModifiedSpy).to.not.be.called;
    });
  });

  describe("`onSelectionReplaced`", () => {
    it("calls wrapped function", () => {
      const baseHandleronSelectionReplacedSpy = sinon.stub(TreeEventHandler.prototype, "onSelectionReplaced");
      baseHandleronSelectionReplacedSpy.callsFake(() => undefined);
      createHandler().onSelectionReplaced({} as unknown as TreeSelectionReplacementEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onSelectionReplaced).to.be.calledOnce;
      expect(baseHandleronSelectionReplacedSpy).to.not.be.called;
    });
  });

  describe("`onCheckboxStateChanged`", () => {
    it("calls wrapped function", () => {
      const baseHandleronCheckboxStateChangedSpy = sinon.stub(TreeEventHandler.prototype, "onCheckboxStateChanged");
      baseHandleronCheckboxStateChangedSpy.callsFake(() => undefined);
      createHandler().onCheckboxStateChanged({} as unknown as TreeCheckboxStateChangeEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onCheckboxStateChanged).to.be.calledOnce;
      expect(baseHandleronCheckboxStateChangedSpy).to.not.be.called;
    });
  });

  describe("`onDelayedNodeClick`", () => {
    it("calls wrapped function", () => {
      const baseHandleronDelayedNodeClickSpy = sinon.stub(TreeEventHandler.prototype, "onDelayedNodeClick");
      baseHandleronDelayedNodeClickSpy.callsFake(() => {});
      createHandler().onDelayedNodeClick({} as unknown as TreeNodeEventArgs);
      expect(wrappedHandler.onDelayedNodeClick).to.be.calledOnce;
      expect(baseHandleronDelayedNodeClickSpy).to.not.be.called;
    });
  });

  describe("`onNodeDoubleClick`", () => {
    it("calls wrapped function", () => {
      const baseHandleronNodeDoubleClickSpy = sinon.stub(TreeEventHandler.prototype, "onNodeDoubleClick");
      baseHandleronNodeDoubleClickSpy.callsFake(() => {});
      createHandler().onNodeDoubleClick({} as unknown as TreeNodeEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onNodeDoubleClick).to.be.calledOnce;
      expect(baseHandleronNodeDoubleClickSpy).to.not.be.called;
    });
  });

  describe("`onNodeEditorActivated`", () => {
    it("calls wrapped function", () => {
      const baseHandleronNodeEditorActivatedSpy = sinon.stub(TreeEventHandler.prototype, "onNodeEditorActivated");
      baseHandleronNodeEditorActivatedSpy.callsFake(() => {});
      createHandler().onNodeEditorActivated({} as unknown as TreeNodeEventArgs);
      expect(reportUsageSpy).to.be.calledOnceWith({ reportInteraction: true });
      expect(wrappedHandler.onNodeEditorActivated).to.be.calledOnce;
      expect(baseHandleronNodeEditorActivatedSpy).to.not.be.called;
    });
  });
});

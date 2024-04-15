/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { usePerformanceReporting } from "../../../components/trees/common/UsePerformanceReporting";
import { renderHook } from "../../TestUtils";

import type { Ruleset } from "@itwin/presentation-common";
import type { UsePerformanceReportingProps } from "../../../components/trees/common/UsePerformanceReporting";
import type { IModelConnection } from "@itwin/core-frontend";

describe("usePerformanceReporting", () => {
  after(() => {
    sinon.restore();
  });

  describe("performance reporting", () => {
    let getDataStub: sinon.SinonStub<Parameters<PresentationPropertyDataProvider["getData"]>, ReturnType<PresentationPropertyDataProvider["getData"]>>;
    const onPerformanceMeasuredSpy = sinon.spy();
    const initialProps = {
      treeIdentifier: "test-tree",
      iModel: {} as IModelConnection,
      ruleset: {} as Ruleset,
      onPerformanceMeasured: onPerformanceMeasuredSpy,
    } as UsePerformanceReportingProps;

    before(() => {
      getDataStub = sinon.stub(PresentationPropertyDataProvider.prototype, "getData");
    });

    beforeEach(() => {
      getDataStub.reset();
      onPerformanceMeasuredSpy.resetHistory();
    });

    it("logs initial load metrics", async () => {
      const { result } = renderHook((props) => usePerformanceReporting(props), { initialProps });
      expect(result.current).to.not.be.undefined;

      result.current.onNodeLoaded?.({ node: "root", duration: 20 });

      expect(onPerformanceMeasuredSpy.callCount).to.be.eq(1);
      expect(onPerformanceMeasuredSpy.getCall(0).calledWithExactly("test-tree-initial-load", 20)).to.be.true;
    });

    it("does not log multiple initial loads", async () => {
      const { result } = renderHook((props) => usePerformanceReporting(props), { initialProps });
      expect(result.current).to.not.be.undefined;

      result.current.onNodeLoaded?.({ node: "root", duration: 20 });
      result.current.onNodeLoaded?.({ node: "root", duration: 10 });

      expect(onPerformanceMeasuredSpy.callCount).to.be.eq(2);
      expect(onPerformanceMeasuredSpy.getCall(0).calledWithExactly("test-tree-initial-load", 20)).to.be.true;
      expect(onPerformanceMeasuredSpy.getCall(1).calledWithExactly("test-tree-hierarchy-level-load", 10)).to.be.true;
    });

    it("logs initial load when iModel changes", async () => {
      const { result, rerender } = renderHook((props) => usePerformanceReporting(props), { initialProps });
      expect(result.current).to.not.be.undefined;

      result.current.onNodeLoaded?.({ node: "root", duration: 20 });
      rerender({ ...initialProps, iModel: {} as IModelConnection });
      result.current.onNodeLoaded?.({ node: "root", duration: 30 });

      expect(onPerformanceMeasuredSpy.callCount).to.be.eq(2);
      expect(onPerformanceMeasuredSpy.getCall(0).calledWithExactly("test-tree-initial-load", 20)).to.be.true;
      expect(onPerformanceMeasuredSpy.getCall(1).calledWithExactly("test-tree-initial-load", 30)).to.be.true;
    });

    it("logs hierarchy level load metrics", async () => {
      const { result } = renderHook((props) => usePerformanceReporting(props), { initialProps });
      expect(result.current).to.not.be.undefined;

      result.current.onNodeLoaded?.({ node: "root", duration: 20 });
      result.current.onNodeLoaded?.({ node: "node", duration: 10 });

      expect(onPerformanceMeasuredSpy.callCount).to.be.eq(2);
      expect(onPerformanceMeasuredSpy.getCall(0).calledWithExactly("test-tree-initial-load", 20)).to.be.true;
      expect(onPerformanceMeasuredSpy.getCall(1).calledWithExactly("test-tree-hierarchy-level-load", 10)).to.be.true;
    });

    it("does not return `onNodeLoaded` when `onPerformanceMeasured` not passed", async () => {
      const { result } = renderHook((props) => usePerformanceReporting(props), { initialProps: { ...initialProps, onPerformanceMeasured: undefined } });
      expect(result.current).to.not.be.undefined;
      expect(result.current.onNodeLoaded).to.be.undefined;
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import { renderHook } from "@testing-library/react";
import { useInterval } from "../ui/hooks/useInterval";

describe("useInterval", () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it("should call interval's callback when timeout is reached", () => {
    const spy = sinon.spy();
    const delay = 100;
    renderHook(() => useInterval(spy, delay));

    // Advance clock by to the same number of tick as the internal delay
    clock.tick(delay);

    expect(spy.calledOnce).to.be.true;
  });

  it("should NOT call interval's callback when timeout has not been reached yet", () => {
    const spy = sinon.spy();
    renderHook(() => useInterval(spy, 100));

    // Advance clock by only 50 clicks, so interval should not have reached time out
    clock.tick(50);

    expect(spy.called).to.be.false;
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import { renderHook } from "@testing-library/react";
import { useCrossOriginPopup } from "../ui/hooks/useCrossOriginPopup";

describe("useCrossOriginPopup", () => {
  const fakeUrl = "https://test.com";
  const fakeTitle = "test";
  const fakeWidth = 100;
  const fakeHeight = 100;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  it("should open popup if initial visibility is 'ON'", () => {
    const spy = sinon.spy(window, "open");
    const onClosePopup = sinon.spy();
    const result = renderHook(() =>
      useCrossOriginPopup(
        true,
        fakeUrl,
        fakeTitle,
        fakeWidth,
        fakeHeight,
        onClosePopup
      )
    );
    result.result.current;

    expect(spy.calledOnce).to.be.true;
    expect(spy.calledWith(
      fakeUrl,
      fakeTitle,
      `width=${fakeWidth},height=${fakeHeight}`
    )).to.be.true;
  });

  it("should not open popup if initial visibility is 'OFF'", () => {
    const spy = sinon.spy(window, "open");
    const onClosePopup = sinon.spy();
    renderHook(() =>
      useCrossOriginPopup(
        false,
        fakeUrl,
        fakeTitle,
        fakeWidth,
        fakeHeight,
        onClosePopup
      )
    );

    expect(onClosePopup.called).to.be.false;
    expect(spy.called).to.be.false;
  });

  it("should open the popup after visibility change (OFF->ON)", () => {
    const spy = sinon.spy(window, "open");
    const onClosePopup = sinon.spy();
    let visible = false;
    const { rerender } = renderHook(() =>
      useCrossOriginPopup(
        visible,
        fakeUrl,
        fakeTitle,
        fakeWidth,
        fakeHeight,
        onClosePopup
      )
    );

    expect(spy.called).to.be.false;
    visible = true;
    rerender();

    expect(onClosePopup.called).to.be.false;
    expect(spy.calledWith(
      fakeUrl,
      fakeTitle,
      `width=${fakeWidth},height=${fakeHeight}`
    )).to.be.true;
  });

  it("should close popup when visibility change (ON->OFF)", () => {
    const close = sinon.spy();
    sinon.stub(window, "open").returns({
      focus: () => {},
      close,
      closed: false,
    } as unknown as Window);

    const onClosePopup = sinon.spy();
    let visible = true;
    const { rerender } = renderHook(() =>
      useCrossOriginPopup(
        visible,
        fakeUrl,
        fakeTitle,
        fakeWidth,
        fakeHeight,
        onClosePopup
      )
    );

    visible = false;
    rerender();

    expect(onClosePopup.calledOnce).to.be.true;
    expect(close.calledOnce).to.be.true;
  });

  it("should close popup when hook is unmounted", () => {
    const close = sinon.spy();
    sinon.stub(window, "open").returns({
      focus: () => {},
      close,
      closed: false,
    } as unknown as Window);
    const onClosePopup = sinon.spy();
    const visible = true;
    const result = renderHook(() =>
      useCrossOriginPopup(
        visible,
        fakeUrl,
        fakeTitle,
        fakeWidth,
        fakeHeight,
        onClosePopup
      )
    );

    result.unmount();

    expect(onClosePopup.calledOnce).to.be.true;
    expect(close.calledOnce).to.be.true;
  });

  it("should call the 'onClose' callback when the popup is closed by the end-user", () => {
    sinon.stub(window, "open").returns({
      focus: () => {},
      close: sinon.spy(),
      closed: true,
    } as unknown as Window);
    const onClosePopup = sinon.spy();
    const visible = true;
    renderHook(() =>
      useCrossOriginPopup(
        visible,
        fakeUrl,
        fakeTitle,
        fakeWidth,
        fakeHeight,
        onClosePopup
      )
    );

    clock.tick(2000);

    expect(onClosePopup.calledOnce).to.be.true;
  });

  it("should call the 'onClose' callback when the parent's browser window get closed", () => {
    sinon.stub(window, "open").returns({
      focus: () => {},
      close: () => {},
      closed: true,
    } as unknown as Window);

    const onClosePopup = sinon.spy();
    const visible = true;
    renderHook(() =>
      useCrossOriginPopup(
        visible,
        fakeUrl,
        fakeTitle,
        fakeWidth,
        fakeHeight,
        onClosePopup
      )
    );

    window.onbeforeunload?.(new Event("beforeunload"));

    expect(onClosePopup.calledOnce).to.be.true;
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { renderHook } from "@testing-library/react";
import { useCrossOriginPopup } from "../../src/ui/hooks/useCrossOriginPopup";

describe("useCrossOriginPopup", () => {
  const fakeUrl = "https://test.com";
  const fakeTitle = "test";
  const fakeWidth = 100;
  const fakeHeight = 100;

  it("should open popup if initial visibility is 'ON'", () => {
    const spy = vi.spyOn(window, "open");
    const onClosePopup = vi.fn();
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

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      fakeUrl,
      fakeTitle,
      `width=${fakeWidth},height=${fakeHeight}`
    );
  });

  it("should not open popup if initial visibility is 'OFF'", () => {
    const spy = vi.spyOn(window, "open");
    const onClosePopup = vi.fn();
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

    // Popup has never been opened, so close callback should not have been called.
    expect(onClosePopup).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  it("should open the popup after visibility change (OFF->ON)", () => {
    const spy = vi.spyOn(window, "open");
    const onClosePopup = vi.fn();
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

    expect(spy).not.toHaveBeenCalled();
    visible = true;
    rerender();

    // Popup should be still opened, and 'OnClose'' callback should not have been called.
    expect(onClosePopup).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(
      fakeUrl,
      fakeTitle,
      `width=${fakeWidth},height=${fakeHeight}`
    );
  });

  it("should close popup when visibility change (ON->OFF)", () => {
    const close = vi.fn();
    vi.spyOn(window, "open").mockReturnValue({
      focus: () => {},
      close,
      closed: false,
    } as unknown as Window);

    const onClosePopup = vi.fn();
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

    // Popup should be now closed and 'OnClose' been called.
    expect(onClosePopup).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("should close popup when hook is unmounted", () => {
    const close = vi.fn();
    vi.spyOn(window, "open").mockReturnValue({
      focus: () => {},
      close,
      closed: false,
    } as unknown as Window);
    const onClosePopup = vi.fn();
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

    // Popup should be still open, so close callback should not have been called.
    expect(onClosePopup).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("should call the 'onClose' callback when the popup is closed by the end-user", () => {
    vi.useFakeTimers();

    vi.spyOn(window, "open").mockReturnValue({
      focus: () => {},
      close: vi.fn(),
      closed: true, // Mark it as already 'closed' to simulate user-user closing immediately the popup window
    } as unknown as Window);
    const onClosePopup = vi.fn();
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

    // Advance clocks, so popup's internal timer has time to check for popup closure
    vi.advanceTimersByTime(2000);

    // Popup was closed by end-user, the 'onClose' callback should have been called.
    expect(onClosePopup).toHaveBeenCalledOnce();
  });

  it("should call the 'onClose' callback when the parent's browser window get closed", () => {
    vi.spyOn(window, "open").mockReturnValue({
      focus: () => {},
      close: () => {},
      closed: true, // Mark it as already 'closed' to simulate user-user closing immediately the popup window
    } as unknown as Window);

    const onClosePopup = vi.fn();
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

    // We simulated that parent window has been closed, the 'onClose' callback should have been called.
    expect(onClosePopup).toHaveBeenCalledOnce();
  });
});
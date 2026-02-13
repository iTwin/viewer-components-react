/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WidgetHeader } from "../components/utils";

describe("Widget Header Component", function () {
  it("should have hello as title", function () {
    const { container } = render(<WidgetHeader title="hello" />);
    expect(screen.getByText("hello")).toBeDefined();
    expect(container.firstChild).toHaveClass("oclca-widget-header-container");
    expect(container.firstChild?.firstChild).toHaveClass("oclca-title");
  });

  it("with return function", function () {
    const { container } = render(<WidgetHeader title="hello" returnFn={async () => {}} />);
    expect(container.firstChild?.firstChild).toHaveClass("oclca-chevron");
    expect(container.firstChild?.firstChild).not.toHaveClass("oclca-chevron-disabled");
  });

  it("with disabled", function () {
    const { container } = render(<WidgetHeader title="hello" disabled={true} returnFn={async () => {}} />);
    expect(container.firstChild?.firstChild).not.toHaveClass("oclca-chevron");
    expect(container.firstChild?.firstChild).toHaveClass("oclca-chevron-disabled");
  });

  it("with mocked return function", function () {
    const mockReturnFn = vi.fn();
    const { container } = render(<WidgetHeader title="hello" returnFn={mockReturnFn} />);

    const toTestElement = container.querySelector("SvgChevronLeft");
    if (toTestElement !== null) {
      fireEvent.click(toTestElement);
    }
    expect(mockReturnFn).toHaveBeenCalled;
  });
});

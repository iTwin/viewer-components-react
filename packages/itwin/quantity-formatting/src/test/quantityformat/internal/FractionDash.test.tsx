/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, vi, expect } from "vitest";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FormatProps } from "@itwin/core-quantity";
import { FractionDash } from "../../../components/quantityformat/internal/FractionDash.js";

describe("FractionDash", () => {
  const defaultFormatProps: FormatProps = {
    type: "fractional",
    precision: 4,
  };

  it("should render with default unchecked state", () => {
    const onChange = vi.fn();
    render(<FractionDash formatProps={defaultFormatProps} onChange={onChange} />);

    expect(screen.getByText("labels.fractionDashLabel")).toBeTruthy();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("should render checked when fractionDash trait is set", () => {
    const formatPropsWithTrait: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["fractionDash"],
    };
    const onChange = vi.fn();
    render(<FractionDash formatProps={formatPropsWithTrait} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("should call onChange when checkbox is checked", () => {
    const onChange = vi.fn();
    render(<FractionDash formatProps={defaultFormatProps} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultFormatProps,
      formatTraits: ["fractionDash"],
    });
  });

  it("should call onChange when checkbox is unchecked", () => {
    const formatPropsWithTrait: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["fractionDash", "showTrailingZeros"],
    };
    const onChange = vi.fn();
    render(<FractionDash formatProps={formatPropsWithTrait} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      ...formatPropsWithTrait,
      formatTraits: ["showTrailingZeros"],
    });
  });

  it("should handle string formatTraits", () => {
    const formatPropsWithStringTraits: FormatProps = {
      ...defaultFormatProps,
      formatTraits: "fractionDash,showTrailingZeros",
    };
    const onChange = vi.fn();
    render(<FractionDash formatProps={formatPropsWithStringTraits} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("should maintain existing traits when adding fractionDash", () => {
    const formatPropsWithExistingTraits: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["showTrailingZeros", "keepSingleZero"],
    };
    const onChange = vi.fn();
    render(<FractionDash formatProps={formatPropsWithExistingTraits} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      ...formatPropsWithExistingTraits,
      formatTraits: ["showTrailingZeros", "keepSingleZero", "fractionDash"],
    });
  });

  it("should not call onChange when onChange prop is not provided", () => {
    render(<FractionDash formatProps={defaultFormatProps} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    // Should not throw error and should render without issues
    expect(screen.getByText("labels.fractionDashLabel")).toBeTruthy();
  });
});

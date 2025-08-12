/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, vi, expect } from "vitest";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FormatProps } from "@itwin/core-quantity";
import { FormatPrecision } from "../../../components/quantityformat/internal/FormatPrecision.js";

describe("FormatPrecision", () => {
  const defaultDecimalFormatProps: FormatProps = {
    type: "decimal",
    precision: 2,
  };

  const defaultFractionalFormatProps: FormatProps = {
    type: "fractional",
    precision: 4,
  };

  it("should render with decimal precision selector for decimal format", () => {
    const onChange = vi.fn();
    render(<FormatPrecision formatProps={defaultDecimalFormatProps} onChange={onChange} />);

    expect(screen.getByText("QuantityFormat.labels.precision")).toBeTruthy();
  });

  it("should render with fractional precision selector for fractional format", () => {
    const onChange = vi.fn();
    render(<FormatPrecision formatProps={defaultFractionalFormatProps} onChange={onChange} />);

    expect(screen.getByText("QuantityFormat.labels.precision")).toBeTruthy();
  });

  it("should call onChange when decimal precision is changed", () => {
    const onChange = vi.fn();
    render(<FormatPrecision formatProps={defaultDecimalFormatProps} onChange={onChange} />);

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "4" } });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultDecimalFormatProps,
      precision: 4,
    });
  });

  it("should call onChange when fractional precision is changed", () => {
    const onChange = vi.fn();
    render(<FormatPrecision formatProps={defaultFractionalFormatProps} onChange={onChange} />);

    const selector = screen.getByRole("combobox");
    fireEvent.change(selector, { target: { value: "8" } });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultFractionalFormatProps,
      precision: 8,
    });
  });

  it("should handle precision change with different values", () => {
    const onChange = vi.fn();
    render(<FormatPrecision formatProps={defaultDecimalFormatProps} onChange={onChange} />);

    const input = screen.getByRole("spinbutton");

    // Test multiple precision changes
    fireEvent.change(input, { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith({
      ...defaultDecimalFormatProps,
      precision: 0,
    });

    fireEvent.change(input, { target: { value: "6" } });
    expect(onChange).toHaveBeenCalledWith({
      ...defaultDecimalFormatProps,
      precision: 6,
    });
  });

  it("should not call onChange when onChange prop is not provided", () => {
    render(<FormatPrecision formatProps={defaultDecimalFormatProps} />);

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "4" } });

    // Should not throw error and should render without issues
    expect(screen.getByText("QuantityFormat.labels.precision")).toBeTruthy();
  });

  it("should handle undefined precision in formatProps", () => {
    const formatPropsWithoutPrecision: FormatProps = {
      type: "decimal",
    };
    const onChange = vi.fn();
    render(<FormatPrecision formatProps={formatPropsWithoutPrecision} onChange={onChange} />);

    const input = screen.getByLabelText("QuantityFormat.labels.precision") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3" } });

    expect(onChange).toHaveBeenCalledWith({
      ...formatPropsWithoutPrecision,
      precision: 3,
    });
  });
});

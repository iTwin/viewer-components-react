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

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.click(input);
    const button = screen.getByText('QuantityFormat.decimal_precision.four');
    fireEvent.click(button);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultDecimalFormatProps,
      precision: 4,
    });
  });

  it("should call onChange when fractional precision is changed", () => {
    const onChange = vi.fn();
    render(<FormatPrecision formatProps={defaultFractionalFormatProps} onChange={onChange} />);

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.click(input);
    const button = screen.getByText('QuantityFormat.fraction_precision.eighth');
    fireEvent.click(button);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultFractionalFormatProps,
      precision: 8,
    });
  });

  it("should handle precision change with different values", () => {
    const onChange = vi.fn();
    render(<FormatPrecision formatProps={defaultDecimalFormatProps} onChange={onChange} />);

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.click(input);
    // Test multiple precision changes
    const button = screen.getByText('QuantityFormat.decimal_precision.zero');
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith({
      ...defaultDecimalFormatProps,
      precision: 0,
    });
    fireEvent.click(input);
    const button2 = screen.getByText('QuantityFormat.decimal_precision.six');
    fireEvent.click(button2);
    expect(onChange).toHaveBeenCalledWith({
      ...defaultDecimalFormatProps,
      precision: 6,
    });
  });

  it("should handle undefined precision in formatProps", () => {
    const formatPropsWithoutPrecision: FormatProps = {
      type: "decimal",
    };
    const onChange = vi.fn();
    render(<FormatPrecision formatProps={formatPropsWithoutPrecision} onChange={onChange} />);

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.click(input);
    const button = screen.getByText('QuantityFormat.decimal_precision.three');
    fireEvent.click(button);

    expect(onChange).toHaveBeenCalledWith({
      ...formatPropsWithoutPrecision,
      precision: 3,
    });
  });
});

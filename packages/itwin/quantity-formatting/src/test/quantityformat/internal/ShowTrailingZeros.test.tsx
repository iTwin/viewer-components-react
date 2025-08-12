/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, vi, expect } from "vitest";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FormatProps } from "@itwin/core-quantity";
import { ShowTrailingZeros } from "../../../components/quantityformat/internal/ShowTrailingZeros.js";

describe("ShowTrailingZeros", () => {
  const defaultFormatProps: FormatProps = {
    type: "decimal",
    precision: 2,
  };

  it("should render with default unchecked state", () => {
    const onChange = vi.fn();
    render(<ShowTrailingZeros formatProps={defaultFormatProps} onChange={onChange} />);

    expect(screen.getByText("QuantityFormat:labels.showTrailZerosLabel")).toBeTruthy();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBeFalsy();
  });

  it("should render checked when showTrailingZeros trait is set", () => {
    const formatPropsWithTrait: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["trailZeroes"],
    };
    const onChange = vi.fn();
    render(<ShowTrailingZeros formatProps={formatPropsWithTrait} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBeTruthy();
  });

  it("should call onChange when checkbox is checked", () => {
    const onChange = vi.fn();
    render(<ShowTrailingZeros formatProps={defaultFormatProps} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultFormatProps,
      formatTraits: ["trailZeroes"],
    });
  });

  it("should call onChange when checkbox is unchecked", () => {
    const formatPropsWithTrait: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["trailZeroes", "use1000Separator"],
    };
    const onChange = vi.fn();
    render(<ShowTrailingZeros formatProps={formatPropsWithTrait} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      ...formatPropsWithTrait,
      formatTraits: ["use1000Separator"],
    });
  });

  it("should be disabled when disabled prop is true", () => {
    const onChange = vi.fn();
    render(<ShowTrailingZeros formatProps={defaultFormatProps} onChange={onChange} disabled={true} />);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.disabled).toBeTruthy();
  });

  it("should not be disabled when disabled prop is false", () => {
    const onChange = vi.fn();
    render(<ShowTrailingZeros formatProps={defaultFormatProps} onChange={onChange} disabled={false} />);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.disabled).toBeFalsy();
  });

  it("should handle string formatTraits", () => {
    const formatPropsWithStringTraits: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["trailZeroes", "use1000Separator"],
    };
    const onChange = vi.fn();
    render(<ShowTrailingZeros formatProps={formatPropsWithStringTraits} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBeTruthy();
  });

  it("should not call onChange when onChange prop is not provided", () => {
    render(<ShowTrailingZeros formatProps={defaultFormatProps} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    // Should not throw error and should render without issues
    expect(screen.getByText("QuantityFormat:labels.showTrailZerosLabel")).toBeTruthy();
  });
});

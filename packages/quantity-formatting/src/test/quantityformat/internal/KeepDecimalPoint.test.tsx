/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, vi, expect } from "vitest";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FormatProps } from "@itwin/core-quantity";
import { KeepDecimalPoint } from "../../../components/quantityformat/internal/KeepDecimalPoint.js";

describe("KeepDecimalPoint", () => {
  const defaultFormatProps: FormatProps = {
    type: "decimal",
    precision: 2,
  };

  it("should render with default unchecked state", () => {
    const onChange = vi.fn();
    render(<KeepDecimalPoint formatProps={defaultFormatProps} onChange={onChange} />);

    expect(screen.getByText("labels.keepDecimalPointLabel")).toBeTruthy();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("should render checked when keepDecimalPoint trait is set", () => {
    const formatPropsWithTrait: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["keepDecimalPoint"],
    };
    const onChange = vi.fn();
    render(<KeepDecimalPoint formatProps={formatPropsWithTrait} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("should call onChange when checkbox is checked", () => {
    const onChange = vi.fn();
    render(<KeepDecimalPoint formatProps={defaultFormatProps} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultFormatProps,
      formatTraits: ["keepDecimalPoint"],
    });
  });

  it("should call onChange when checkbox is unchecked", () => {
    const formatPropsWithTrait: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["keepDecimalPoint", "showTrailingZeros"],
    };
    const onChange = vi.fn();
    render(<KeepDecimalPoint formatProps={formatPropsWithTrait} onChange={onChange} />);

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
      formatTraits: "keepDecimalPoint,showTrailingZeros",
    };
    const onChange = vi.fn();
    render(<KeepDecimalPoint formatProps={formatPropsWithStringTraits} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

});

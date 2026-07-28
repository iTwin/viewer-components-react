/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, vi, expect } from "vitest";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FormatProps } from "@itwin/core-quantity";
import { ZeroEmpty } from "../../../components/quantityformat/internal/ZeroEmpty.js";

describe("ZeroEmpty", () => {
  const defaultFormatProps: FormatProps = {
    type: "decimal",
    precision: 2,
  };

  it("should render with default unchecked state", () => {
    const onChange = vi.fn();
    render(<ZeroEmpty formatProps={defaultFormatProps} onChange={onChange} />);

    expect(screen.getByText("labels.zeroEmptyLabel")).toBeTruthy();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("should render checked when zeroEmpty trait is set", () => {
    const formatPropsWithTrait: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["zeroEmpty"],
    };
    const onChange = vi.fn();
    render(<ZeroEmpty formatProps={formatPropsWithTrait} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("should call onChange when checkbox is checked", () => {
    const onChange = vi.fn();
    render(<ZeroEmpty formatProps={defaultFormatProps} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultFormatProps,
      formatTraits: ["zeroEmpty"],
    });
  });

  it("should call onChange when checkbox is unchecked", () => {
    const formatPropsWithTrait: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["zeroEmpty", "showTrailingZeros"],
    };
    const onChange = vi.fn();
    render(<ZeroEmpty formatProps={formatPropsWithTrait} onChange={onChange} />);

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
      formatTraits: "zeroEmpty,showTrailingZeros",
    };
    const onChange = vi.fn();
    render(<ZeroEmpty formatProps={formatPropsWithStringTraits} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

});

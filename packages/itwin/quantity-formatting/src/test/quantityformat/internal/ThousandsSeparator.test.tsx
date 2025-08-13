/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, vi, expect } from "vitest";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FormatProps } from "@itwin/core-quantity";
import { UseThousandsSeparator, ThousandsSeparatorSelector } from "../../../components/quantityformat/internal/ThousandsSeparator.js";

describe("UseThousandsSeparator", () => {
  const defaultFormatProps: FormatProps = {
    type: "decimal",
    precision: 2,
  };

  it("should render with default unchecked state", () => {
    const onChange = vi.fn();
    const renderedComponent = render(<UseThousandsSeparator formatProps={defaultFormatProps} onChange={onChange} />);

    expect(renderedComponent.getByLabelText("labels.useThousandSeparatorLabel")).toBeTruthy();
    const checkbox = renderedComponent.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBeFalsy();
  });

  it("should render checked when use1000Separator trait is set", () => {
    const formatPropsWithTrait: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["use1000Separator"],
    };
    const onChange = vi.fn();
    render(<UseThousandsSeparator formatProps={formatPropsWithTrait} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBeTruthy();
  });

  it("should call onChange when checkbox is checked", () => {
    const onChange = vi.fn();
    render(<UseThousandsSeparator formatProps={defaultFormatProps} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultFormatProps,
      formatTraits: ["use1000Separator"],
    });
  });

  it("should call onChange when checkbox is unchecked", () => {
    const formatPropsWithTrait: FormatProps = {
      ...defaultFormatProps,
      formatTraits: ["use1000Separator", "showTrailingZeros"],
      thousandSeparator: ",",
    };
    const onChange = vi.fn();
    render(<UseThousandsSeparator formatProps={formatPropsWithTrait} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      ...formatPropsWithTrait,
      formatTraits: ["showTrailingZeros"],
    });
  });
});

describe("ThousandsSeparatorSelector", () => {
  const formatPropsWithThousands: FormatProps = {
    type: "decimal",
    precision: 2,
    formatTraits: ["use1000Separator"],
    thousandSeparator: ",",
  };

  it("should render thousands separator selector", () => {
      const formatProps: FormatProps = {
        type: "decimal",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <UseThousandsSeparator
          formatProps={formatProps}
          onChange={onFormatChange}
        />
      );

      expect(
        renderedComponent.getByLabelText(
          "labels.useThousandSeparatorLabel"
        )
      ).to.exist;
  });

  it("should not render when use1000Separator trait is not set", () => {
    const formatPropsWithoutThousands: FormatProps = {
      type: "decimal",
      precision: 2,
    };
    const onChange = vi.fn();
    const { container } = render(<ThousandsSeparatorSelector formatProps={formatPropsWithoutThousands} onChange={onChange} />);

    expect(container.firstChild).toBeNull();
  });

  it("should adjust decimal separator when thousands separator conflicts", () => {
      const formatProps: FormatProps = {
        type: "decimal",
        precision: 2,
        formatTraits: ["use1000Separator"],
        thousandSeparator: ",",
        decimalSeparator: ".",
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <ThousandsSeparatorSelector
          formatProps={formatProps}
          onChange={onFormatChange}
        />
      );

      screen.debug()
      const selector = renderedComponent.getByRole("combobox");
      fireEvent.click(selector);

      // Test selecting period (.) which should change decimal separator to comma
      const periodOption = renderedComponent.getByRole("option", {
        name: "thousand_separator.point",
      });
      fireEvent.click(periodOption);

      expect(onFormatChange).toHaveBeenCalledWith({
        ...formatProps,
        thousandSeparator: ".",
        decimalSeparator: ",", // Should change to avoid conflict
      });
  });
});

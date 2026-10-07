/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import type { FormatProps } from "@itwin/core-quantity";
import { DecimalSeparator } from "../../../components/quantityformat/internal/DecimalSeparator.js";

describe("DecimalSeparator", () => {
  const rnaDescriptorToRestore = Object.getOwnPropertyDescriptor(
    IModelApp,
    "requestNextAnimation"
  )!;
  function requestNextAnimation() {}

  beforeEach(async () => {
    Object.defineProperty(IModelApp, "requestNextAnimation", {
      get: () => requestNextAnimation,
    });
    await NoRenderApp.startup();
  });

  afterEach(async () => {
    await IModelApp.shutdown();
    Object.defineProperty(
      IModelApp,
      "requestNextAnimation",
      rnaDescriptorToRestore
    );
  });

  it("should render with default decimal separator", async () => {
    const formatProps: FormatProps = {
      type: "decimal",
      precision: 2,
    };
    const onChange = vi.fn();

    const renderedComponent = render(
      <DecimalSeparator formatProps={formatProps} onChange={onChange} />
    );

    expect(
      renderedComponent.getByText("labels.decimalSeparatorLabel")
    ).toBeTruthy();
    expect(
      renderedComponent.getByText("decimal_separator.point")
    ).toBeTruthy();
  });

  it("should render with specified decimal separator", async () => {
    const formatProps: FormatProps = {
      type: "decimal",
      precision: 2,
      decimalSeparator: ",",
    };
    const onChange = vi.fn();

    const renderedComponent = render(
      <DecimalSeparator formatProps={formatProps} onChange={onChange} />
    );

    expect(
      renderedComponent.getByText("labels.decimalSeparatorLabel")
    ).toBeTruthy();
    expect(
      renderedComponent.getByText("decimal_separator.comma")
    ).toBeTruthy();
  });

  it("should switch the thousands separator when the decimal separator collides with it", () => {
    const formatProps: FormatProps = { type: "decimal", precision: 2, formatTraits: ["Use1000Separator"], thousandSeparator: ",", decimalSeparator: "." };
    const onChange = vi.fn();
    render(<DecimalSeparator formatProps={formatProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "decimal_separator.comma" }));

    expect(onChange).toHaveBeenCalledWith({ ...formatProps, decimalSeparator: ",", thousandSeparator: "." });
  });

  it("should keep the separators distinct even while the thousands separator is disabled", () => {
    const formatProps: FormatProps = { type: "decimal", precision: 2 };
    const onChange = vi.fn();
    render(<DecimalSeparator formatProps={formatProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "decimal_separator.comma" }));

    expect(onChange).toHaveBeenCalledWith({ ...formatProps, decimalSeparator: ",", thousandSeparator: "." });
  });

  it("should not replace a non-conflicting thousands separator", () => {
    const formatProps: FormatProps = { type: "decimal", precision: 2, formatTraits: ["use1000Separator"], thousandSeparator: " ", decimalSeparator: "." };
    const onChange = vi.fn();
    render(<DecimalSeparator formatProps={formatProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "decimal_separator.comma" }));

    expect(onChange).toHaveBeenCalledWith({ ...formatProps, decimalSeparator: "," });
  });
});

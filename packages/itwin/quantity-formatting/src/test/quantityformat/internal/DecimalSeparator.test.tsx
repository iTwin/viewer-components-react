/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
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
      renderedComponent.getByText("QuantityFormat.labels.decimalSeparatorLabel")
    ).to.exist;
    expect(
      renderedComponent.getByText("QuantityFormat.decimal_separator.point")
    ).to.exist;
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
      renderedComponent.getByText("QuantityFormat.labels.decimalSeparatorLabel")
    ).to.exist;
    expect(
      renderedComponent.getByText("QuantityFormat.decimal_separator.comma")
    ).to.exist;
  });
});

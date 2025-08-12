/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render, within } from "@testing-library/react";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import type { FormatProps } from "@itwin/core-quantity";
import { ShowSignOption } from "@itwin/core-quantity";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignOption } from "../../../components/quantityformat/internal/SignOption.js";

describe("SignOption", () => {
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

  it("should render with default showSignOption", async () => {
    const formatProps: FormatProps = {
      type: "decimal",
    };
    const onChange = vi.fn();

    const renderedComponent = render(
      <SignOption formatProps={formatProps} onChange={onChange} />
    );

    expect(
      renderedComponent.getByText("QuantityFormat:sign_option.onlyNegative")
    ).to.exist;
  });

  it("should render with specified showSignOption", async () => {
    const formatProps: FormatProps = {
      type: "decimal",
      showSignOption: ShowSignOption.SignAlways,
    };
    const onChange = vi.fn();

    const renderedComponent = render(
      <SignOption formatProps={formatProps} onChange={onChange} />
    );

    expect(
      renderedComponent.getByText("QuantityFormat:labels.signOptionLabel")
    ).to.exist;
    expect(
      renderedComponent.getByText("QuantityFormat:sign_option.signAlways")
    ).to.exist;
  });
});

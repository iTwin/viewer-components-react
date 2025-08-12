/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, beforeEach, it, vi, expect } from "vitest";
import * as React from "react";
import { render, waitFor } from "@testing-library/react";
import type { FormatProps, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import { BearingPrimaryChildren, BearingSecondaryChildren } from "../../../components/quantityformat/panels/Bearing.js";
import { IModelApp } from "@itwin/core-frontend";

describe("Bearing Panel", () => {
  let unitsProvider: UnitsProvider;
  let persistenceUnit: UnitProps;

  beforeEach(async () => {
    unitsProvider = IModelApp.quantityFormatter.unitsProvider;
    persistenceUnit = await unitsProvider.findUnitByName("Units.ARC_DEG");
  });

  describe("BearingPrimaryChildren", () => {
    it("should render bearing primary children with correct format type", async () => {
      const formatProps: FormatProps = {
        type: "bearing",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <BearingPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByLabelText("QuantityFormat.labels.type")).toBeTruthy();
      expect(renderedComponent.getByLabelText("QuantityFormat.labels.precision")).toBeTruthy();
    });

    it("should render unit controls", async () => {
      const formatProps: FormatProps = {
        type: "bearing",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <BearingPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByText("QuantityFormat.labels.units")).toBeTruthy();
    });
  });

  describe("BearingSecondaryChildren", () => {
    it("should render secondary children with bearing-specific options", async () => {
      const formatProps: FormatProps = {
        type: "bearing",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <BearingSecondaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByText("QuantityFormat.labels.decimalSeparatorLabel")).toBeTruthy();
      expect(renderedComponent.getByText("QuantityFormat.labels.keepDecimalPointLabel")).toBeTruthy();
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, beforeEach, it, vi, expect } from "vitest";
import * as React from "react";
import { render, waitFor } from "@testing-library/react";
import type { FormatProps, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import { AzimuthPrimaryChildren, AzimuthSecondaryChildren } from "../../../components/quantityformat/panels/Azimuth.js";
import { IModelApp } from "@itwin/core-frontend";

describe("Azimuth Panel", () => {
  let unitsProvider: UnitsProvider;
  let persistenceUnit: UnitProps;

  beforeEach(async () => {
    unitsProvider = IModelApp.quantityFormatter.unitsProvider;
    persistenceUnit = await unitsProvider.findUnitByName("Units.ARC_DEG");
  });

  describe("AzimuthPrimaryChildren", () => {
    it("should render primary children with format type", async () => {
      const formatProps: FormatProps = {
        type: "azimuth",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <AzimuthPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByLabelText("QuantityFormat:labels.type")).toBeTruthy();
      expect(renderedComponent.getByLabelText("QuantityFormat:labels.precision")).toBeTruthy();
    });

    it("should render unit label controls when showUnitLabel is enabled", async () => {
      const formatProps: FormatProps = {
        type: "azimuth",
        formatTraits: ["showUnitLabel"],
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <AzimuthPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      await waitFor(() => {
        expect(renderedComponent.getByLabelText("QuantityFormat:labels.labelSeparator")).toBeTruthy();
      });
    });
  });

  describe("AzimuthSecondaryChildren", () => {
    it("should render secondary children with azimuth-specific options", async () => {
      const formatProps: FormatProps = {
        type: "azimuth",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <AzimuthSecondaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByLabelText("QuantityFormat:labels.signOptionLabel")).toBeTruthy();
      expect(renderedComponent.getByText("QuantityFormat:labels.decimalSeparatorLabel")).toBeTruthy();
    });
  });
});

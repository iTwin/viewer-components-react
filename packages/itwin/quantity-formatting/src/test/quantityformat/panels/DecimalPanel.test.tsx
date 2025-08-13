/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, beforeEach, it, vi, expect } from "vitest";
import * as React from "react";
import { render, waitFor } from "@testing-library/react";
import type { FormatProps, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import { DecimalPrimaryChildren, DecimalSecondaryChildren } from "../../../components/quantityformat/panels/Decimal.js";
import { IModelApp } from "@itwin/core-frontend";

describe("Decimal Panel", () => {
  let unitsProvider: UnitsProvider;
  let persistenceUnit: UnitProps;

  beforeEach(async () => {
    unitsProvider = IModelApp.quantityFormatter.unitsProvider;
    persistenceUnit = await unitsProvider.findUnitByName("Units.M");
  });

  describe("DecimalPrimaryChildren", () => {
    it("should render primary children with format type", async () => {
      const formatProps: FormatProps = {
        type: "decimal",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <DecimalPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );
      expect(renderedComponent.getByLabelText("labels.type")).to
        .exist;
      expect(
        renderedComponent.getByLabelText("labels.precision")
      ).to.exist;
    });

    it("should render unit label controls when showUnitLabel is enabled", async () => {
      const formatProps: FormatProps = {
        type: "decimal",
        formatTraits: ["showUnitLabel"],
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <DecimalPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      await waitFor(() => {
        expect(renderedComponent.getByLabelText("labels.labelSeparator")).toBeTruthy();
      });
    });
  });

  describe("DecimalSecondaryChildren", () => {
    it("should render secondary children with format options", async () => {
      const formatProps: FormatProps = {
        type: "decimal",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <DecimalSecondaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByText("labels.signOptionLabel")).toBeTruthy();
      expect(renderedComponent.getByText("labels.decimalSeparatorLabel")).toBeTruthy();
    });
  });
});

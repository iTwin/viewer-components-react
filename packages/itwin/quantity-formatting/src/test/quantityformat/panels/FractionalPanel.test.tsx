/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, beforeEach, it, vi, expect } from "vitest";
import * as React from "react";
import { render, waitFor } from "@testing-library/react";
import type { FormatProps, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import { FractionalPrimaryChildren, FractionalSecondaryChildren } from "../../../components/quantityformat/panels/Fractional.js";
import { IModelApp } from "@itwin/core-frontend";

describe("Fractional Panel", () => {
  let unitsProvider: UnitsProvider;
  let persistenceUnit: UnitProps;
  beforeEach(async () => {
    unitsProvider = IModelApp.quantityFormatter.unitsProvider;
    persistenceUnit = await unitsProvider.findUnitByName("Units.M");
  });
  describe("FractionalPrimaryChildren", () => {
    it("should render primary children with format type", async () => {
      const formatProps: FormatProps = {
        type: "fractional",
        precision: 4,
      };
      const onFormatChange = vi.fn();
      const renderedComponent = render(
        <FractionalPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );
      expect(renderedComponent.getByLabelText("QuantityFormat.labels.type")).to.exist;
      expect(renderedComponent.getByText("QuantityFormat.labels.precision")).to.exist;
    });
    it("should render unit label controls when showUnitLabel is enabled", async () => {
      const formatProps: FormatProps = {
        type: "fractional",
        formatTraits: ["showUnitLabel"],
      };
      const onFormatChange = vi.fn();
      const renderedComponent = render(
        <FractionalPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );
      await waitFor(() => {
        expect(renderedComponent.getByLabelText("QuantityFormat.labels.labelSeparator")).to.exist;
      });
    });
  });
  describe("FractionalSecondaryChildren", () => {
    it("should render secondary children with format type", async () => {
      const formatProps: FormatProps = {
        type: "fractional",
        precision: 4,
      };
      const onFormatChange = vi.fn();
      const renderedComponent = render(
        <FractionalSecondaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );
      expect(renderedComponent.getByLabelText("QuantityFormat.labels.signOptionLabel")).to.exist;
      expect(renderedComponent.getByLabelText("QuantityFormat.labels.fractionDashLabel")).to.exist;
    });
  });
});

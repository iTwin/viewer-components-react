/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, beforeEach, it, vi, expect } from "vitest";
import * as React from "react";
import { render, waitFor } from "@testing-library/react";
import type { FormatProps, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import { ScientificPrimaryChildren, ScientificSecondaryChildren } from "../../../components/quantityformat/panels/Scientific.js";
import { IModelApp } from "@itwin/core-frontend";

describe("Scientific Panel", () => {
  let unitsProvider: UnitsProvider;
  let persistenceUnit: UnitProps;

  beforeEach(async () => {
    unitsProvider = IModelApp.quantityFormatter.unitsProvider;
    persistenceUnit = await unitsProvider.findUnitByName("Units.M");
  });

  describe("ScientificPrimaryChildren", () => {
    it("should render primary children with format type", async () => {
      const formatProps: FormatProps = {
        type: "scientific",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <ScientificPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByLabelText("QuantityFormat.labels.type")).toBeTruthy();
      expect(renderedComponent.getByLabelText("QuantityFormat.labels.precision")).toBeTruthy();
    });

    it("should render scientific type selector", async () => {
      const formatProps: FormatProps = {
        type: "scientific",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <ScientificPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByLabelText("QuantityFormat.labels.scientificTypeLabel")).toBeTruthy();
    });

    it("should render unit label controls when showUnitLabel is enabled", async () => {
      const formatProps: FormatProps = {
        type: "scientific",
        formatTraits: ["showUnitLabel"],
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <ScientificPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      await waitFor(() => {
        expect(renderedComponent.getByLabelText("QuantityFormat.labels.labelSeparator")).toBeTruthy();
      });
    });
  });

  describe("ScientificSecondaryChildren", () => {
    it("should render secondary children with scientific-specific options", async () => {
      const formatProps: FormatProps = {
        type: "scientific",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <ScientificSecondaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByLabelText("QuantityFormat.labels.signOptionLabel")).toBeTruthy();
      expect(renderedComponent.getByLabelText("QuantityFormat.labels.decimalSeparatorLabel")).toBeTruthy();
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, beforeEach, it, vi, expect } from "vitest";
import * as React from "react";
import { render, waitFor } from "@testing-library/react";
import type { FormatProps, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import { StationPrimaryChildren, StationSecondaryChildren } from "../../../components/quantityformat/panels/Station.js";
import { IModelApp } from "@itwin/core-frontend";

describe("Station Panel", () => {
  let unitsProvider: UnitsProvider;
  let persistenceUnit: UnitProps;

  beforeEach(async () => {
    unitsProvider = IModelApp.quantityFormatter.unitsProvider;
    persistenceUnit = await unitsProvider.findUnitByName("Units.M");
  });

  describe("StationPrimaryChildren", () => {
    it("should render primary children with format type", async () => {
      const formatProps: FormatProps = {
        type: "station",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <StationPrimaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByLabelText("QuantityFormat.labels.type")).toBeTruthy();
      expect(renderedComponent.getByLabelText("QuantityFormat.labels.precision")).toBeTruthy();
    });

    it("should render station separator selector", async () => {
      const formatProps: FormatProps = {
        type: "station",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <StationSecondaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByText("QuantityFormat.labels.stationSeparatorLabel")).toBeTruthy();
    });

    it("should render station offset controls", async () => {
      const formatProps: FormatProps = {
        type: "station",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <StationSecondaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByText("QuantityFormat.labels.stationOffsetLabel")).toBeTruthy();
    });

    it("should render unit label controls when showUnitLabel is enabled", async () => {
      const formatProps: FormatProps = {
        type: "station",
        formatTraits: ["showUnitLabel"],
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <StationPrimaryChildren
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

  describe("StationSecondaryChildren", () => {
    it("should render secondary children with station-specific options", async () => {
      const formatProps: FormatProps = {
        type: "station",
        precision: 2,
      };
      const onFormatChange = vi.fn();

      const renderedComponent = render(
        <StationSecondaryChildren
          formatProps={formatProps}
          onFormatChange={onFormatChange}
          unitsProvider={unitsProvider}
          persistenceUnit={persistenceUnit}
        />
      );

      expect(renderedComponent.getByLabelText("QuantityFormat.labels.signOptionLabel")).toBeTruthy();
      expect(renderedComponent.getByLabelText("QuantityFormat.labels.showTrailZerosLabel")).toBeTruthy();
    });
  });
});

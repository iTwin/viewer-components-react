/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, beforeEach, it, vi, expect } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { FormatDefinition, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import { FormatPanel } from "../../components/quantityformat/FormatPanel.js";
import { TelemetryContextProvider } from "../../hooks/UseTelemetryContext.js";
import { IModelApp } from "@itwin/core-frontend";

describe("FormatPanel", () => {
  let unitsProvider: UnitsProvider;
  let persistenceUnit: UnitProps;

  beforeEach(async () => {
    unitsProvider = IModelApp.quantityFormatter.unitsProvider;
    persistenceUnit = await unitsProvider.findUnitByName("Units.M");
  });

  describe("telemetry", () => {
    it("should report 'advanced-options-expand' when expanding advanced options", async () => {
      const user = userEvent.setup();
      const onFeatureUsedSpy = vi.fn();
      const formatDefinition: FormatDefinition = {
        type: "Decimal",
        precision: 2,
        composite: {
          units: [{ name: "Units.M", label: "m" }],
        },
      };

      render(
        <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
          <FormatPanel
            formatProps={formatDefinition}
            unitsProvider={unitsProvider}
            onFormatChange={vi.fn()}
            persistenceUnit={persistenceUnit}
          />
        </TelemetryContextProvider>
      );

      const expandableBlock = screen.getByText("labels.advancedOptions");
      await user.click(expandableBlock);

      expect(onFeatureUsedSpy).toHaveBeenCalledWith("advanced-options-expand");
    });

    it("should report 'advanced-options-collapse' when collapsing advanced options", async () => {
      const user = userEvent.setup();
      const onFeatureUsedSpy = vi.fn();
      const formatDefinition: FormatDefinition = {
        type: "Decimal",
        precision: 2,
        composite: {
          units: [{ name: "Units.M", label: "m" }],
        },
      };

      render(
        <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
          <FormatPanel
            formatProps={formatDefinition}
            unitsProvider={unitsProvider}
            onFormatChange={vi.fn()}
            persistenceUnit={persistenceUnit}
          />
        </TelemetryContextProvider>
      );

      const expandableBlock = screen.getByText("labels.advancedOptions");

      // First expand
      await user.click(expandableBlock);
      expect(onFeatureUsedSpy).toHaveBeenCalledWith("advanced-options-expand");

      // Then collapse
      await user.click(expandableBlock);
      expect(onFeatureUsedSpy).toHaveBeenCalledWith("advanced-options-collapse");
    });
  });
});

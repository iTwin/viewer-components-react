/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IModelApp } from "@itwin/core-frontend";
import { FormatUnits } from "../../../components/quantityformat/internal/FormatUnits.js";

import type { FormatDefinition } from "@itwin/core-quantity";

describe("FormatUnits", () => {
  /** Opens the unit dropdown once its options have loaded from the units provider. */
  async function openUnitOptions(unitName: string) {
    // The label placeholder is set from the same async lookup that loads the options.
    await waitFor(() => expect((screen.getByTestId(`unit-label-${unitName}`) as HTMLInputElement).placeholder).not.toBe(""));
    fireEvent.click(screen.getByTestId(`unit-${unitName}`).querySelector("[role=combobox]")!);
  }

  async function addSubUnit(format: FormatDefinition, unitName: string) {
    const onUnitsChange = vi.fn();
    render(<FormatUnits initialFormat={format} unitsProvider={IModelApp.quantityFormatter.unitsProvider} onUnitsChange={onUnitsChange} />);

    await openUnitOptions(unitName);
    fireEvent.click(screen.getByRole("option", { name: "labels.addSubUnit" }));
    return onUnitsChange;
  }

  // Civil-iTwin #2096641: DDMMSS angle formats need arc minutes, not GRAD, as the sub-unit of degrees.
  it("offers arc minutes as the sub-unit of an angle in degrees", async () => {
    const format: FormatDefinition = { type: "decimal", composite: { units: [{ name: "Units.ARC_DEG", label: "°" }] } };
    const onUnitsChange = await addSubUnit(format, "Units.ARC_DEG");

    expect(onUnitsChange).toHaveBeenCalledWith({
      ...format,
      composite: { units: [{ name: "Units.ARC_DEG", label: "°" }, { name: "Units.ARC_MINUTE", label: "'" }] },
    });
  });

  it("offers arc seconds as the sub-unit of arc minutes", async () => {
    const format: FormatDefinition = {
      type: "decimal",
      composite: { units: [{ name: "Units.ARC_DEG", label: "°" }, { name: "Units.ARC_MINUTE", label: "'" }] },
    };
    const onUnitsChange = await addSubUnit(format, "Units.ARC_MINUTE");

    expect(onUnitsChange).toHaveBeenCalledWith({
      ...format,
      composite: { units: [...format.composite!.units, { name: "Units.ARC_SECOND", label: "''" }] },
    });
  });

  // Civil-iTwin #2096642: azimuth formats use horizontal-direction units.
  it("offers arc minutes as the sub-unit of a horizontal direction in degrees", async () => {
    const format: FormatDefinition = { type: "azimuth", composite: { units: [{ name: "Units.HORIZONTAL_DIR_ARC_DEG", label: "°" }] } };
    const onUnitsChange = await addSubUnit(format, "Units.HORIZONTAL_DIR_ARC_DEG");

    expect(onUnitsChange).toHaveBeenCalledWith({
      ...format,
      composite: { units: [{ name: "Units.HORIZONTAL_DIR_ARC_DEG", label: "°" }, { name: "Units.HORIZONTAL_DIR_ARC_MINUTE", label: "'" }] },
    });
  });

  it("does not offer GRAD in the sub-unit list of degrees", async () => {
    const format: FormatDefinition = {
      type: "decimal",
      composite: { units: [{ name: "Units.ARC_DEG", label: "°" }, { name: "Units.ARC_MINUTE", label: "'" }] },
    };
    render(<FormatUnits initialFormat={format} unitsProvider={IModelApp.quantityFormatter.unitsProvider} onUnitsChange={vi.fn()} />);

    await openUnitOptions("Units.ARC_MINUTE");
    expect(screen.getByRole("option", { name: "ARC_SECOND" })).toBeDefined();
    expect(screen.queryByRole("option", { name: "GRAD" })).toBeNull();
  });

  // Civil-iTwin #2096646: an unset composite label falls back to the unit label when formatting, so show it.
  it("shows the default unit label as a placeholder when the composite label is unset", async () => {
    const format: FormatDefinition = { type: "decimal", composite: { units: [{ name: "Units.FT" }] } };
    render(<FormatUnits initialFormat={format} unitsProvider={IModelApp.quantityFormatter.unitsProvider} onUnitsChange={vi.fn()} />);

    await waitFor(() => {
      const input = screen.getByTestId("unit-label-Units.FT") as HTMLInputElement;
      expect(input.value).toBe("");
      expect(input.placeholder).toBe("ft");
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IModelApp } from "@itwin/core-frontend";
import { FormatUnits } from "../../../components/quantityformat/internal/FormatUnits.js";

import type { FormatDefinition, UnitProps, UnitsProvider } from "@itwin/core-quantity";

describe("FormatUnits", () => {
  /** Opens the unit dropdown and waits for `optionName`, which only appears once options load from the provider. */
  async function openUnitOptions(unitName: string, optionName: string) {
    fireEvent.click(screen.getByTestId(`unit-${unitName}`).querySelector("[role=combobox]")!);
    return screen.findByRole("option", { name: optionName });
  }

  async function addSubUnit(format: FormatDefinition, unitName: string, unitsProvider: UnitsProvider = IModelApp.quantityFormatter.unitsProvider) {
    const onUnitsChange = vi.fn();
    render(<FormatUnits initialFormat={format} unitsProvider={unitsProvider} onUnitsChange={onUnitsChange} />);

    fireEvent.click(await openUnitOptions(unitName, "labels.addSubUnit"));
    return onUnitsChange;
  }

  // DDMMSS angle formats need arc minutes, not GRAD, as the sub-unit of degrees.
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

  // Azimuth formats use horizontal-direction units.
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

    await openUnitOptions("Units.ARC_MINUTE", "ARC_SECOND");
    expect(screen.queryByRole("option", { name: "GRAD" })).toBeNull();
  });

  it.each([1_000_000.5, 1_000_000_000.5])("does not offer a sub-unit with a large non-whole ratio of %d parts", async (ratio) => {
    const parent = { name: "Test.PARENT", label: "p", phenomenon: "Test.PHEN", system: "Test.SYS", isValid: true } as UnitProps;
    const child = { ...parent, name: "Test.CHILD", label: "c" };
    const unitsProvider = {
      findUnitByName: async (name: string) => (name === child.name ? child : parent),
      getUnitsByFamily: async () => [parent, child],
      getConversion: async (from: UnitProps, to: UnitProps) => ({ factor: from.name === to.name ? 1 : from.name === child.name ? 1 / ratio : ratio, offset: 0 }),
    } as unknown as UnitsProvider;
    render(<FormatUnits initialFormat={{ type: "decimal", composite: { units: [{ name: parent.name, label: "p" }] } }} unitsProvider={unitsProvider} onUnitsChange={vi.fn()} />);

    await openUnitOptions(parent.name, "CHILD");
    expect(screen.queryByRole("option", { name: "labels.addSubUnit" })).toBeNull();
  });

  // An unset composite label falls back to the unit label when formatting, so show it.
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

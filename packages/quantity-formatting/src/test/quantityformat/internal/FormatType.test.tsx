/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IModelApp } from "@itwin/core-frontend";
import { Format, FormatterSpec } from "@itwin/core-quantity";
import { FormatTypeOption } from "../../../components/quantityformat/internal/misc/FormatType.js";

import type { FormatProps, UnitProps, UnitsProvider } from "@itwin/core-quantity";

describe("FormatTypeOption", () => {
  async function switchType(unitName: string, typeLabel: string): Promise<FormatProps> {
    const onChange = vi.fn();
    const formatProps: FormatProps = { type: "decimal", precision: 2, composite: { units: [{ name: unitName }] } };
    render(<FormatTypeOption formatProps={formatProps} unitsProvider={IModelApp.quantityFormatter.unitsProvider} onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: typeLabel }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    return onChange.mock.calls[0][0];
  }

  async function formatValue(formatProps: FormatProps, unitName: string, value: number) {
    const unitsProvider = IModelApp.quantityFormatter.unitsProvider;
    const format = await Format.createFromJSON("test", unitsProvider, formatProps);
    const spec = await FormatterSpec.create("test", format, unitsProvider, await unitsProvider.findUnitByName(unitName));
    return spec.applyFormatting(value);
  }

  // Horizontal-direction units cannot be converted to angle units.
  it.each([
    ["azimuth", "45"],
    ["bearing", "N45E"],
  ])("uses horizontal-direction units for %s formats of horizontal directions", async (typeLabel, expected) => {
    const formatProps = await switchType("Units.HORIZONTAL_DIR_ARC_DEG", typeLabel);

    expect(formatProps.revolutionUnit).toBe("Units.HORIZONTAL_DIR_REVOLUTION");
    if (typeLabel === "azimuth") expect(formatProps.azimuthBaseUnit).toBe("Units.HORIZONTAL_DIR_ARC_DEG");
    expect(await formatValue(formatProps, "Units.HORIZONTAL_DIR_ARC_DEG", 45)).toBe(expected);
  });

  it("uses angle units for azimuth formats of angles", async () => {
    const formatProps = await switchType("Units.ARC_DEG", "azimuth");

    expect(formatProps).toMatchObject({ revolutionUnit: "Units.REVOLUTION", azimuthBaseUnit: "Units.ARC_DEG", azimuthBase: 0 });
    expect(await formatValue(formatProps, "Units.ARC_DEG", 45)).toBe("45");
  });

  describe("pending azimuth lookup", () => {
    function renderWithPendingLookup() {
      let resolveLookup!: () => void;
      const lookup = new Promise<UnitProps>((resolve) => (resolveLookup = () => resolve({ phenomenon: "Units.ANGLE" } as UnitProps)));
      const unitsProvider = { findUnitByName: vi.fn(async () => lookup) } as unknown as UnitsProvider;
      const onChange = vi.fn();
      const formatProps: FormatProps = { type: "decimal", precision: 2, composite: { units: [{ name: "Units.ARC_DEG" }] } };
      const view = render(<FormatTypeOption formatProps={formatProps} unitsProvider={unitsProvider} onChange={onChange} />);
      fireEvent.click(screen.getByRole("combobox"));
      fireEvent.click(screen.getByRole("option", { name: "azimuth" }));
      expect(unitsProvider.findUnitByName).toHaveBeenCalledOnce();
      // Resolves the lookup and lets the type change handler finish.
      const finishLookup = async () => act(async () => {
        resolveLookup();
        await lookup;
      });
      return { ...view, formatProps, unitsProvider, onChange, finishLookup };
    }

    it("applies the azimuth defaults when nothing changed while it was pending", async () => {
      const { onChange, finishLookup } = renderWithPendingLookup();
      await finishLookup();
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: "Azimuth", revolutionUnit: "Units.REVOLUTION" }));
    });

    it("is dropped when the format changes before it resolves", async () => {
      const { rerender, formatProps, unitsProvider, onChange, finishLookup } = renderWithPendingLookup();
      rerender(<FormatTypeOption formatProps={{ ...formatProps, precision: 4 }} unitsProvider={unitsProvider} onChange={onChange} />);
      await finishLookup();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("is dropped when the picker unmounts before it resolves", async () => {
      const { unmount, onChange, finishLookup } = renderWithPendingLookup();
      unmount();
      await finishLookup();
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Logger } from "@itwin/core-bentley";
import { BasicUnitsProvider, Format, FormatterSpec } from "@itwin/core-quantity";
import { FormatTypeOption } from "../../../components/quantityformat/internal/misc/FormatType.js";

import type { FormatProps, UnitProps } from "@itwin/core-quantity";

afterEach(() => vi.restoreAllMocks());

describe("FormatTypeOption", () => {
  function decimalFormat(unitName: string): FormatProps {
    return { type: "decimal", precision: 2, composite: { units: [{ name: unitName }] } };
  }

  async function switchType(unitName: string, typeLabel: string): Promise<FormatProps> {
    const unitsProvider = new BasicUnitsProvider();
    const onChange = vi.fn<(format: FormatProps) => void>();
    render(<FormatTypeOption formatProps={decimalFormat(unitName)} unitsProvider={unitsProvider} onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    const option = screen.getByRole("option", { name: typeLabel });
    await waitFor(() => expect(option.getAttribute("aria-disabled")).not.toBe("true"));
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledOnce();
    return onChange.mock.calls[0][0];
  }

  async function formatValue(formatProps: FormatProps, unitName: string, value: number) {
    const unitsProvider = new BasicUnitsProvider();
    const format = await Format.createFromJSON("test", unitsProvider, formatProps);
    const spec = await FormatterSpec.create("test", format, unitsProvider, await unitsProvider.findUnitByName(unitName));
    return spec.applyFormatting(value);
  }

  it.each([
    ["Units.HORIZONTAL_DIR_ARC_DEG", "azimuth", "45"],
    ["Units.HORIZONTAL_DIR_ARC_DEG", "bearing", "N45E"],
    ["Units.ARC_DEG", "azimuth", "45"],
    ["Units.ARC_DEG", "bearing", "N45E"],
  ])("formats %s as %s without incompatible conversions", async (unitName, typeLabel, expected) => {
    const formatProps = await switchType(unitName, typeLabel);
    expect(await formatValue(formatProps, unitName, 45)).toBe(expected);
  });

  it.each(["Units.PERCENT_SLOPE", "Units.COEFFICIENT", "Units.M", "Units.UNKNOWN"])(
    "disables directional formats for %s without changing the selected format",
    async (unitName) => {
      const unitsProvider = new BasicUnitsProvider();
      const lookup = vi.spyOn(unitsProvider, "findUnitByName");
      const onChange = vi.fn();
      render(<FormatTypeOption formatProps={decimalFormat(unitName)} unitsProvider={unitsProvider} onChange={onChange} />);
      await waitFor(() => expect(lookup).toHaveResolved());

      fireEvent.click(screen.getByRole("combobox"));
      for (const name of ["bearing", "azimuth"]) {
        const option = screen.getByRole("option", { name });
        expect(option.getAttribute("aria-disabled")).toBe("true");
        fireEvent.click(option);
      }
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole("combobox").textContent).toContain("decimal");
      expect(screen.getByText("labels.directionFormatsRequireAngles")).toBeTruthy();
    },
  );

  it("keeps numeric formats available without a display unit", () => {
    const onChange = vi.fn();
    render(<FormatTypeOption formatProps={{ type: "decimal" }} unitsProvider={new BasicUnitsProvider()} onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "bearing" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("option", { name: "scientific" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: "Scientific", precision: 6 }));
  });

  it("reports lookup failures instead of enabling angular defaults", async () => {
    const unitsProvider = new BasicUnitsProvider();
    vi.spyOn(unitsProvider, "findUnitByName").mockRejectedValue(new Error("unit unavailable"));
    const logError = vi.spyOn(Logger, "logError").mockImplementation(() => {});
    render(<FormatTypeOption formatProps={decimalFormat("Units.ARC_DEG")} unitsProvider={unitsProvider} onChange={vi.fn()} />);

    expect((await screen.findByRole("alert")).textContent).toBe("errors.unitLookup");
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "azimuth" }).getAttribute("aria-disabled")).toBe("true");
    expect(logError).toHaveBeenCalledWith("QuantityFormat", "Failed to look up the format unit", expect.any(Function));
  });

  it("does not enable angular formats from a stale unit lookup", async () => {
    const unitsProvider = new BasicUnitsProvider();
    const angle = await unitsProvider.findUnitByName("Units.ARC_DEG");
    let resolveLookup!: (unit: UnitProps) => void;
    const lookup = new Promise<UnitProps>((resolve) => { resolveLookup = resolve; });
    vi.spyOn(unitsProvider, "findUnitByName").mockImplementationOnce(async () => lookup);
    const onChange = vi.fn();
    const { rerender } = render(<FormatTypeOption formatProps={decimalFormat("Units.ARC_DEG")} unitsProvider={unitsProvider} onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "azimuth" }).getAttribute("aria-disabled")).toBe("true");

    rerender(<FormatTypeOption formatProps={decimalFormat("Units.PERCENT_SLOPE")} unitsProvider={unitsProvider} onChange={onChange} />);
    await act(async () => { resolveLookup(angle); await lookup; });

    expect(screen.getByRole("option", { name: "azimuth" }).getAttribute("aria-disabled")).toBe("true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("drops a pending unit lookup when the picker unmounts", async () => {
    const unitsProvider = new BasicUnitsProvider();
    const angle = await unitsProvider.findUnitByName("Units.ARC_DEG");
    let resolveLookup!: (unit: UnitProps) => void;
    const lookup = new Promise<UnitProps>((resolve) => { resolveLookup = resolve; });
    vi.spyOn(unitsProvider, "findUnitByName").mockImplementationOnce(async () => lookup);
    const onChange = vi.fn();
    const { unmount } = render(<FormatTypeOption formatProps={decimalFormat("Units.ARC_DEG")} unitsProvider={unitsProvider} onChange={onChange} />);
    unmount();
    await act(async () => { resolveLookup(angle); await lookup; });
    expect(onChange).not.toHaveBeenCalled();
  });
});

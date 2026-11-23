/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Logger } from "@itwin/core-bentley";
import { BasicUnitsProvider } from "@itwin/core-quantity";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FormatDefinition, UnitConversionProps } from "@itwin/core-quantity";
import { QuantityFormatPanel } from "../../components/quantityformat/QuantityFormatPanel.js";

afterEach(() => vi.restoreAllMocks());

describe("QuantityFormatPanel", () => {
  const definition: FormatDefinition = {
    type: "Decimal",
    precision: 2,
    composite: { units: [{ name: "Units.M" }] },
  };

  function precisionSelector() {
    const row = screen.getByText("labels.precision").parentElement;
    if (!row) throw new Error("Missing precision row");
    return within(row).getByRole("combobox");
  }

  function changePrecision(precision: "three" | "five" = "five") {
    fireEvent.click(precisionSelector());
    fireEvent.click(screen.getByRole("option", { name: `decimal_precision.${precision}` }));
  }

  it("only applies validated edits after Apply is clicked", async () => {
    const onFormatChange = vi.fn();
    render(<QuantityFormatPanel formatDefinition={definition} unitsProvider={new BasicUnitsProvider()} onFormatChange={onFormatChange} />);
    const apply = screen.getByRole("button", { name: "labels.apply" });
    expect(apply.getAttribute("aria-disabled")).toBe("true");

    changePrecision();
    expect(apply.getAttribute("aria-disabled")).not.toBe("true");
    expect(onFormatChange).not.toHaveBeenCalled();
    fireEvent.click(apply);

    await waitFor(() => expect(onFormatChange).toHaveBeenCalledExactlyOnceWith({ ...definition, precision: 5 }));
    expect(apply.getAttribute("aria-disabled")).toBe("true");
  });

  it("reverts edits without notifying the parent", () => {
    const onFormatChange = vi.fn();
    render(<QuantityFormatPanel formatDefinition={definition} unitsProvider={new BasicUnitsProvider()} onFormatChange={onFormatChange} />);
    changePrecision();
    fireEvent.click(screen.getByRole("button", { name: "labels.revert" }));

    expect(screen.getByRole("button", { name: "labels.apply" }).getAttribute("aria-disabled")).toBe("true");
    expect(precisionSelector().textContent).toContain("decimal_precision.two");
    expect(onFormatChange).not.toHaveBeenCalled();
  });

  it("discards edits when a different format is selected", () => {
    const unitsProvider = new BasicUnitsProvider();
    const onFormatChange = vi.fn();
    const { rerender } = render(<QuantityFormatPanel formatDefinition={definition} unitsProvider={unitsProvider} onFormatChange={onFormatChange} />);
    changePrecision();
    rerender(<QuantityFormatPanel formatDefinition={{ ...definition, precision: 3 }} unitsProvider={unitsProvider} onFormatChange={onFormatChange} />);

    expect(screen.getByRole("button", { name: "labels.apply" }).getAttribute("aria-disabled")).toBe("true");
    expect(precisionSelector().textContent).toContain("decimal_precision.three");
    expect(onFormatChange).not.toHaveBeenCalled();
  });

  it.each([true, false])("respects showSample=%s", (showSample) => {
    render(<QuantityFormatPanel formatDefinition={definition} unitsProvider={new BasicUnitsProvider()} onFormatChange={vi.fn()} showSample={showSample} />);
    expect(screen.queryByLabelText("labels.samplePreview") !== null).toBe(showSample);
  });

  it.each([
    ["Units.PERCENT_SLOPE", "Bearing"],
    ["Units.PERCENT_SLOPE", "Azimuth"],
    ["Units.COEFFICIENT", "Bearing"],
    ["Units.COEFFICIENT", "Azimuth"],
  ])("rejects applying %s as %s even with the sample hidden", async (unitName, type) => {
    const onFormatChange = vi.fn();
    const logError = vi.spyOn(Logger, "logError").mockImplementation(() => {});
    const invalidFormat: FormatDefinition = {
      type, precision: 2, composite: { units: [{ name: unitName }] }, revolutionUnit: "Units.REVOLUTION",
      ...(type === "Azimuth" ? { azimuthBaseUnit: "Units.ARC_DEG", azimuthBase: 0 } : {}),
    };
    render(<QuantityFormatPanel formatDefinition={invalidFormat} unitsProvider={new BasicUnitsProvider()} onFormatChange={onFormatChange} showSample={false} />);
    changePrecision();
    fireEvent.click(screen.getByRole("button", { name: "labels.apply" }));

    expect((await screen.findByRole("alert")).textContent).toBe("errors.invalidFormat");
    expect(onFormatChange).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith("QuantityFormat", "Failed to validate the edited format", expect.any(Function));

    fireEvent.click(screen.getByRole("button", { name: "labels.revert" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "labels.apply" }).getAttribute("aria-disabled")).toBe("true");
  });

  it.each([
    ["Units.ARC_DEG", "Bearing", "Units.REVOLUTION", "Units.ARC_DEG"],
    ["Units.ARC_DEG", "Azimuth", "Units.REVOLUTION", "Units.ARC_DEG"],
    ["Units.HORIZONTAL_DIR_ARC_DEG", "Bearing", "Units.HORIZONTAL_DIR_REVOLUTION", "Units.HORIZONTAL_DIR_ARC_DEG"],
    ["Units.HORIZONTAL_DIR_ARC_DEG", "Azimuth", "Units.HORIZONTAL_DIR_REVOLUTION", "Units.HORIZONTAL_DIR_ARC_DEG"],
  ])("still applies valid %s %s formats", async (unitName, type, revolutionUnit, azimuthBaseUnit) => {
    const validFormat: FormatDefinition = {
      type, precision: 2, composite: { units: [{ name: unitName }] }, revolutionUnit,
      ...(type === "Azimuth" ? { azimuthBaseUnit, azimuthBase: 0 } : {}),
    };
    const onFormatChange = vi.fn();
    render(<QuantityFormatPanel formatDefinition={validFormat} unitsProvider={new BasicUnitsProvider()} onFormatChange={onFormatChange} showSample={false} />);
    changePrecision();
    fireEvent.click(screen.getByRole("button", { name: "labels.apply" }));
    await waitFor(() => expect(onFormatChange).toHaveBeenCalledExactlyOnceWith({ ...validFormat, precision: 5 }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("preserves unitless numeric formats", async () => {
    const onFormatChange = vi.fn();
    render(<QuantityFormatPanel formatDefinition={{ type: "Decimal", precision: 2 }} unitsProvider={new BasicUnitsProvider()} onFormatChange={onFormatChange} />);
    changePrecision();
    fireEvent.click(screen.getByRole("button", { name: "labels.apply" }));
    await waitFor(() => expect(onFormatChange).toHaveBeenCalledExactlyOnceWith({ type: "Decimal", precision: 5 }));
  });

  it("does not apply an edit that changed while validation was pending", async () => {
    const unitsProvider = new BasicUnitsProvider();
    const onFormatChange = vi.fn();
    render(<QuantityFormatPanel formatDefinition={definition} unitsProvider={unitsProvider} onFormatChange={onFormatChange} showSample={false} />);
    changePrecision();
    let resolveConversion!: (conversion: UnitConversionProps) => void;
    const pending = new Promise<UnitConversionProps>((resolve) => { resolveConversion = resolve; });
    const conversion = vi.spyOn(unitsProvider, "getConversion").mockImplementationOnce(async () => pending);
    const apply = screen.getByRole("button", { name: "labels.apply" });
    fireEvent.click(apply);
    await waitFor(() => expect(conversion).toHaveBeenCalled());
    expect(apply.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(apply);

    changePrecision("three");
    await act(async () => { resolveConversion({ factor: 1, offset: 0 }); await pending; });
    expect(onFormatChange).not.toHaveBeenCalled();

    fireEvent.click(apply);
    await waitFor(() => expect(onFormatChange).toHaveBeenCalledExactlyOnceWith({ ...definition, precision: 3 }));
  });

  it("logs when the persistence unit cannot be loaded", async () => {
    const unitsProvider = new BasicUnitsProvider();
    vi.spyOn(unitsProvider, "findUnitByName").mockRejectedValue(new Error("unknown unit"));
    const logError = vi.spyOn(Logger, "logError").mockImplementation(() => {});
    render(<QuantityFormatPanel formatDefinition={definition} unitsProvider={unitsProvider} onFormatChange={vi.fn()} showSample={false} />);
    await waitFor(() => expect(logError).toHaveBeenCalledWith("QuantityFormat", "Failed to load the persistence unit", expect.any(Function)));
  });
});

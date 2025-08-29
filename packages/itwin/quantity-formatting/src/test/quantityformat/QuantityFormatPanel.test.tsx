/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { FormatDefinition, UnitsProvider, UnitProps } from "@itwin/core-quantity";
import { QuantityFormatPanel } from "../../components/quantityformat/QuantityFormatPanel.js";
import { QuantityFormatting } from "../../QuantityFormatting.js";

// Mock the useTranslation hook
vi.mock("../../useTranslation.js", () => ({
  useTranslation: () => ({
    translate: (key: string) => {
      const translations: Record<string, string> = {
        "QuantityFormat:labels.save": "Save",
        "QuantityFormat:labels.clear": "Clear",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock the child components
vi.mock("../../components/quantityformat/FormatPanel.js", () => ({
  FormatPanel: ({ formatProps, onFormatChange }: any) => (
    <div data-testid="format-panel">
      <button
        data-testid="trigger-format-change"
        onClick={() => onFormatChange({ ...formatProps, precision: 5 })}
      >
        Change Format
      </button>
    </div>
  ),
}));

vi.mock("../../components/quantityformat/FormatSample.js", () => ({
  FormatSample: () => <div data-testid="format-sample">Format Sample</div>,
}));

describe("QuantityFormatPanel", () => {
  let mockUnitsProvider: UnitsProvider;
  let mockFormatDefinition: FormatDefinition;
  let mockOnFormatChange: ReturnType<typeof vi.fn>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    // Set up user-event
    user = userEvent.setup();

    // Mock QuantityFormatting.localization
    if (!QuantityFormatting.localization) {
      Object.defineProperty(QuantityFormatting, "localization", {
        value: {
          getLocalizedString: (key: string) => key,
        },
        writable: true,
      });
    }

    mockUnitsProvider = {
      findUnitByName: vi.fn().mockResolvedValue({
        name: "Units.M",
        label: "m",
      } as UnitProps),
    } as any;

    mockFormatDefinition = {
      type: "Decimal",
      precision: 2,
      composite: {
        units: [{ name: "Units.M", label: "m" }],
      },
    } as FormatDefinition;

    mockOnFormatChange = vi.fn();
  });

  it("should render with Save button disabled initially", async () => {
    render(
      <QuantityFormatPanel
        formatDefinition={mockFormatDefinition}
        unitsProvider={mockUnitsProvider}
        onFormatChange={mockOnFormatChange}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton.getAttribute("aria-disabled")).toEqual("true");
  });

  it("should enable Save button when format is changed", async () => {
    render(
      <QuantityFormatPanel
        formatDefinition={mockFormatDefinition}
        unitsProvider={mockUnitsProvider}
        onFormatChange={mockOnFormatChange}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Save" });
    const triggerChangeButton = screen.getByTestId("trigger-format-change");

    // Initially disabled
    expect(saveButton.getAttribute("aria-disabled")).toEqual("true");

    // Trigger format change
    await user.click(triggerChangeButton);
    // Should be enabled after change
    expect(saveButton.getAttribute("aria-disabled")).toBeNull();
  });

  it("should call onFormatChange only when Save button is clicked", async () => {
    render(
      <QuantityFormatPanel
        formatDefinition={mockFormatDefinition}
        unitsProvider={mockUnitsProvider}
        onFormatChange={mockOnFormatChange}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Save" });
    const triggerChangeButton = screen.getByTestId("trigger-format-change");

    // Trigger format change - should not call parent onFormatChange yet
    await user.click(triggerChangeButton);

    expect(mockOnFormatChange).not.toHaveBeenCalled();

    // Click Save button - should call parent onFormatChange
    await user.click(saveButton);

    expect(mockOnFormatChange).toHaveBeenCalledTimes(1);
    expect(mockOnFormatChange).toHaveBeenCalledWith(
      expect.objectContaining({
        precision: 5,
      })
    );
  });

  it("should disable Save button after Save is clicked", async () => {
    render(
      <QuantityFormatPanel
        formatDefinition={mockFormatDefinition}
        unitsProvider={mockUnitsProvider}
        onFormatChange={mockOnFormatChange}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Save" });
    const triggerChangeButton = screen.getByTestId("trigger-format-change");

    // Trigger format change and save
    await user.click(triggerChangeButton);
    await user.click(saveButton);

    // Save button should be disabled again
    expect(saveButton.getAttribute("aria-disabled")).toEqual("true");
  });

  it("should disable Save button and reset changes when Clear is clicked", async () => {
    render(
      <QuantityFormatPanel
        formatDefinition={mockFormatDefinition}
        unitsProvider={mockUnitsProvider}
        onFormatChange={mockOnFormatChange}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Save" });
    const clearButton = screen.getByRole("button", { name: "Clear" });
    const triggerChangeButton = screen.getByTestId("trigger-format-change");

    // Trigger format change
    await user.click(triggerChangeButton);
    expect(saveButton.getAttribute("aria-disabled")).toBeNull();

    // Click Clear button
    await user.click(clearButton);

    // Save button should be disabled and onFormatChange should not be called
    expect(saveButton.getAttribute("aria-disabled")).toEqual("true");
    expect(mockOnFormatChange).not.toHaveBeenCalled();
  });

  it("should reset Save button state when formatDefinition prop changes", async () => {
    const { rerender } = render(
      <QuantityFormatPanel
        formatDefinition={mockFormatDefinition}
        unitsProvider={mockUnitsProvider}
        onFormatChange={mockOnFormatChange}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Save" });
    const triggerChangeButton = screen.getByTestId("trigger-format-change");

    // Trigger format change
    await user.click(triggerChangeButton);
    expect(saveButton.getAttribute("aria-disabled")).toBeNull();

    await user.click(saveButton);

    // Save button should be disabled again
    expect(saveButton.getAttribute("aria-disabled")).toEqual("true");
  });

  it("should not show sample when showSample is false", () => {
    render(
      <QuantityFormatPanel
        formatDefinition={mockFormatDefinition}
        unitsProvider={mockUnitsProvider}
        onFormatChange={mockOnFormatChange}
        showSample={false}
      />
    );

    expect(screen.queryByTestId("format-sample")).toBeNull();
  });

  it("should show sample when showSample is true or undefined", () => {
    render(
      <QuantityFormatPanel
        formatDefinition={mockFormatDefinition}
        unitsProvider={mockUnitsProvider}
        onFormatChange={mockOnFormatChange}
        showSample={true}
      />
    );

    expect(screen.getByTestId("format-sample")).toBeDefined();
  });
});

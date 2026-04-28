/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, vi, expect } from "vitest";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FormatDefinition } from "@itwin/core-quantity";
import type { UnitsProvider } from "@itwin/core-quantity";
import { FormatSample } from "../../components/quantityformat/FormatSample.js";

describe("FormatSample", () => {
  const formatProps: FormatDefinition = { type: "decimal", precision: 4 };
  const unitsProvider = {
    findUnitByName: vi.fn().mockResolvedValue(undefined),
    getUnitsByFamily: vi.fn().mockResolvedValue([]),
  } as unknown as UnitsProvider;

  describe("handleOnValueChange", () => {
    it("should reflect each change event's target value without accumulating stale state", () => {
      render(<FormatSample formatProps={formatProps} unitsProvider={unitsProvider} />);
      const input = screen.getByRole("textbox") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "1" } });
      expect(input.value).toBe("1");

      fireEvent.change(input, { target: { value: "12" } });
      expect(input.value).toBe("12");

      fireEvent.change(input, { target: { value: "123.4" } });
      expect(input.value).toBe("123.4");
    });

    it("should accept empty string (field cleared)", () => {
      render(
        <FormatSample
          formatProps={formatProps}
          unitsProvider={unitsProvider}
          initialMagnitude={42}
        />
      );
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("42");

      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");
    });

    it("should accept partial numeric input without resetting", () => {
      render(<FormatSample formatProps={formatProps} unitsProvider={unitsProvider} />);
      const input = screen.getByRole("textbox") as HTMLInputElement;

      // "1." is partial — valid prefix, not yet a complete number
      fireEvent.change(input, { target: { value: "1." } });
      expect(input.value).toBe("1.");
    });
  });

  describe("handleKeyDown", () => {
    it("should pass through Ctrl+V (paste)", () => {
      render(<FormatSample formatProps={formatProps} unitsProvider={unitsProvider} />);
      const input = screen.getByRole("textbox");

      expect(fireEvent.keyDown(input, { key: "v", ctrlKey: true })).toBe(true);
    });

    it("should pass through Cmd+V (paste on macOS)", () => {
      render(<FormatSample formatProps={formatProps} unitsProvider={unitsProvider} />);
      const input = screen.getByRole("textbox");

      expect(fireEvent.keyDown(input, { key: "v", metaKey: true })).toBe(true);
    });

    it("should pass through Ctrl+A (select-all)", () => {
      render(<FormatSample formatProps={formatProps} unitsProvider={unitsProvider} />);
      const input = screen.getByRole("textbox");

      expect(fireEvent.keyDown(input, { key: "a", ctrlKey: true })).toBe(true);
    });

    it("should block letters without modifier", () => {
      render(<FormatSample formatProps={formatProps} unitsProvider={unitsProvider} />);
      const input = screen.getByRole("textbox");

      expect(fireEvent.keyDown(input, { key: "a" })).toBe(false);
      expect(fireEvent.keyDown(input, { key: "z" })).toBe(false);
    });

    it("should allow digits and decimal point", () => {
      render(<FormatSample formatProps={formatProps} unitsProvider={unitsProvider} />);
      const input = screen.getByRole("textbox");

      expect(fireEvent.keyDown(input, { key: "5" })).toBe(true);
      expect(fireEvent.keyDown(input, { key: "." })).toBe(true);
    });

    it("should allow minus sign when cursor is at position 0", () => {
      render(<FormatSample formatProps={formatProps} unitsProvider={unitsProvider} />);
      const input = screen.getByRole("textbox") as HTMLInputElement;

      // Clear field so cursor is at 0
      fireEvent.change(input, { target: { value: "" } });

      expect(fireEvent.keyDown(input, { key: "-" })).toBe(true);
    });

    it("should block minus sign when cursor is not at position 0", () => {
      render(
        <FormatSample
          formatProps={formatProps}
          unitsProvider={unitsProvider}
          initialMagnitude={5}
        />
      );
      const input = screen.getByRole("textbox") as HTMLInputElement;

      // Value is "5", selectionStart defaults to end (1)
      expect(fireEvent.keyDown(input, { key: "-" })).toBe(false);
    });

    it("should block a second minus sign when value already starts with one", () => {
      render(<FormatSample formatProps={formatProps} unitsProvider={unitsProvider} />);
      const input = screen.getByRole("textbox") as HTMLInputElement;

      // Type leading minus to get "-" as current value
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.keyDown(input, { key: "-" });
      fireEvent.change(input, { target: { value: "-" } });

      // Cursor at 0 but value already starts with "-" — second minus must be blocked
      expect(fireEvent.keyDown(input, { key: "-" })).toBe(false);
    });
  });
});

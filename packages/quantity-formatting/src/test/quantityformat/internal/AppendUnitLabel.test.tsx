/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppendUnitLabel } from "../../../components/quantityformat/internal/AppendUnitLabel.js";

import type { FormatDefinition } from "@itwin/core-quantity";

describe("AppendUnitLabel", () => {
  const base: FormatDefinition = { type: "decimal", precision: 2 };

  it("shows the checkbox as checked for a PascalCase ShowUnitLabel trait", () => {
    render(<AppendUnitLabel formatProps={{ ...base, formatTraits: ["ShowUnitLabel"] }} onFormatChange={vi.fn()} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("removes every casing variant of ShowUnitLabel when unchecked", () => {
    const onFormatChange = vi.fn();
    render(<AppendUnitLabel formatProps={{ ...base, formatTraits: ["ShowUnitLabel", "showUnitLabel", "TrailZeroes"] }} onFormatChange={onFormatChange} />);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onFormatChange).toHaveBeenCalledWith({ ...base, formatTraits: ["TrailZeroes"] });
  });

  it("adds ShowUnitLabel once when checked", () => {
    const onFormatChange = vi.fn();
    render(<AppendUnitLabel formatProps={{ ...base, formatTraits: ["TrailZeroes"] }} onFormatChange={onFormatChange} />);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onFormatChange).toHaveBeenCalledWith({ ...base, formatTraits: ["TrailZeroes", "showUnitLabel"] });
  });
});

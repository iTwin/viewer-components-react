/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterEach, describe, expect, it, vi } from "vitest";
import { Format, FormatTraits } from "@itwin/core-quantity";
import { isFormatTraitSet, resolveSeparatorConflict, setFormatTrait } from "../../../components/quantityformat/internal/FormatPropsUtils.js";

import type { FormatProps } from "@itwin/core-quantity";

describe("FormatPropsUtils", () => {
  const base: FormatProps = { type: "decimal", precision: 2 };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isFormatTraitSet", () => {
    it("matches trait names case-insensitively", () => {
      expect(isFormatTraitSet({ ...base, formatTraits: ["ShowUnitLabel"] }, FormatTraits.ShowUnitLabel)).toBe(true);
      expect(isFormatTraitSet({ ...base, formatTraits: ["showUnitLabel"] }, FormatTraits.ShowUnitLabel)).toBe(true);
      expect(isFormatTraitSet({ ...base, formatTraits: "KeepSingleZero|ShowUnitLabel" }, FormatTraits.ShowUnitLabel)).toBe(true);
    });

    it("returns false when the trait is absent", () => {
      expect(isFormatTraitSet(base, FormatTraits.ShowUnitLabel)).toBe(false);
      expect(isFormatTraitSet({ ...base, formatTraits: ["TrailZeroes"] }, FormatTraits.ShowUnitLabel)).toBe(false);
    });
  });

  describe("setFormatTrait", () => {
    it("removes every casing variant when clearing a trait", () => {
      const result = setFormatTrait({ ...base, formatTraits: ["ShowUnitLabel", "TrailZeroes", "showUnitLabel"] }, FormatTraits.ShowUnitLabel, false);
      expect(result.formatTraits).toEqual(["TrailZeroes"]);
    });

    it("adds a trait exactly once and keeps other entries in order", () => {
      const result = setFormatTrait({ ...base, formatTraits: ["TrailZeroes", "ShowUnitLabel", "customTrait"] }, FormatTraits.ShowUnitLabel, true);
      expect(result.formatTraits).toEqual(["TrailZeroes", "customTrait", "showUnitLabel"]);
    });

    it("accepts string traits and returns an array", () => {
      const result = setFormatTrait({ ...base, formatTraits: "TrailZeroes,ShowUnitLabel" }, FormatTraits.ShowUnitLabel, false);
      expect(result.formatTraits).toEqual(["TrailZeroes"]);
    });

    it("does not mutate the input", () => {
      const formatTraits = ["ShowUnitLabel"];
      setFormatTrait({ ...base, formatTraits }, FormatTraits.ShowUnitLabel, false);
      expect(formatTraits).toEqual(["ShowUnitLabel"]);
    });
  });

  describe("resolveSeparatorConflict", () => {
    it("switches the thousands separator when the decimal separator collides with it", () => {
      const result = resolveSeparatorConflict({ ...base, decimalSeparator: ",", thousandSeparator: "," }, "decimalSeparator");
      expect(result).toMatchObject({ decimalSeparator: ",", thousandSeparator: "." });
    });

    it("switches the decimal separator when the thousands separator collides with it", () => {
      const result = resolveSeparatorConflict({ ...base, decimalSeparator: ".", thousandSeparator: "." }, "thousandSeparator");
      expect(result).toMatchObject({ decimalSeparator: ",", thousandSeparator: "." });
    });

    it("treats unset separators as the formatter's locale defaults", () => {
      vi.spyOn(Format.prototype, "decimalSeparator", "get").mockReturnValue(",");
      vi.spyOn(Format.prototype, "thousandSeparator", "get").mockReturnValue(" ");
      const formatProps = { ...base, thousandSeparator: "," };
      // Unset decimal resolves to "," in this locale, which collides with the explicit thousands separator.
      expect(resolveSeparatorConflict(formatProps, "thousandSeparator")).toMatchObject({ decimalSeparator: ".", thousandSeparator: "," });
      // Unset thousands resolves to " ", so a comma decimal does not collide.
      const commaDecimal = { ...base, decimalSeparator: "," };
      expect(resolveSeparatorConflict(commaDecimal, "decimalSeparator")).toBe(commaDecimal);
    });

    it("does not treat empty separators as a collision", () => {
      const formatProps = { ...base, decimalSeparator: "", thousandSeparator: "" };
      expect(resolveSeparatorConflict(formatProps, "decimalSeparator")).toBe(formatProps);
    });

    it("leaves distinct separators untouched", () => {
      const formatProps = { ...base, decimalSeparator: ",", thousandSeparator: " " };
      expect(resolveSeparatorConflict(formatProps, "decimalSeparator")).toBe(formatProps);
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { FormatTraits } from "@itwin/core-quantity";
import { isFormatTraitSet, resolveSeparatorConflict, setFormatTrait } from "../../../components/quantityformat/internal/FormatPropsUtils.js";

import type { FormatProps } from "@itwin/core-quantity";

describe("FormatPropsUtils", () => {
  const base: FormatProps = { type: "decimal", precision: 2 };

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
      const result = resolveSeparatorConflict({ ...base, decimalSeparator: "," }, "decimalSeparator");
      expect(result).toMatchObject({ decimalSeparator: ",", thousandSeparator: "." });
    });

    it("switches the decimal separator when the thousands separator collides with it", () => {
      const result = resolveSeparatorConflict({ ...base, thousandSeparator: "." }, "thousandSeparator");
      expect(result).toMatchObject({ decimalSeparator: ",", thousandSeparator: "." });
    });

    it("leaves distinct separators untouched", () => {
      const formatProps = { ...base, decimalSeparator: ",", thousandSeparator: " " };
      expect(resolveSeparatorConflict(formatProps, "decimalSeparator")).toBe(formatProps);
    });
  });
});

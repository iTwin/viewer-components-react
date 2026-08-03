/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { createWhereClause, mergeWithDefaults, stableStringify } from "../../../../tree-widget-react/shared/internal/Utils.js";

describe("Utils", () => {
  describe("createWhereClause", () => {
    it("returns empty string when no conditions are provided", () => {
      expect(createWhereClause({ conditions: [] })).toEqual("");
    });

    it("returns empty string when all conditions are falsy", () => {
      expect(createWhereClause({ conditions: [undefined, false, ""] })).toEqual("");
    });

    it("returns single condition without joining", () => {
      expect(createWhereClause({ conditions: ["a.Id = 1"] })).toEqual("WHERE a.Id = 1");
    });

    it("joins multiple conditions with AND", () => {
      expect(createWhereClause({ conditions: ["a.Id = 1", "b.Id = 2"] })).toEqual("WHERE (a.Id = 1) AND (b.Id = 2)");
    });

    it("filters out falsy conditions before joining", () => {
      expect(createWhereClause({ conditions: ["a.Id = 1", undefined, false, "", "b.Id = 2"] })).toEqual("WHERE (a.Id = 1) AND (b.Id = 2)");
    });
  });

  describe("mergeWithDefaults", () => {
    const defaults = {
      enabled: true,
      elements: {
        baseClass: "DefaultClass",
        grouping: { byClass: "enable" },
        excludedClasses: ["DefaultExcludedClass"],
      },
    };

    it("recursively merges nested overrides", () => {
      expect(
        mergeWithDefaults({
          defaults,
          overrides: { elements: { grouping: { byClass: "disable" } } },
        }),
      ).toEqual({
        enabled: true,
        elements: {
          baseClass: "DefaultClass",
          grouping: { byClass: "disable" },
          excludedClasses: ["DefaultExcludedClass"],
        },
      });
    });

    it("ignores undefined overrides", () => {
      expect(mergeWithDefaults({ defaults, overrides: { enabled: undefined, elements: { baseClass: undefined } } })).toEqual(defaults);
    });

    it("replaces arrays instead of merging them", () => {
      expect(mergeWithDefaults({ defaults, overrides: { elements: { excludedClasses: ["CustomExcludedClass"] } } })).toEqual({
        ...defaults,
        elements: { ...defaults.elements, excludedClasses: ["CustomExcludedClass"] },
      });
    });
  });

  describe("stableStringify", () => {
    it("returns the same value for objects with different property insertion order", () => {
      expect(stableStringify({ elements: { nodes: "include" }, categories: { withoutElements: "exclude" } })).toEqual(
        stableStringify({ categories: { withoutElements: "exclude" }, elements: { nodes: "include" } }),
      );
    });

    it("registers changes to nested properties and array items", () => {
      const value = { elements: { nodes: "include", excludedClasses: ["BisCore.A", "BisCore.B"] } };

      expect(stableStringify(value)).not.toEqual(stableStringify({ elements: { ...value.elements, nodes: "exclude" } }));
      expect(stableStringify(value)).not.toEqual(stableStringify({ elements: { ...value.elements, excludedClasses: ["BisCore.B", "BisCore.A"] } }));
    });

    it("omits undefined object properties", () => {
      expect(stableStringify({ elements: undefined })).toEqual(stableStringify({}));
    });

    it("distinguishes primitive types and escaped string content", () => {
      expect(stableStringify(null)).not.toEqual(stableStringify("null"));
      expect(stableStringify(undefined)).not.toEqual(stableStringify("undefined"));
      expect(stableStringify(true)).not.toEqual(stableStringify("true"));
      expect(stableStringify({ value: ";other:key" })).not.toEqual(stableStringify({ value: "", other: "key" }));
    });

    it("distinguishes delimiter-bearing keys from multiple object entries", () => {
      expect(stableStringify({ "a:1,b": 2 })).not.toEqual(stableStringify({ a: 1, b: 2 }));
      expect(stableStringify({ "a:1;b": 2 })).not.toEqual(stableStringify({ a: 1, b: 2 }));
    });
  });
});

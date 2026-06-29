/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { createWhereClause } from "../../../../tree-widget-react/components/trees/common/internal/Utils.js";

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
      expect(createWhereClause({ conditions: ["a.Id = 1", "b.Id = 2"] })).toEqual("WHERE a.Id = 1 AND b.Id = 2");
    });

    it("filters out falsy conditions before joining", () => {
      expect(createWhereClause({ conditions: ["a.Id = 1", undefined, false, "", "b.Id = 2"] })).toEqual("WHERE a.Id = 1 AND b.Id = 2");
    });
  });
});

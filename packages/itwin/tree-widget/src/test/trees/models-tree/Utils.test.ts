/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { createRuleset, createSearchRuleset } from "../../../components/trees/models-tree/Utils";

describe("createRuleset", () => {
  it("creates default ruleset", () => {
    expect(createRuleset({})).to.matchSnapshot();
  });

  it("creates ruleset with specific element class", () => {
    expect(createRuleset({ elementClassSpecification: { className: "SpatialElement", schemaName: "BisCore" } })).to.matchSnapshot();
  });

  it("creates ruleset with grouped elements", () => {
    expect(createRuleset({ enableElementsClassGrouping: true })).to.matchSnapshot();
  });

  it("creates ruleset with shown empty models", () => {
    expect(createRuleset({ showEmptyModels: true })).to.matchSnapshot();
  });
});

describe("createSearchRuleset", () => {
  it("creates default ruleset", () => {
    expect(createSearchRuleset({})).to.matchSnapshot();
  });

  it("creates ruleset with specific element class", () => {
    expect(createSearchRuleset({ elementClassSpecification: { className: "SpatialElement", schemaName: "BisCore" } })).to.matchSnapshot();
  });

  it("creates ruleset with shown empty models", () => {
    expect(createSearchRuleset({ showEmptyModels: true })).to.matchSnapshot();
  });
});

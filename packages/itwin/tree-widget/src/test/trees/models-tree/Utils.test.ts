/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { addModelsTreeNodeItemIcons, createRuleset, createSearchRuleset } from "../../../components/trees/models-tree/Utils";

import type { DelayLoadedTreeNodeItem } from "@itwin/components-react";
import type { Node } from "@itwin/presentation-common";

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

describe("addModelsTreeNodeItemIcons", () => {
  it("sets icon from extended data", () => {
    const item: Partial<DelayLoadedTreeNodeItem> = {};
    const node: Partial<Node> = {
      extendedData: {
        icon: "test-icon",
      },
    };
    addModelsTreeNodeItemIcons(item, node);
    expect(item.icon).to.be.eq("test-icon");
  });

  it("sets icon from extended data for grouping nodes", () => {
    const item: Partial<DelayLoadedTreeNodeItem> = {};
    const node: Partial<Node> = {
      key: {
        type: StandardNodeTypes.ECClassGroupingNode,
        className: "TestClass",
        groupedInstancesCount: 5,
        pathFromRoot: [],
        version: 2,
      },
      extendedData: {
        icon: "test-icon",
        groupIcon: "test-group-icon",
      },
    };
    addModelsTreeNodeItemIcons(item, node);
    expect(item.icon).to.be.eq("test-group-icon");
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { customizeModelsTreeNodeItem } from "../../../tree-widget-react";

import type { DelayLoadedTreeNodeItem } from "@itwin/components-react";
import type { Node } from "@itwin/presentation-common";

describe("customizeModelsTreeNodeItem", () => {
  it("sets icon from extended data", () => {
    const item: Partial<DelayLoadedTreeNodeItem> = {};
    const node: Partial<Node> = {
      extendedData: {
        icon: "test-icon",
      },
    };
    customizeModelsTreeNodeItem(item, node);
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
    customizeModelsTreeNodeItem(item, node);
    expect(item.icon).to.be.eq("test-group-icon");
  });

  it("sets checkbox to be visible and disabled", () => {
    const item: Partial<DelayLoadedTreeNodeItem> = {};
    const node: Partial<Node> = {};
    customizeModelsTreeNodeItem(item, node);
    expect(item.isCheckboxVisible).to.be.true;
    expect(item.isCheckboxDisabled).to.be.true;
  });
});

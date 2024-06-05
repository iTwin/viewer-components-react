/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import { CheckBoxState } from "@itwin/core-react";
import { TREE_NODE_LABEL_RENDERER } from "../../../components/trees/common/TreeNodeRenderer";
import {
  addCustomTreeNodeItemLabelRenderer, addTreeNodeItemCheckbox, combineTreeNodeItemCustomizations,
} from "../../../components/trees/common/Utils";

import type { DelayLoadedTreeNodeItem } from "@itwin/components-react";
import type { Node } from "@itwin/presentation-common";

describe("combineTreeNodeItemCustomizations", () => {
  it("invokes supplied callbacks", () => {
    const spy1 = sinon.spy();
    const spy2 = sinon.spy();

    const node: Partial<Node> = {};
    const item: Partial<DelayLoadedTreeNodeItem> = {};

    const combined = combineTreeNodeItemCustomizations([spy1, spy2]);
    combined(item, node);

    expect(spy1).to.be.calledOnceWithExactly(item, node);
    expect(spy2).to.be.calledOnceWithExactly(item, node);
  });
});

describe("addTreeNodeItemCheckbox", () => {
  it("enables checkbox", () => {
    const item: Partial<DelayLoadedTreeNodeItem> = {};

    addTreeNodeItemCheckbox(item);
    expect(item.isCheckboxVisible).to.be.true;
    expect(item.isCheckboxDisabled).to.be.true;
    expect(item.checkBoxState).to.be.eq(CheckBoxState.Off);
  });
});

describe("addCustomTreeNodeItemLabelRenderer", () => {
  it("sets property renderer name", () => {
    const item: Partial<DelayLoadedTreeNodeItem> = {
      label: PropertyRecord.fromString("Label"),
    };
    addCustomTreeNodeItemLabelRenderer(item);
    expect(item.label?.property.renderer?.name).to.be.eq(TREE_NODE_LABEL_RENDERER);
  });

  it("does nothing if item does not have label", () => {
    const item: Partial<DelayLoadedTreeNodeItem> = {};
    addCustomTreeNodeItemLabelRenderer(item);
    expect(item.label).to.be.undefined;
  });
});

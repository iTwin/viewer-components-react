/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { CheckBoxState } from "@itwin/core-react";
import { combineTreeNodeItemCustomizations, showTreeNodeItemCheckbox } from "../../../components/trees/common/Utils";

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

describe("showTreeNodeItemCheckbox", () => {
  it("enables checkbox", () => {
    const item: Partial<DelayLoadedTreeNodeItem> = {};

    showTreeNodeItemCheckbox(item);
    expect(item.isCheckboxVisible).to.be.true;
    expect(item.isCheckboxDisabled).to.be.true;
    expect(item.checkBoxState).to.be.eq(CheckBoxState.Off);
  });
});

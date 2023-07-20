/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { PropertyRecord } from "@itwin/appui-abstract";
import { addCustomTreeNodeItemLabelRenderer, TREE_NODE_LABEL_RENDERER } from "../../../components/trees/common/TreeNodeRenderer";

import type { DelayLoadedTreeNodeItem } from "@itwin/components-react";

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

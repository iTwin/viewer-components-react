/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ModelsTreeNode } from "../../../../../components/trees/stateless/models-tree/internal/ModelsTreeNode";

describe("Node utils", () => {
  it("getModelId", () => {
    const node = {
      extendedData: {},
    };
    expect(ModelsTreeNode.getModelId(node)).to.be.undefined;
    node.extendedData = { modelId: "0x1" };
    expect(ModelsTreeNode.getModelId(node)).to.eq("0x1");
    node.extendedData = { modelIds: ["0x1", "0x2"] };
    expect(ModelsTreeNode.getModelId(node)).to.eq("0x1");
    node.extendedData = { modelIds: [["0x1"], "0x2"] };
    expect(ModelsTreeNode.getModelId(node)).to.eq("0x1");
  });

  it("getCategoryId", () => {
    const node = {
      extendedData: {},
    };
    expect(ModelsTreeNode.getCategoryId(node)).to.be.undefined;
    node.extendedData = { categoryId: "0x1" };
    expect(ModelsTreeNode.getCategoryId(node)).to.eq("0x1");
  });
});

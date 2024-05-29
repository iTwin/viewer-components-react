import { expect } from "chai";
import { NodeUtils } from "../../../../components/trees/stateless/models-tree/internal/NodeUtils";

describe("Node utils", () => {
  it("getModelId", () => {
    const node = {
      extendedData: {},
    };
    expect(NodeUtils.getModelId(node)).to.be.undefined;
    node.extendedData = { modelId: "0x1" };
    expect(NodeUtils.getModelId(node)).to.eq("0x1");
    node.extendedData = { modelIds: ["0x1", "0x2"] };
    expect(NodeUtils.getModelId(node)).to.eq("0x1");
    node.extendedData = { modelIds: [["0x1"], "0x2"] };
    expect(NodeUtils.getModelId(node)).to.eq("0x1");
  });

  it("getElementCategoryId", () => {
    const node = {
      extendedData: {},
    };
    expect(NodeUtils.getElementCategoryId(node)).to.be.undefined;
    node.extendedData = { categoryId: "0x1" };
    expect(NodeUtils.getElementCategoryId(node)).to.eq("0x1");
  });
});

import { expect } from "chai";
import { PropertyRecord } from "@itwin/appui-abstract";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { ModelsTreeNodeType, NodeUtils } from "../../../components/trees/common/NodeUtils";

import type { TreeNodeItem } from "@itwin/components-react";
import type { PresentationTreeNodeItem } from "@itwin/presentation-components";
describe("Node utils", () => {
  it("getNodeType", () => {
    expect(NodeUtils.getNodeType({} as TreeNodeItem)).to.be.eq(ModelsTreeNodeType.Unknown);
    const instanceNode = {
      key: {
        type: StandardNodeTypes.ECInstancesNode,
        version: 0,
        pathFromRoot: [],
        instanceKeys: [{ className: "MyDomain:SpatialCategory", id: "testInstanceId" }],
      },
      id: "testId",
      label: PropertyRecord.fromString("category-node"),
      autoExpand: true,
      hasChildren: true,
    } as PresentationTreeNodeItem;
    expect(NodeUtils.getNodeType(instanceNode)).to.be.eq(ModelsTreeNodeType.Unknown);
    const groupingNode = {
      ...instanceNode,
      key: {
        type: StandardNodeTypes.ECClassGroupingNode,
        version: 0,
        pathFromRoot: [],
        className: "testClassName",
        groupedInstancesCount: 0,
      },
    };
    expect(NodeUtils.getNodeType(groupingNode)).to.be.eq(ModelsTreeNodeType.Grouping);
    const subjectNode = { ...instanceNode, extendedData: { isSubject: true } };
    expect(NodeUtils.getNodeType(subjectNode)).to.be.eq(ModelsTreeNodeType.Subject);
    const modelNode = { ...instanceNode, extendedData: { isModel: true } };
    expect(NodeUtils.getNodeType(modelNode)).to.be.eq(ModelsTreeNodeType.Model);
    const categoryNode = { ...instanceNode, extendedData: { isCategory: true } };
    expect(NodeUtils.getNodeType(categoryNode)).to.be.eq(ModelsTreeNodeType.Category);
    const elementNode = { ...instanceNode, extendedData: { isElement: true } };
    expect(NodeUtils.getNodeType(elementNode)).to.be.eq(ModelsTreeNodeType.Element);
  });

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

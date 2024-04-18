import { expect } from "chai";
import { PropertyRecord } from "@itwin/appui-abstract";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { getNodeType } from "../../../../components/trees/models-tree/internal/NodeUtils";
import { ModelsTreeNodeType } from "../../../../components/trees/models-tree/ModelsVisibilityHandler";

import type { TreeNodeItem } from "@itwin/components-react";
import type { PresentationTreeNodeItem } from "@itwin/presentation-components";
describe("Node utils", () => {
  it("getNodeType", () => {
    expect(getNodeType({} as TreeNodeItem)).to.be.eq(ModelsTreeNodeType.Unknown);
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
    expect(getNodeType(instanceNode)).to.be.eq(ModelsTreeNodeType.Unknown);
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
    expect(getNodeType(groupingNode)).to.be.eq(ModelsTreeNodeType.Grouping);
    const subjectNode = { ...instanceNode, extendedData: { isSubject: true } };
    expect(getNodeType(subjectNode)).to.be.eq(ModelsTreeNodeType.Subject);
    const modelNode = { ...instanceNode, extendedData: { isModel: true } };
    expect(getNodeType(modelNode)).to.be.eq(ModelsTreeNodeType.Model);
    const categoryNode = { ...instanceNode, extendedData: { isCategory: true } };
    expect(getNodeType(categoryNode)).to.be.eq(ModelsTreeNodeType.Category);
    const elementNode = { ...instanceNode, extendedData: { isElement: true } };
    expect(getNodeType(elementNode)).to.be.eq(ModelsTreeNodeType.Element);
  });
});

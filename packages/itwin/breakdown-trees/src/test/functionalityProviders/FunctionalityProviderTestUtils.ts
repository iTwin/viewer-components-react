/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { DelayLoadedTreeNodeItem, TreeModelNode, TreeNodeItem } from "@itwin/components-react";
import type { ECClassGroupingNodeKey, ECInstancesNodeKey, GroupingNodeKey, InstanceKey } from "@itwin/presentation-common";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { PropertyRecord } from "@itwin/appui-abstract";
import { CheckBoxState } from "@itwin/core-react";

export const MockStrings = {
  GroupNode: "groupingItem",
  DoorNode: "doorNode",
  WindowNode: "windowNode",
  IfcWallNode: "ifcWallNode",
  OBDWallNode: "OBDWallNode",
  UnrelatedNode: "UnrelatedClass",
};

export const MockClassNames = {
  IfcWall: "MockIfcDynamic:IfcWall",
  OBDWall: "MockOBD:Wall",
  Door: "MockDomain:Door",
  Window: "MockDomain:Window",
  BaseWall: "BaseSchema:BaseClassWall",
  BaseDoor: "BaseSchema:BaseClassDoor",
  BaseWindow: "BaseSchema:BaseClassWindow",
  PhysicalElement: "BaseSchema:PhysicalElement",
  UnrelatedClass: "UnrelatedClass",
};

export class FunctionalityProviderTestUtils {
  public static createDelayLoadedTreeNodeItem(id: string): DelayLoadedTreeNodeItem {
    const dummyTreeItem: TreeNodeItem = {
      id,
      label: PropertyRecord.fromString(id),
    };

    return dummyTreeItem;
  }

  public static createTreeModelNode(id: string): TreeModelNode {
    const dummyTreeItem: TreeNodeItem = {
      id,
      label: PropertyRecord.fromString(id),
    };
    return this.createTreeModelNodeFromTreeNodeItem(dummyTreeItem);
  }

  private static createTreeModelNodeFromTreeNodeItem(treeItem: TreeNodeItem): TreeModelNode {
    return {
      id: "TreeModelNode",
      depth: 0,
      isExpanded: false,
      label: treeItem.label,
      isSelected: false,
      checkbox: {
        state: CheckBoxState.Off,
        isDisabled: false,
        isVisible: false,
      },
      parentId: undefined,
      item: treeItem,
      numChildren: undefined,
      description: undefined,
    };
  }

  public static createECClassGroupNodeKey(pathFromRoot: string[], childrenCount: number, className: string): ECClassGroupingNodeKey {
    return {
      type: StandardNodeTypes.ECClassGroupingNode,
      pathFromRoot,
      groupedInstancesCount: childrenCount,
      className,
      version: 1,
    };
  }

  //  /** mocks a grouping node key */
  public static createGroupNodeKey(pathFromRoot: string[], childrenCount: number): GroupingNodeKey {
    return {
      type: StandardNodeTypes.ECClassGroupingNode,
      pathFromRoot,
      groupedInstancesCount: childrenCount,
      version: 1,
    };
  }

  /** mocks a functional node key */
  public static createClassNodeKey(pathFromRoot: string[], instanceKeys: InstanceKey[]): ECInstancesNodeKey {
    return {
      type: StandardNodeTypes.ECInstancesNode,
      pathFromRoot,
      instanceKeys,
      version: 1,
    };
  }

  /** mocks a functional Instance key */
  public static createECInstanceKey(className: string, id: string): InstanceKey {
    return {
      className,
      id,
    };
  }
}

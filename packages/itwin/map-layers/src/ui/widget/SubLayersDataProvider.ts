/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { compareStringsOrUndefined } from "@itwin/core-bentley";
import { PropertyRecord } from "@itwin/appui-abstract";
import { CheckBoxState } from "@itwin/components-react";
import type { MapSubLayerProps, SubLayerId } from "@itwin/core-common";
import type { DelayLoadedTreeNodeItem, ITreeDataProvider, TreeNodeItem } from "@itwin/components-react";
export type SubLayersTreeExpandMode = "full" | "rootGroupOnly";

/**
 * Data provider that returns some fake nodes to show in tree.
 */
export class SubLayersDataProvider implements ITreeDataProvider {
  private readonly _nodeMap = new Map<string, TreeNodeItem[]>();
  private readonly _expandMode;

  constructor(subLayers: MapSubLayerProps[], expandMode: SubLayersTreeExpandMode = "rootGroupOnly") {
    this._expandMode = expandMode;
    this.loadNodes(subLayers);
  }

  public static isUnnamedGroup(subLayer: MapSubLayerProps | undefined): boolean {
    if (!subLayer) {
      return false;
    }

    return (!subLayer.name || subLayer.name.length === 0) && subLayer.children !== undefined && subLayer.children.length > 0;
  }

  private createId(props: MapSubLayerProps): string {
    return undefined !== props.id ? `${props.id}` : props.name ? props.name : "no-id";
  }

  private createNode(props: MapSubLayerProps, expanded?: boolean, isCheckboxDisabled?: boolean, icon?: string): DelayLoadedTreeNodeItem {
    return {
      id: this.createId(props),
      label: PropertyRecord.fromString(props.title ?? props.name ?? "unknown"),
      hasChildren: !!props.children,
      isCheckboxVisible: true,
      checkBoxState: props.visible && !isCheckboxDisabled ? CheckBoxState.On : CheckBoxState.Off,
      extendedData: { subLayerId: props.id },
      isCheckboxDisabled,
      autoExpand: expanded,
      icon,
    };
  }

  private loadChildNodes(allSubLayers: MapSubLayerProps[], parentId?: SubLayerId) {
    const filteredProps = allSubLayers.filter((props) => parentId === props.parent);
    if (filteredProps.length) {
      filteredProps?.sort((a: MapSubLayerProps, b: MapSubLayerProps) => compareStringsOrUndefined(a.title, b.title));
      const treeNodes: TreeNodeItem[] = [];

      filteredProps.forEach((props) => {
        treeNodes.push(
          this.createNode(
            props,
            this._expandMode === "full" ? true : !parentId && props?.children !== undefined ? true : undefined,
            undefined,
            SubLayersDataProvider.isUnnamedGroup(props) ? "icon-folder" : "icon-layers",
          ),
        );
        if (props.children) {
          this.loadChildNodes(allSubLayers, props.id);
        }
      });

      this._nodeMap.set(undefined !== parentId ? `${parentId}` : "", treeNodes);
    }
  }

  private loadNodes(subLayerNodes: MapSubLayerProps[] | undefined) {
    subLayerNodes?.sort((a: MapSubLayerProps, b: MapSubLayerProps) => compareStringsOrUndefined(a.title, b.title));
    if (subLayerNodes) {
      this.loadChildNodes(subLayerNodes, undefined);
    }
  }

  public async getNodesCount(parent?: TreeNodeItem) {
    const nodeArray: TreeNodeItem[] | undefined = parent ? this._nodeMap.get(parent.id) : this._nodeMap.get("");
    if (nodeArray) {
      return nodeArray.length;
    }

    return 0;
  }

  public async getNodes(parent?: TreeNodeItem) {
    const nodeArray: TreeNodeItem[] | undefined = parent ? this._nodeMap.get(parent.id) : this._nodeMap.get("");
    if (nodeArray) {
      return nodeArray;
    }

    return [];
  }
}

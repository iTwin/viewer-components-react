/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import { BeEvent } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import { EmphasizeElements } from "@itwin/core-frontend";
import { KeySet, NodeKey } from "@itwin/presentation-common";
import type { IPresentationTreeDataProvider, PresentationTreeNodeItem } from "@itwin/presentation-components";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import type { TreeModelNode, TreeModelRootNode, TreeModelSource, TreeNodeItem } from "@itwin/components-react";
import { RelatedElementIdsProvider } from "../RelatedElementIdsProvider";
import type { IVisibilityHandler, VisibilityChangeListener, VisibilityStatus } from "@itwin/tree-widget-react";

export class NodeDetails {
  public keySet: KeySet;
  public isAllChildrenVisible: boolean;
  constructor(keySet: KeySet, isAllChildrenVisible: boolean) {
    this.keySet = keySet;
    this.isAllChildrenVisible = isAllChildrenVisible;
  }
}

export interface VisibilityHandlerProps {
  rulesetId: string;
  viewport?: Viewport;
  treeDataProvider: IPresentationTreeDataProvider;
  modelSource: TreeModelSource;
}

class AffectedNodesCache {
  public nodeId: string;
  public isChecked: boolean;
  private static _cachedAffectedNodes: [AffectedNodesCache];
  constructor(nodeId: string, isChecked: boolean) {
    this.nodeId = nodeId;
    this.isChecked = isChecked;
  }

  public static set(nodeId: string, isChecked: boolean) {
    if (this._cachedAffectedNodes === undefined) {
      this._cachedAffectedNodes = [{ nodeId, isChecked }];
    } else
      this._cachedAffectedNodes.push({ nodeId, isChecked });
  }
  public static get() {
    return this._cachedAffectedNodes;
  }
  public static removeNode(index: number, deleteCount?: number) {
    this._cachedAffectedNodes.splice(index, deleteCount);
  }
}

/** @internal */
export class VisibilityHandler implements IVisibilityHandler {
  private _props: VisibilityHandlerProps;
  private _activeView?: Viewport;
  private _treeDataProvider: IPresentationTreeDataProvider;
  private _modelSource: TreeModelSource;

  constructor(props: VisibilityHandlerProps) {
    this._props = props;
    this._activeView = props.viewport;
    this._treeDataProvider = props.treeDataProvider;
    this._modelSource = props.modelSource;
  }
  public dispose() {
  }

  public onVisibilityChange = new BeEvent<VisibilityChangeListener>();

  public async getNodeVisibilityStatus(node: TreeNodeItem) {
    const nodeKey = isPresentationTreeNodeItem(node) ? node.key : undefined;
    if (!nodeKey) {
      return undefined;
    }
    return this.getVisibilityStatus(node);
  }

  public async getVisibilityStatus(node: TreeNodeItem): Promise<VisibilityStatus> {
    const instanceId = VisibilityHandler.getInstanceIdFromTreeNodeKey((node as PresentationTreeNodeItem).key);
    return this.isItemVisible(instanceId, node);
  }

  private static getInstanceIdFromTreeNodeKey(nodeKey: NodeKey) {
    return (NodeKey.isInstancesNodeKey(nodeKey) && nodeKey.instanceKeys.length > 0) ? nodeKey.instanceKeys[0].id : "";
  }

  public async isItemVisible(instanceId: string, node: TreeNodeItem): Promise<VisibilityStatus> {
    if (!this._activeView)
      return { state: "hidden" };
    const cachedAffectedNodes = AffectedNodesCache.get();
    if (cachedAffectedNodes && cachedAffectedNodes.length > 0) {
      const index = cachedAffectedNodes.findIndex((cachedNode) => cachedNode.nodeId === node.id);
      if (index > -1) {
        const nodeState = cachedAffectedNodes[index].isChecked ? "visible" : "hidden";
        AffectedNodesCache.removeNode(index, 1);
        return { state: nodeState };
      }
    }
    const emphasisedElem = EmphasizeElements.getOrCreate(this._activeView);
    const hiddenElems = emphasisedElem.getHiddenElements(this._activeView);
    let state: "visible" | "partial" | "hidden" = "visible";

    if (hiddenElems) {
      if (hiddenElems.has(instanceId)) {
        state = "hidden";
        // If element is hidden do not bother about it's child state
        return { state };
      }

      // Element is either visible or not an instance node. Now check visibility status of its children.
      const keys = new KeySet();
      const nodeDetails = new NodeDetails(keys, true);
      await this.getNodeDetailsFromRule(node, this._props.rulesetId, nodeDetails, hiddenElems);

      if (!nodeDetails.isAllChildrenVisible && instanceId === "") { // if this is group node, draw as invisible
        return { state: "hidden" };
      }
      // If node is a leaf node
      if (nodeDetails.keySet.instanceKeys.size === 0)
        return { state };

      if (nodeDetails.isAllChildrenVisible)
        return { state: "visible" };
      else
        return { state: "partial" };
    }
    return { state };
  }

  public async changeVisibility(node: TreeNodeItem, _shouldDisplay: boolean) {
    const instanceId = VisibilityHandler.getInstanceIdFromTreeNodeKey((node as PresentationTreeNodeItem).key);
    return this.manageVisibility(node, instanceId);
  }
  private async manageVisibility(node: TreeNodeItem, instanceId: string) {
    if (!this._activeView)
      return;
    const emphasisedElem = EmphasizeElements.getOrCreate(this._activeView);
    const hiddenElems = emphasisedElem.getHiddenElements(this._activeView);

    const keys = new KeySet();
    const nodeDetails = new NodeDetails(keys, true);
    if (instanceId !== "") {
      await this.getKeySetFromRule(this._props.rulesetId, instanceId, nodeDetails);
    } else {
      // If the clicked node is not an instance node, get it's child nodes and then apply rule on the child which is an instance node.
      await this.getGroupNodeDetails(node, nodeDetails);
    }

    const elementIds: Id64Array = [];
    if (this._activeView) {
      if (nodeDetails.keySet.instanceKeys.size > 0) {
        nodeDetails.keySet.instanceKeys.forEach((values: Set<string>) => {
          values.forEach((value: string) => {
            elementIds.push(value);
            if (hiddenElems && nodeDetails.isAllChildrenVisible) {
              if (hiddenElems.has(value)) {
                nodeDetails.isAllChildrenVisible = false;
              }
            }
          });
        });
      }
      if (instanceId !== "" && !elementIds.includes(instanceId)) {
        elementIds.push(instanceId);
        if (elementIds.length === 1)
          nodeDetails.isAllChildrenVisible = false;
      }
    }

    let isChecked: boolean;
    if (hiddenElems) {
      if (instanceId === "") {
        if (nodeDetails.isAllChildrenVisible) {
          // Make all its children invisible
          isChecked = false;
          elementIds.forEach((element) => {
            if (!hiddenElems.has(element))
              hiddenElems.add(element);
          });
          emphasisedElem.hideElements(hiddenElems, this._activeView, true);
        } else {
          // Make all its children visible
          isChecked = true;
          this.setAllChildNodesVisible(elementIds, hiddenElems, this._activeView, emphasisedElem);
        }
      } else if (hiddenElems.has(instanceId)) {
        isChecked = true;
        this.setAllChildNodesVisible(elementIds, hiddenElems, this._activeView, emphasisedElem);
      } else {
        isChecked = false;
        emphasisedElem.hideElements(elementIds, this._activeView, false);
      }
    } else {
      isChecked = false;
      emphasisedElem.hideElements(elementIds, this._activeView, false);
    }

    // get all affected nodes and manage their checkbox states
    const affectedNodeIds: string[] = [node.id];
    AffectedNodesCache.set(node.id, isChecked);
    const affectedParentIds: string[] = [];
    const modelNode = this._modelSource.getModel().getNode(node.id);
    if (modelNode) {
      await this.loadChildren(modelNode, affectedNodeIds, isChecked);
      await this.getAllAncestors(modelNode, affectedParentIds);
    }
    const affectedIds: string[] = affectedNodeIds;
    affectedParentIds.forEach((element) => {
      affectedIds.push(element);
    });
    if (affectedIds.length > 0) {
      this.onVisibilityChange.raiseEvent(affectedIds);
    }
  }

  private async loadChildren(parent: TreeModelNode | TreeModelRootNode, affectedNodeIds: string[], isChecked: boolean): Promise<void> {
    const children = this._modelSource.getModel().getChildren(parent.id);
    if (children) {
      for (const sparseValue of children.iterateValues()) {
        affectedNodeIds.push(sparseValue[0]);
        AffectedNodesCache.set(sparseValue[0], isChecked);
        const child = this._modelSource.getModel().getNode(sparseValue[0]);
        if (child)
          await this.loadChildren(child, affectedNodeIds, isChecked);
      }
    }
  }

  private setAllChildNodesVisible(elementIds: Id64Array, hiddenElems: Set<string>, activeView: Viewport, emphasisedElem: EmphasizeElements) {
    elementIds.forEach((element) => {
      hiddenElems.delete(element);
    });
    if (hiddenElems.size === 0)
      EmphasizeElements.clear(activeView);
    else
      emphasisedElem.hideElements(hiddenElems, activeView, true);
  }
  private async getGroupNodeDetails(node: TreeNodeItem, nodeDetails: NodeDetails) {
    const childNodes = await this._treeDataProvider.getNodes(node);
    for (const child of childNodes) {

      if (!isPresentationTreeNodeItem(child)) {
        return;
      }

      const childNodeKey = child.key;
      if (NodeKey.isInstancesNodeKey(childNodeKey) && childNodeKey.instanceKeys.length > 0) {
        nodeDetails.keySet.add(childNodeKey.instanceKeys);
        const childInstanceId = childNodeKey.instanceKeys[0].id;
        await this.getKeySetFromRule(this._props.rulesetId, childInstanceId, nodeDetails);
      } else {
        await this.getGroupNodeDetails(child, nodeDetails);
      }
    }
  }

  private async getKeySetFromRule(rulesetId: string, instanceId: Id64String, nodeDetails: NodeDetails) {
    const provider = new RelatedElementIdsProvider(this._treeDataProvider.imodel, rulesetId, instanceId);
    const keyset = await provider.getElementIds();
    nodeDetails.keySet.add(keyset);
  }

  // Check visibility Status of each child node. If any child is invisible, set nodeDetails.isAllChildrenVisible = false.
  private async getNodeDetailsFromRule(node: TreeNodeItem, rulesetId: string, nodeDetails: NodeDetails, hiddenElems: Set<string>) {

    if (!isPresentationTreeNodeItem(node)) {
      return;
    }

    const elementKey = node.key;
    const instanceId = VisibilityHandler.getInstanceIdFromTreeNodeKey(elementKey);
    if (instanceId !== "") {
      await this.getKeySetFromRule(rulesetId, instanceId, nodeDetails);
    } else {
      // If the clicked node is not an instance node, get it's child nodes and then apply rule on the child which is an instance node.
      await this.getGroupNodeDetails(node, nodeDetails);
    }

    const elementIds: Id64Array = [];

    nodeDetails.keySet.instanceKeys.forEach((values: Set<string>) => {
      values.forEach((value: string) => {
        elementIds.push(value);
        if (hiddenElems.has(value)) {
          nodeDetails.isAllChildrenVisible = false;
        }
      });
    });
  }

  private async getAllAncestors(treeNode: TreeModelNode, affectedNodeIds: string[]) {
    if (treeNode.parentId) {
      const parentNode = this._modelSource.getModel().getNode(treeNode.parentId);
      if (parentNode) {
        affectedNodeIds.push(treeNode.parentId);
        await this.getAllAncestors(parentNode, affectedNodeIds);
      }
    }
  }

  public async cacheChildNodeVisibility(node: TreeNodeItem, isChecked: boolean) {
    AffectedNodesCache.set(node.id, isChecked);
    const childNodes = await this._treeDataProvider.getNodes(node);
    childNodes.forEach((child) => {
      AffectedNodesCache.set(child.id, isChecked);
    });
  }
}

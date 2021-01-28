/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { BeUiEvent, Id64Array, Id64String } from "@bentley/bentleyjs-core";
import { EmphasizeElements, Viewport } from "@bentley/imodeljs-frontend";
import { KeySet, NodeKey } from "@bentley/presentation-common";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { TreeModelNode, TreeModelRootNode, TreeModelSource, TreeNodeItem } from "@bentley/ui-components";
import { IVisibilityHandler, VisibilityStatus } from "@bentley/ui-framework";
import { RelatedElementIdsProvider } from "../RelatedElementIdsProvider";

export class NodeDetails {
  public keySet: KeySet;
  public isAllChildrenVisible: boolean;
  constructor(keySet: KeySet, isAllChildrenVisible: boolean) {
    this.keySet = keySet;
    this.isAllChildrenVisible = isAllChildrenVisible;
  }
}
export interface ExtendedVisibilityStatus extends VisibilityStatus {
  isChildVisible?: boolean;
}

export interface VisibilityHandlerProps {
  rulesetId: string;
  viewport: Viewport;
  onVisibilityChange?: () => void;
  treeDataProvider: IPresentationTreeDataProvider;
  modelSource: TreeModelSource;
}


/** @internal */
export class VisibilityHandler implements IVisibilityHandler {
  private _props: VisibilityHandlerProps;
  private _activeView?: Viewport;
  private _treeDataProvider: IPresentationTreeDataProvider;
  private _modelSource: TreeModelSource;
  private _onVisibilityChange?: () => void;

  constructor(props: VisibilityHandlerProps) {
    this._props = props;
    this._activeView = props.viewport;
    this._onVisibilityChange = props.onVisibilityChange;
    this._treeDataProvider = props.treeDataProvider;
    this._modelSource = props.modelSource;
  }
  public dispose() {
  }

  public get onVisibilityChange() { return this._onVisibilityChange; }
  public set onVisibilityChange(callback: (() => void) | undefined) { this._onVisibilityChange = callback; }

  public getNodeVisibilityStatus(node: TreeNodeItem) {
    const nodeKey = this._treeDataProvider.getNodeKey(node);
    return this.getVisibilityStatus(node, nodeKey);
  }

  public async getVisibilityStatus(node: TreeNodeItem, nodeKey: NodeKey): Promise<ExtendedVisibilityStatus> {
    const instanceId = VisibilityHandler.getInstanceIdFromTreeNodeKey(nodeKey);
    return this.isItemVisible(instanceId, node);
  }

  private static getInstanceIdFromTreeNodeKey(nodeKey: NodeKey) {
    return (NodeKey.isInstancesNodeKey(nodeKey) && nodeKey.instanceKeys.length > 0) ? nodeKey.instanceKeys[0].id : "";
  }

  public async isItemVisible(instanceId: string, node: TreeNodeItem): Promise<ExtendedVisibilityStatus> {
    if (!this._activeView)
      return { isDisplayed: false, isChildVisible: false };
    const emphasisedElem = EmphasizeElements.getOrCreate(this._activeView);
    const hiddenElems = emphasisedElem.getHiddenElements(this._activeView);
    let isDisplayed = true;

    if (hiddenElems) {
      if (hiddenElems.has(instanceId)) {
        isDisplayed = false;
        // If element is hidden do not bother about it's child state
        return { isDisplayed, isChildVisible: false };
      }

      // Element is either visible or not an instance node. Now check visibility status of its children to decide value of isChildVisible.
      const keys = new KeySet();
      const nodeDetails = new NodeDetails(keys, true);
      await this.getNodeDetailsFromRule(node, this._props.rulesetId, nodeDetails, hiddenElems);

      if (!nodeDetails.isAllChildrenVisible && instanceId === "") { // if this is group node, draw as invisible
        isDisplayed = false;
      }
      // If node is a leaf node
      if (nodeDetails.keySet.instanceKeys.size === 0)
        return { isDisplayed, isChildVisible: true };

      return { isDisplayed, isChildVisible: nodeDetails.isAllChildrenVisible };  // isDisplayed is equivalent to checked which decides the icon's color
    }
    return { isDisplayed, isChildVisible: true };
  }

  public async changeVisibility(node: TreeNodeItem, nodeKey: NodeKey, _shouldDisplay: boolean) {
    const instanceId = VisibilityHandler.getInstanceIdFromTreeNodeKey(nodeKey);
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

    if (hiddenElems) {
      if (instanceId === "") {
        if (nodeDetails.isAllChildrenVisible) {
          // Make all its children invisible
          elementIds.forEach((element) => {
            if (!hiddenElems.has(element))
              hiddenElems.add(element);
          });
          emphasisedElem.hideElements(hiddenElems, this._activeView, true);
        } else {
          // Make all its children visible
          this.setAllChildNodesVisible(elementIds, hiddenElems, this._activeView, emphasisedElem);
        }
      } else if (hiddenElems.has(instanceId)) {
        this.setAllChildNodesVisible(elementIds, hiddenElems, this._activeView, emphasisedElem);
      } else {
        emphasisedElem.hideElements(elementIds, this._activeView, false);
      }
    } else {
      emphasisedElem.hideElements(elementIds, this._activeView, false);
    }

    // get all affected nodes and manage their checkbox states
    const affectedNodeIds: string[] = [node.id];
    const affectedParentIds: string[] = [];
    const modelNode = this._modelSource.getModel().getNode(node.id);
    if (modelNode) {
      if (modelNode.isExpanded) {
        await this.loadChildren(modelNode, affectedNodeIds);
      }
      this.getAllAncestors(modelNode, affectedParentIds);
    }
    if (affectedParentIds.length > 0) {
      this.onParentsVisibilityAffected.emit(affectedParentIds);
    }
    if (affectedNodeIds.length > 0) {
      this.onNodeVisibilityAffected.emit(affectedNodeIds);
    }
  }

  public onParentsVisibilityAffected: BeUiEvent<string[]> = new BeUiEvent<string[]>();
  public onNodeVisibilityAffected: BeUiEvent<string[]> = new BeUiEvent<string[]>();

  private async loadChildren(parent: TreeModelNode | TreeModelRootNode, affectedNodeIds: string[]): Promise<void> {
    const children = this._modelSource.getModel().getChildren(parent.id);
    if (children) {
      for (const sparseValue of children.iterateValues()) {
        affectedNodeIds.push(sparseValue[0]);
        const child = this._modelSource.getModel().getNode(sparseValue[0]);
        if (child && child.isExpanded)
          await this.loadChildren(child, affectedNodeIds);
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
      const childNodeKey = this._treeDataProvider.getNodeKey(child);
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
    const elementKey = this._treeDataProvider.getNodeKey(node);
    const instanceId = VisibilityHandler.getInstanceIdFromTreeNodeKey(elementKey);
    const elementIds: Id64Array = [];

    if (instanceId !== "") {
      await this.getKeySetFromRule(rulesetId, instanceId, nodeDetails);
    } else {
      // If the clicked node is not an instance node, get it's child nodes and then apply rule on the child which is an instance node.
      await this.getGroupNodeDetails(node, nodeDetails);
    }
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
        this.getAllAncestors(parentNode, affectedNodeIds);
      }
    }
  }
}

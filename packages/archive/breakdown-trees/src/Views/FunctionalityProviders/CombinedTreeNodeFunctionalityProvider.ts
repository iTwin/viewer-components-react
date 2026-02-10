/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { NodeKey } from "@itwin/presentation-common";
import type { TreeModel, TreeModelNode } from "@itwin/components-react";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { TreeNodeFunctionalityProvider } from "./TreeNodeFunctionalityProvider";
import { IModelReadRpcInterface } from "@itwin/core-common";

export class CombinedTreeNodeFunctionalityProvider extends TreeNodeFunctionalityProvider {
  private _groupNodeFunctionalityProvider: TreeNodeFunctionalityProvider | undefined;
  private _classFunctionalityMap: Map<string, TreeNodeFunctionalityProvider>;

  constructor(functionalitySourceName: string, treeDataProvider: IPresentationTreeDataProvider, groupNodeFunctionalityProvider?: TreeNodeFunctionalityProvider, classFunctionalityMap?: Map<string, TreeNodeFunctionalityProvider>) {
    super(functionalitySourceName, treeDataProvider);
    this._groupNodeFunctionalityProvider = groupNodeFunctionalityProvider;
    if (classFunctionalityMap)
      this._classFunctionalityMap = classFunctionalityMap;
    else
      this._classFunctionalityMap = new Map<string, TreeNodeFunctionalityProvider>();
  }

  public setFunctionalityProviderForClass(className: string, functionalityProvider: TreeNodeFunctionalityProvider) {
    this._classFunctionalityMap.set(className, functionalityProvider);
  }

  public setFunctionalityProviderForGroupNodes(functionalityProvider: TreeNodeFunctionalityProvider) {
    this._groupNodeFunctionalityProvider = functionalityProvider;
  }

  private async delegateToAppropriateProvider(node: TreeModelNode, treeModel: TreeModel) {
    if (!isPresentationTreeNodeItem(node.item)) {
      return;
    }
    const elementKey = node.item.key;
    if (NodeKey.isGroupingNodeKey(elementKey)) {
      if (this._groupNodeFunctionalityProvider)
        return this._groupNodeFunctionalityProvider.performAction([node], treeModel);
    } else if (NodeKey.isInstancesNodeKey(elementKey)) {
      const classHierarchyArray = await IModelReadRpcInterface.getClient().getClassHierarchy(this._treeDataProvider.imodel.getRpcProps(), elementKey.instanceKeys[0].className);
      for (const className of classHierarchyArray) {
        const mappedFunctionalityProvider = this._classFunctionalityMap.get(className);
        if (mappedFunctionalityProvider)
          return mappedFunctionalityProvider.performAction([node], treeModel);
      }
    }

  }

  public async performAction(nodes: TreeModelNode[], treeModel: TreeModel) {
    if (nodes.length > 0) {
      return this.delegateToAppropriateProvider(nodes[0], treeModel);
    }
  }

}

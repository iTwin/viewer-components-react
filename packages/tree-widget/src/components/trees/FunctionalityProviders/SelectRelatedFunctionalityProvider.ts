/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { KeySet, NodeKey } from "@bentley/presentation-common";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { Presentation} from "@bentley/presentation-frontend";
import { TreeModelNode, TreeNodeItem, DelayLoadedTreeNodeItem } from "@bentley/ui-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { TreeNodeFunctionalityProvider } from "./TreeNodeFunctionalityProvider";
import { RelatedElementIdsProvider } from "../RelatedElementIdsProvider";
import { Id64String } from "@bentley/bentleyjs-core";

export class SelectRelatedFunctionalityProvider extends TreeNodeFunctionalityProvider {
  private _rulesetId: string;

  constructor (functionalitySourceName: string, treeDataProvider: IPresentationTreeDataProvider, rulesetId: string) {
    super (functionalitySourceName, treeDataProvider);
    this._rulesetId = rulesetId;
  }

  public async performAction(node: TreeModelNode) {
    await this.selectRelated(node);
  }

  public async selectRelated (node: TreeModelNode) {
    const keys = new KeySet();
    const elementKey = this._treeDataProvider.getNodeKey(node.item);
    keys.add(elementKey);

    if (NodeKey.isInstancesNodeKey(elementKey)) {
      if (elementKey.instanceKeys !== undefined) {
        const instanceId = elementKey.instanceKeys[0].id;
        const childElemIds = await this.getAllChildNodesFromRule(this._treeDataProvider.imodel, this._rulesetId, instanceId);
        if (childElemIds && childElemIds.size > 0)
          keys.add(childElemIds);
        Presentation.selection.replaceSelection(this._functionalitySourceName, this._treeDataProvider.imodel, keys);
      }
    } else {
      await this.getGroupNodeDetails(node.item, keys);
      Presentation.selection.replaceSelection(this._functionalitySourceName, this._treeDataProvider.imodel, keys);
    }
    return null;
  }
  private getAllChildNodesFromRule(imodel: IModelConnection, rulesetId: string, instanceId: Id64String) {
    const provider = new RelatedElementIdsProvider(imodel, rulesetId, instanceId);
    return provider.getElementIds();
  }

  private async getGroupNodeDetails(node: TreeNodeItem, keys: KeySet) {
    const childNodes = await this._treeDataProvider.getNodes(node);
    for (const child of childNodes) {
      const childNodeKey = this._treeDataProvider.getNodeKey(child);
      if (NodeKey.isInstancesNodeKey(childNodeKey) && childNodeKey.instanceKeys.length > 0) {
        keys.add(childNodeKey.instanceKeys);
        const childInstanceId = childNodeKey.instanceKeys[0].id;
        const childElemIds = await this.getAllChildNodesFromRule(this._treeDataProvider.imodel, this._rulesetId, childInstanceId);
        if (childElemIds && childElemIds.size > 0)
          keys.add(childElemIds);
      } else {
        await this.getGroupNodeDetails(child, keys);
      }
    }
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { NodeKey } from "@bentley/presentation-common";
import { TreeModelNode } from "@bentley/ui-components";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import { Id64 } from "@bentley/bentleyjs-core";
import { TreeNodeFunctionalityProvider } from "./TreeNodeFunctionalityProvider";

export class ZoomFunctionalityProvider extends TreeNodeFunctionalityProvider {

  public async performAction(node: TreeModelNode) {
    await this.zoomSelected(node);
  }

  private static async getElementProps(
    iModel: IModelConnection,
    elemIds: string[] | string
  ) {
    const arr = [...Id64.toIdSet(elemIds)];
    const limit = 100;
    const promises = [];
    while (arr.length > 0) {
      promises.push(iModel.elements.getProps(arr.splice(0, limit)));
    }
    const arrays = await Promise.all(promises);
    return arrays.reduce((a, b) => a.concat(b), []);
  }

  public async zoomSelected (node: TreeModelNode) {
    const elementKey = this._treeDataProvider.getNodeKey(node.item)
    if (NodeKey.isInstancesNodeKey(elementKey)){
      const elemProps = await ZoomFunctionalityProvider.getElementProps(
        IModelApp.viewManager.selectedView!.iModel,
        elementKey.instanceKeys[0].id
      );
      await IModelApp.viewManager.selectedView!.zoomToElementProps(elemProps);
    }
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { NodeKey } from "@bentley/presentation-common";
import { TreeModelNode } from "@bentley/ui-components";
import { IModelApp, IModelConnection, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@bentley/imodeljs-frontend";
import { BeEvent, Id64 } from "@bentley/bentleyjs-core";
import { TreeNodeFunctionalityProvider } from "./TreeNodeFunctionalityProvider";
import { MessageManager, NotifyMessageDetailsType } from "@bentley/ui-framework";
import { DataLink } from "../visibility/DataLink";
import { BreakdownTrees } from "../../BreakdownTrees";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";

export class ZoomFunctionalityProvider extends TreeNodeFunctionalityProvider {
  private _onActionPerformedEvent: BeEvent<() => void>;

  constructor(sourceName: string, treeDataProvider: IPresentationTreeDataProvider, onActionPerformedEvent?: BeEvent<() => void>) {
    super(sourceName, treeDataProvider);
    this._onActionPerformedEvent = onActionPerformedEvent!;
  }

  public async performAction(nodes: TreeModelNode[]) {
    if (nodes.length > 0) {
      await this.zoomSelected(nodes[0]);

      // Raising event when zoomToElements is clicked
      if (this._onActionPerformedEvent)
        this._onActionPerformedEvent.raiseEvent();
    }
  }

  public static async getElementProps(
    iModel: IModelConnection,
    elemIds: string[] | string,
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

  public async zoomSelected(node: TreeModelNode) {
    const elementKey = this._treeDataProvider.getNodeKey(node.item)
    if (NodeKey.isInstancesNodeKey(elementKey)) {
      const data = await DataLink.querySpatialIndex(this._treeDataProvider.imodel, elementKey.instanceKeys[0].id);
      if (data.length === 0) {
        // check if element has any child with geometry
        const child = await DataLink.queryChildWithGeometry(this._treeDataProvider.imodel, elementKey.instanceKeys[0].id);
        if (child.length === 0) {
          const message: NotifyMessageDetailsType = new NotifyMessageDetails(OutputMessagePriority.Info, BreakdownTrees.translate("zoomToElement.briefTimeoutMessage"), BreakdownTrees.translate("zoomToElement.detailedTimeoutMessage"), OutputMessageType.Toast);
          MessageManager.addMessage(message);
          return;
        }

        const elemProps = await ZoomFunctionalityProvider.getElementProps(
          IModelApp.viewManager.selectedView!.iModel,
          child,
        );
        await IModelApp.viewManager.selectedView!.zoomToElementProps(elemProps);

      } else {
        const elemProps = await ZoomFunctionalityProvider.getElementProps(
          IModelApp.viewManager.selectedView!.iModel,
          elementKey.instanceKeys[0].id,
        );
        await IModelApp.viewManager.selectedView!.zoomToElementProps(elemProps);
      }
    }

  }
}

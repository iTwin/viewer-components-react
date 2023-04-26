/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { NodeKey } from "@itwin/presentation-common";
import type { TreeModelNode } from "@itwin/components-react";
import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import type { BeEvent } from "@itwin/core-bentley";
import { Id64 } from "@itwin/core-bentley";
import { TreeNodeFunctionalityProvider } from "./TreeNodeFunctionalityProvider";
import type { NotifyMessageDetailsType } from "@itwin/appui-react";
import { MessageManager } from "@itwin/appui-react";
import { DataLink } from "../visibility/DataLink";
import { BreakdownTrees } from "../../BreakdownTrees";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";

export class ZoomFunctionalityProvider extends TreeNodeFunctionalityProvider {
  private _onActionPerformedEvent: BeEvent<() => void> | undefined;

  constructor(sourceName: string, treeDataProvider: IPresentationTreeDataProvider, onActionPerformedEvent: BeEvent<() => void> | undefined) {
    super(sourceName, treeDataProvider);
    this._onActionPerformedEvent = onActionPerformedEvent;
  }

  public async performAction(nodes: TreeModelNode[]) {
    if (nodes.length > 0) {
      await this.zoomSelected(nodes[0]);

      // Raising event when zoomToElements is clicked
      if (this._onActionPerformedEvent)
        this._onActionPerformedEvent.raiseEvent();
    }
  }

  private static async getElementProps(
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
    if (!isPresentationTreeNodeItem(node.item)) {
      return;
    }
    const elementKey = node.item.key;
    if (NodeKey.isInstancesNodeKey(elementKey)) {
      const data = await DataLink.querySpatialIndex(this._treeDataProvider.imodel, elementKey.instanceKeys[0].id);
      if (data.length === 0) {
        // check if element has any child with geometry
        const child = await DataLink.queryChildWithGeometry(this._treeDataProvider.imodel, elementKey.instanceKeys[0].id);
        if (child.length === 0) {
          const message: NotifyMessageDetailsType = new NotifyMessageDetails(
            OutputMessagePriority.Info,
            BreakdownTrees.translate("zoomToElement.briefTimeoutMessage"),
            BreakdownTrees.translate("zoomToElement.detailedTimeoutMessage"),
            OutputMessageType.Toast
          );
          MessageManager.addMessage(message);
          return;
        }

        const elemProps = await ZoomFunctionalityProvider.getElementProps(
          IModelApp.viewManager.selectedView!.iModel,
          child,
        );
        IModelApp.viewManager.selectedView!.zoomToElementProps(elemProps);

      } else {
        const elemProps = await ZoomFunctionalityProvider.getElementProps(
          IModelApp.viewManager.selectedView!.iModel,
          elementKey.instanceKeys[0].id,
        );
        IModelApp.viewManager.selectedView!.zoomToElementProps(elemProps);
      }
    }

  }
}

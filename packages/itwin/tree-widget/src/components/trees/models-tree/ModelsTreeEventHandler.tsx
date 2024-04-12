/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import { IModelApp } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { VisibilityTreeEventHandler } from "../VisibilityTreeEventHandler";
import { ModelsTreeNodeType } from "./ModelsVisibilityHandler";
import { getNodeType } from "./NodeUtils";

import type { TreeNodeEventArgs } from "@itwin/components-react";
export class ModelsTreeEventHandler extends VisibilityTreeEventHandler {
  public override async onNodeDoubleClick({ nodeId }: TreeNodeEventArgs) {
    const model = this.modelSource.getModel();
    const node = model.getNode(nodeId);

    if (
      !node ||
      !isPresentationTreeNodeItem(node.item) ||
      getNodeType(node.item) !== ModelsTreeNodeType.Element ||
      !NodeKey.isInstancesNodeKey(node.item.key)
    ) {
      return;
    }

    const instanceIds = node.item.key.instanceKeys.map((instanceKey) => instanceKey.id);

    await IModelApp.viewManager.selectedView?.zoomToElements(instanceIds);
  }
}

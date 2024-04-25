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
import { ModelsTreeNodeType, ModelsVisibilityHandler } from "./ModelsVisibilityHandler";

import type { VisibilityTreeEventHandlerParams } from "../VisibilityTreeEventHandler";
import type { TreeNodeEventArgs } from "@itwin/components-react";
import type { UsageTrackedFeatures } from "../common/UseFeatureReporting";

export interface ModelsTreeEventHandlerProps extends VisibilityTreeEventHandlerParams {
  reportUsage: (props: { featureId?: UsageTrackedFeatures; reportInteraction: boolean }) => void;
}

export class ModelsTreeEventHandler extends VisibilityTreeEventHandler {
  private _reportUsage: (props: { featureId: "zoom-to-node"; reportInteraction: false }) => void;

  constructor(props: ModelsTreeEventHandlerProps) {
    super(props);
    this._reportUsage = props.reportUsage;
  }

  public override async onNodeDoubleClick({ nodeId }: TreeNodeEventArgs) {
    const model = this.modelSource.getModel();
    const node = model.getNode(nodeId);

    if (
      !node ||
      !isPresentationTreeNodeItem(node.item) ||
      ModelsVisibilityHandler.getNodeType(node.item) !== ModelsTreeNodeType.Element ||
      !NodeKey.isInstancesNodeKey(node.item.key)
    ) {
      return;
    }

    const instanceIds = node.item.key.instanceKeys.map((instanceKey) => instanceKey.id);

    await IModelApp.viewManager.selectedView?.zoomToElements(instanceIds);

    this._reportUsage({ featureId: "zoom-to-node", reportInteraction: false });
  }
}

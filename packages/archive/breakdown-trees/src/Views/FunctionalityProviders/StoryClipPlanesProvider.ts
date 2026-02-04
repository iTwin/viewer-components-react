/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { NodeKey } from "@itwin/presentation-common";
import type { TreeModelNode } from "@itwin/components-react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import { ToggledTopFitViewFunctionalityProvider } from "./ToggledTopFitViewFunctionalityProvider";
import { SectioningUtil } from "../visibility/SectioningUtil";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import type { NotifyMessageDetailsType } from "@itwin/appui-react";
import { MessageManager } from "@itwin/appui-react";
import { BreakdownTrees } from "../../BreakdownTrees";

export class StoryClipPlanesProvider extends ToggledTopFitViewFunctionalityProvider {

  public showSpaceLabels: boolean;
  public clipHeight?: number;
  public clipAtSpaces?: boolean;

  constructor(functionalitySourceName: string, treeDataProvider: IPresentationTreeDataProvider, setTopView: boolean, showSpaceLabels: boolean, clipHeight?: number) {
    super(functionalitySourceName, treeDataProvider, setTopView);
    this.showSpaceLabels = showSpaceLabels;
    this.clipHeight = clipHeight;
  }

  public async performAction(nodes: TreeModelNode[]) {
    if (nodes.length > 0) {
      await this.clipSection(nodes[0]);
    }
  }

  private async createSectionPlane(nodeInstanceId: string): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (vp) {
      if (nodeInstanceId) {
        // section the story
        const sectionCreated = await SectioningUtil.isolateRoomsForStories(this._treeDataProvider.imodel, vp, nodeInstanceId, this.clipHeight, this.clipAtSpaces);
        if (!sectionCreated) {
          const message: NotifyMessageDetailsType = new NotifyMessageDetails(
            OutputMessagePriority.Info,
            BreakdownTrees.translate("clipSection.briefTimeoutMessage"),
            BreakdownTrees.translate("clipSection.detailedTimeoutMessage"),
            OutputMessageType.Toast
          );
          MessageManager.addMessage(message);
          return false;
        }
        SectioningUtil.setSpaceLabelVisible(this.showSpaceLabels);
        return true;
      }
    }
    return false;
  }

  private async clipSection(node: TreeModelNode) {
    const elementKey = isPresentationTreeNodeItem(node.item) ? node.item.key : undefined;
    if (!elementKey) {
      return;
    }
    if (NodeKey.isInstancesNodeKey(elementKey)) {
      const instanceId = elementKey.instanceKeys[0].id;
      if (await this.createSectionPlane(instanceId))
        await super.performAction([node]);
    }
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { NodeKey } from "@bentley/presentation-common";
import { TreeModelNode } from "@bentley/ui-components";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@bentley/imodeljs-frontend";
import { ToggledTopFitViewFunctionalityProvider } from "./ToggledTopFitViewFunctionalityProvider";
import { SectioningUtil } from "../visibility/SectioningUtil";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { MessageManager, NotifyMessageDetailsType } from "@bentley/ui-framework";
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
          const message: NotifyMessageDetailsType = new NotifyMessageDetails(OutputMessagePriority.Info, BreakdownTrees.translate("clipSection.briefTimeoutMessage"), BreakdownTrees.translate("clipSection.detailedTimeoutMessage"), OutputMessageType.Toast);
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
    const elementKey = this._treeDataProvider.getNodeKey(node.item);
    if (NodeKey.isInstancesNodeKey(elementKey)) {
      const instanceId = elementKey.instanceKeys[0].id;
      if (await this.createSectionPlane(instanceId))
        super.performAction([node]);
    }
  }

}

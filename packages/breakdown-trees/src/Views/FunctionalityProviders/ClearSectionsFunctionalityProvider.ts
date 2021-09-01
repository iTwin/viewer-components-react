/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { TreeModelNode } from "@bentley/ui-components";
import { IModelApp, ViewClipClearTool, ViewClipDecorationProvider } from "@bentley/imodeljs-frontend";
import { TreeNodeFunctionalityProvider } from "./TreeNodeFunctionalityProvider";
import { SectioningUtil } from "../visibility/SectioningUtil";

export class ClearSectionsFunctionalityProvider extends TreeNodeFunctionalityProvider {

  public async performAction(nodes: TreeModelNode[]) {
    if (nodes.length > 0) {
      await this.clearSections(nodes[0]);
    }
  }

  public async clearSections(_node: TreeModelNode) {
    const vp = IModelApp.viewManager.selectedView;
    if (vp) {
      await SectioningUtil.isolateRoomsForStories(this._treeDataProvider.imodel, vp);
      // Clear section handles
      IModelApp.tools.run(ViewClipClearTool.toolId, ViewClipDecorationProvider.create());
    }
  }
}

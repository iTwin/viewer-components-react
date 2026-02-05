/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { TreeModelNode } from "@itwin/components-react";
import { IModelApp, StandardViewId, ViewManip } from "@itwin/core-frontend";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { TreeNodeFunctionalityProvider } from "./TreeNodeFunctionalityProvider";
export class ToggledTopFitViewFunctionalityProvider extends TreeNodeFunctionalityProvider {
  protected isTopViewSet: boolean;

  public async performAction(_node: TreeModelNode[]) {
    if (this.isTopViewSet)
      this.handleTopView();
  }

  public setTopView(setTopView: boolean) {
    this.isTopViewSet = setTopView;
  }
  constructor(functionalitySourceName: string, treeDataProvider: IPresentationTreeDataProvider, setTopView: boolean) {
    super(functionalitySourceName, treeDataProvider);
    this.isTopViewSet = setTopView;
  }
  private handleTopView() {
    for (const vp of IModelApp.viewManager) {
      vp.setStandardRotation(StandardViewId.Top);
      ViewManip.fitView(vp, true);
    }

    if (IModelApp.viewManager.selectedView?.view.is3d())
      IModelApp.viewManager.selectedView.view.turnCameraOff();

  }

}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TreeModelNode } from "@bentley/ui-components";
import { IModelApp, ScreenViewport,
  StandardViewId,
  ViewManip, ViewState3d } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
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
    super (functionalitySourceName, treeDataProvider);
    this.isTopViewSet = setTopView;
  }
  private handleTopView() {
      IModelApp.viewManager.forEachViewport((vp: ScreenViewport) => {
        vp.setStandardRotation(StandardViewId.Top);
        ViewManip.fitView(vp, true);
      });

      if (
        IModelApp.viewManager.selectedView &&
        IModelApp.viewManager.selectedView.view instanceof ViewState3d
      )
        (IModelApp.viewManager.selectedView.view as ViewState3d).turnCameraOff();

  }

}

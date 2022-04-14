/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { NodeKey } from "@itwin/presentation-common";
import { TreeModelNode } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { ToggledTopFitViewFunctionalityProvider } from "./ToggledTopFitViewFunctionalityProvider";
import { GeometricElement3dProps } from "@itwin/core-common";
import { Placement3d } from "@itwin/core-common";
import { ClipPrimitive, ClipVector, ConvexClipPlaneSet } from "@itwin/core-geometry";
import { IPresentationTreeDataProvider } from "@itwin/presentation-components";

export class SpaceClipPlanesProvider extends ToggledTopFitViewFunctionalityProvider {
  public defaultHeight?: number;
  constructor(functionalitySourceName: string, treeDataProvider: IPresentationTreeDataProvider, setTopView: boolean, defaultHeight?: number) {
    super(functionalitySourceName, treeDataProvider, setTopView);
    this.defaultHeight = defaultHeight;
  }

  public async performAction(nodes: TreeModelNode[]) {
    if (nodes.length > 0) {
      await this.clipViewToSpace(nodes[0]);
    }
  }

  private async executeQuery(iModel: IModelConnection, query: string) {
    const rows = [];
    for await (const row of iModel.query(query, undefined, { rowFormat: 0 })) rows.push(row);
    return rows;
  }

  private async checkIsSpace(iModel: IModelConnection, spaceId: string) {
    const query = `SELECT ECInstanceId as id FROM BuildingSpatial.Space WHERE ECInstanceId = ${spaceId}`;

    const rows = await this.executeQuery(iModel, query);
    return rows.length > 0;
  }

  private async createSectionPlanes(elementId: string) {
    const vp = IModelApp.viewManager.selectedView;
    const imodel = this._treeDataProvider.imodel;
    if (vp && elementId) {
      const isSpace = await this.checkIsSpace(imodel, elementId);
      if (!isSpace)
        return;

      const elementProps = await imodel.elements.getProps(elementId);
      const spaceProps = elementProps[0] as GeometricElement3dProps;

      const placement = Placement3d.fromJSON(spaceProps.placement);
      const spaceRange = placement.calculateRange();
      if (Math.abs(spaceRange.high.z - spaceRange.low.z) < 0.1 && this.defaultHeight)
        spaceRange.high.z = spaceRange.low.z + this.defaultHeight;

      const planeSet = ConvexClipPlaneSet.createRange3dPlanes(spaceRange, true, true, true, true, true, true);

      const clip = ClipVector.createCapture([ClipPrimitive.createCapture(planeSet)]);
      vp.view.setViewClip(clip);
      vp.setupFromView();
    }
  }

  private async clipViewToSpace(node: TreeModelNode) {
    const elementKey = this._treeDataProvider.getNodeKey(node.item);
    if (NodeKey.isInstancesNodeKey(elementKey)) {
      const instanceId = elementKey.instanceKeys[0].id;
      await this.createSectionPlanes(instanceId);
      await super.performAction([node]);
    }
  }
}

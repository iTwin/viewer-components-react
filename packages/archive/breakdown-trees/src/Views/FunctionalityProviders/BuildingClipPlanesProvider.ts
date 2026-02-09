/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { NodeKey } from "@itwin/presentation-common";
import type { TreeModelNode } from "@itwin/components-react";
import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { ToggledTopFitViewFunctionalityProvider } from "./ToggledTopFitViewFunctionalityProvider";
import { ClipPrimitive, ClipVector, ConvexClipPlaneSet, Range3d } from "@itwin/core-geometry";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";

export class BuildingClipPlanesProvider extends ToggledTopFitViewFunctionalityProvider {
  constructor(functionalitySourceName: string, treeDataProvider: IPresentationTreeDataProvider, setTopView: boolean) {
    super(functionalitySourceName, treeDataProvider, setTopView);
  }

  public async performAction(nodes: TreeModelNode[]) {
    if (nodes.length > 0) {
      await this.clipViewToBilding(nodes[0]);
    }
  }

  private async executeQuery(iModel: IModelConnection, query: string) {
    const res = iModel.createQueryReader(query, undefined, { rowFormat: 0 });
    const rows = await res.toArray();
    return rows;
  }

  private async checkIsBuilding(iModel: IModelConnection, bldgId: string) {
    const query = `SELECT ECInstanceId as id FROM BuildingSpatial.Building WHERE ECInstanceId = ${bldgId}`;

    const rows = await this.executeQuery(iModel, query);
    return rows.length > 0;
  }

  private async queryBuildingRange(iModel: IModelConnection, bldgId: string): Promise<Range3d | undefined> {
    const queryGetBuildingProps = `select MIN(spel.origin.x + spel.bboxlow.x) as minX, MIN(spel.origin.y + spel.bboxlow.y) as minY, MIN(spel.origin.z + spel.bboxlow.z) as minZ, MAX(spel.origin.x + spel.bboxhigh.x) as maxX, MAX(spel.origin.y + spel.bboxhigh.y) as maxY, MAX(spel.origin.z + spel.bboxhigh.z) as maxZ from spatialcomposition.CompositeOverlapsSpatialElements ovr join biscore.spatialElement spel on spel.ECinstanceId = ovr.targetecinstanceid where sourceECInstanceId in (select sp.ecinstanceid from buildingSpatial.building b join buildingspatial.story s on s.composingelement.id=b.ecinstanceid join buildingspatial.space sp on sp.composingelement.id=s.ecinstanceid where b.ecinstanceid=${bldgId} union select s.ecinstanceid from buildingSpatial.building b join buildingspatial.story s on s.composingelement.id=b.ecinstanceid where b.ecinstanceid=${bldgId})`;
    const rows = await this.executeQuery(iModel, queryGetBuildingProps);
    if (rows.length > 0 && rows[0].minX)
      return new Range3d(rows[0].minX, rows[0].minY, rows[0].minZ, rows[0].maxX, rows[0].maxY, rows[0].maxZ);
    return undefined;
  }

  private async createSectionPlanes(elementId: string) {
    const vp = IModelApp.viewManager.selectedView;
    const imodel = this._treeDataProvider.imodel;
    if (vp && elementId) {
      const isSpace = await this.checkIsBuilding(imodel, elementId);
      if (!isSpace)
        return;

      const bldgRange = await this.queryBuildingRange(imodel, elementId);

      if (bldgRange === undefined)
        return;

      const planeSet = ConvexClipPlaneSet.createRange3dPlanes(bldgRange, true, true, true, true, true, true);

      const clip = ClipVector.createCapture([ClipPrimitive.createCapture(planeSet)]);
      vp.view.setViewClip(clip);
      vp.setupFromView();

    }
  }

  private async clipViewToBilding(node: TreeModelNode) {
    const elementKey = isPresentationTreeNodeItem(node.item) ? node.item.key : undefined;
    if (!elementKey) {
      return;
    }
    if (NodeKey.isInstancesNodeKey(elementKey)) {
      const instanceId = elementKey.instanceKeys[0].id;
      await this.createSectionPlanes(instanceId);
      await super.performAction([node]);
    }

  }
}

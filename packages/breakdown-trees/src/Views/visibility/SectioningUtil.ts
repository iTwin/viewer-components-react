/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {BeButtonEvent, EmphasizeElements, IModelApp, IModelConnection, Tool, Viewport, ViewState3d } from "@bentley/imodeljs-frontend";
import { ClipPlane, ClipPrimitive, ClipVector, ConvexClipPlaneSet, Plane3dByOriginAndUnitNormal, Point3d, Range3d, Vector3d } from "@bentley/geometry-core";
import { ColorDef, RenderMode } from "@bentley/imodeljs-common";
import { DataLink } from "./DataLink";
import { SpaceLabelDecorator } from "./SpaceLabelDecorator";
import { SpaceLabelDecoration } from "./SpaceLabelDecoration";

export class SectioningUtil {
  private static _spaceDecorator?: SpaceLabelDecorator = undefined;
  private static _toolChangedRemover?: () => void = undefined;

  public static async setupRoomIsolationMode (imodel: IModelConnection, vp: Viewport) {
    // const color = ColorDef.white;
    // const pattern = LinePixels.Solid;
    // const width   = 2;

    // // Set up the display style to make the rooms look good
    const style = (vp.view as ViewState3d).getDisplayStyle3d().clone(vp.iModel);
    // const hline = style.settings.hiddenLineSettings.override({ visible: { color, pattern, width } });
    // style.settings.hiddenLineSettings = hline;

    const vf = style.viewFlags.clone();
    vf.renderMode = RenderMode.SmoothShade;
    vf.visibleEdges = false;
    vf.hiddenEdges = false;
    vf.backgroundMap = false;
    style.viewFlags = vf;
    vp.displayStyle = style;
    vp.invalidateRenderPlan();

    const categoriesToHide = ["OST_MEPSpaceSeparationLines", "OST_RoomSeparationLines", "OST_VolumeOfInterest", "OST_Rebar"];
    categoriesToHide.push ("OST_Rooms");
    categoriesToHide.push ("OST_Levels");
    categoriesToHide.push ("OST_GenericModel");
    // categoriesToHide.push ("OST_MEPSpaces");
    const categoryIds = await DataLink.queryCategoryIds(imodel, categoriesToHide);
    vp.changeCategoryDisplay(categoryIds, false, true);
  }

  public static async isolateSpaceElements (imodel: IModelConnection, vp: Viewport, roomIds: string[]) {
    // This branch will display just the rooms (spaces) and not any of the spatial or physical elements.
    let elemsToIsolate = roomIds;
    if (false) {
      elemsToIsolate = await DataLink.queryPhysicalOverlapsRooms (imodel, roomIds);
    }

    const emph = EmphasizeElements.getOrCreate(vp);
    emph.isolateElements (elemsToIsolate, vp, true);
  }

  public static async isolateRoomsForStories(imodel: IModelConnection, vp: Viewport, storyId?: string, clipHeight?: number, clipAtSpaces?: boolean): Promise<boolean> {
    const rooms = await DataLink.queryRooms(imodel, storyId);
    if (!this._spaceDecorator) {
      this._spaceDecorator = new SpaceLabelDecorator();
    }
    if (undefined === storyId) {
      // Turn off view clipping
      if (vp.viewFlags.clipVolume) {
        vp.view.setViewClip();
        vp.setupFromView();
      }
      if (this._toolChangedRemover) {
        this._toolChangedRemover();
        this._toolChangedRemover = undefined;
      }
      if (this._spaceDecorator) {
        this._spaceDecorator.clearDecorations();
      }
      return false;
    }
    const storyRange = await DataLink.queryStoryRange(imodel, storyId, clipAtSpaces ? clipAtSpaces : false);
    if (storyRange === undefined)
      return false;
    // const planeSet = ConvexClipPlaneSet.createRange3dPlanes(storyRange, false, false, false, false, false, false);
    const planeSet = ConvexClipPlaneSet.createEmpty();

    // We are going to create two clipping planes to filter the view.  One plane at the
    // top of the story (shifted down a bit to remove the ceiling) and one at the
    // bottom (shifted down a bit so it includes but isn't coincident with the floor).
    // This only makes sense for one story at a time.

    // Turn on view clipping
    if (!vp.viewFlags.clipVolume) {
      const viewFlags = vp.viewFlags.clone();
      viewFlags.clipVolume = true;
      vp.viewFlags = viewFlags;
    }

    if (!this._toolChangedRemover) {
      this._toolChangedRemover = IModelApp.toolAdmin.activeToolChanged.addListener(this._handleSectionClearedFromTool);
    }

    this._spaceDecorator.clearDecorations();

    const sliceHeight = clipHeight === undefined ? storyRange.zLength() : clipHeight;
    SectioningUtil.createZPlane (planeSet, storyRange.zLow, false, storyRange); // bottom plane
    SectioningUtil.createZPlane (planeSet, storyRange.zLow + sliceHeight, true, storyRange); // top plane

    SectioningUtil.createXPlane(planeSet, storyRange.xLow, false, storyRange);
    SectioningUtil.createXPlane(planeSet, storyRange.xLow + storyRange.xLength(), true, storyRange );

    SectioningUtil.createYPlane(planeSet, storyRange.yLow, false, storyRange);
    SectioningUtil.createYPlane(planeSet, storyRange.yLow + storyRange.yLength(), true, storyRange);

    const prim = ClipPrimitive.createCapture(planeSet);
    const clip = ClipVector.createEmpty();
    clip.appendReference(prim);
    vp.view.setViewClip(clip);
    vp.setupFromView();

    if ( rooms && rooms.length > 0) {
      const roomIds = rooms.map ((row: any) => ( row.id ));
      await this.addSpaceDecorations(imodel, roomIds);
    }
    return true;
  }

  public static setSpaceLabelVisible(visible: boolean) {
    if (!this._spaceDecorator) {
      return;
    }
    if (visible) {
      this._spaceDecorator.showDecorations();
    } else {
      this._spaceDecorator.hideDecorations();
    }
    IModelApp.viewManager.invalidateDecorationsAllViews();
  }

  private static async addSpaceDecorations(imodel: IModelConnection, roomIds: any) {
    if (this._spaceDecorator) {
      await this._spaceDecorator.addDecorationsForSpaces(imodel, roomIds, this._handleSpaceDecorationClicked);
    }
  }

  private static _handleSpaceDecorationClicked = (ev: BeButtonEvent, decoration?: SpaceLabelDecoration) => {
    // tslint:disable-next-line:no-console
    console.log(`Event: ${ev}, Marker: ${decoration}`);
  }

  private static _handleSectionClearedFromTool = (tool: Tool) => {
    const toolId = tool.toolId;
    if (toolId === "ViewClip.Clear") {
      if (SectioningUtil._spaceDecorator) {
        SectioningUtil._spaceDecorator?.clearDecorations();
      }

      if (SectioningUtil._toolChangedRemover) {
        SectioningUtil._toolChangedRemover();
        SectioningUtil._toolChangedRemover = undefined;
      }
    }
  }

  // Create a plane representing either the ceiling or floor of a room.
  private static createZPlane (planeSet: ConvexClipPlaneSet, z: number, top: boolean, storyRange: Range3d) {
    const botPlaneOffset = -0.01;
    const normal = Vector3d.create (0, 0, top ? -1.0 : 1.0);
    const origin = Point3d.create((storyRange.xLow + storyRange.xHigh) / 2, (storyRange.yLow + storyRange.yHigh) / 2, top ? z : z + botPlaneOffset);

    const plane = Plane3dByOriginAndUnitNormal.create(origin, normal);
    if (undefined === plane)
      return;

    planeSet.addPlaneToConvexSet(ClipPlane.createPlane(plane));
  }

  private static createXPlane (planeSet: ConvexClipPlaneSet, x: number, top: boolean, storyRange: Range3d) {
    const botPlaneOffset = 0.01;
    const normal = Vector3d.create (top ? -1.0 : 1.0, 0 , 0);
    const origin = Point3d.create(top ? x + botPlaneOffset : x - botPlaneOffset, (storyRange.yLow + storyRange.yHigh) / 2, (storyRange.zLow + storyRange.zHigh) / 2);

    const plane = Plane3dByOriginAndUnitNormal.create(origin, normal);
    if (undefined === plane)
      return;

    planeSet.addPlaneToConvexSet(ClipPlane.createPlane(plane));
  }

  private static createYPlane (planeSet: ConvexClipPlaneSet, y: number, top: boolean, storyRange: Range3d) {
    const botPlaneOffset = 0.01;
    const normal = Vector3d.create ( 0, top ? -1.0 : 1.0, 0);
    const origin = Point3d.create((storyRange.xLow + storyRange.xHigh) / 2, top ? y + botPlaneOffset : y - botPlaneOffset, (storyRange.zLow + storyRange.zHigh) / 2);

    const plane = Plane3dByOriginAndUnitNormal.create(origin, normal);
    if (undefined === plane)
      return;

    planeSet.addPlaneToConvexSet(ClipPlane.createPlane(plane));
  }


  public static emphasizeRooms(vp: Viewport, roomIds: string[]) {
    const emph = EmphasizeElements.getOrCreate(vp);
    emph.overrideElements (roomIds, vp, ColorDef.blue, undefined, true);
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ClipVector, Matrix3d, MomentData, Plane3dByOriginAndUnitNormal, Point3d, Range3d, Ray3d, StandardViewIndex, Vector3d } from "@itwin/core-geometry";
import type { StyleSet } from "./GraphicStyle";
import { Polygon } from "./Polygon";
import {
  IModelApp,
  OffScreenViewport,
  Pixel,
  QuantityType,
  type ScreenViewport,
  SpatialViewState,
  type Tile,
  TileTreeLoadStatus,
  type Viewport,
  ViewRect,
  type ViewState
} from "@itwin/core-frontend";
import { ColorDef, type ContextRealityModelProps, RenderMode } from "@itwin/core-common";
import { MeasureTools } from "../MeasureTools";

export class VolumeInfo {
  public get net() { return this.cut - this.fill; }
  public cut = 0;   // in cubic-meter
  public fill = 0;  // in cubic-meter
  public area = 0;  // in square-meter
  public hitCount = 0; // how many pixels were part of the computation
  public pixelCount = 0; // how many pixels we had
  public pixelSize = 0;
}

export class VolumePolygon extends Polygon {
  private _volume?: number;
  private _cut?: number;
  private _fill?: number;

  public get volume(): number | undefined {
    return this._volume;
  }
  public get cut(): number | undefined {
    return this._cut;
  }
  public get fill(): number | undefined {
    return this._fill;
  }

  constructor(points: Point3d[], copyPoints: boolean = true, styleSet?: StyleSet, worldScale?: number) {
    super(points, copyPoints, styleSet, worldScale);
    this.overrideText = [MeasureTools.localization.getLocalizedString("MeasureTools:Generic.loadingSpinnerText")];
  }

  public override async recomputeFromPoints(targetView?: ScreenViewport) {
    super.recomputeFromPoints();
    const volume = await this.computeVolume(targetView ?? IModelApp.viewManager.selectedView);
    const netVolume = volume?.net;
    if (netVolume){
      this._volume = netVolume;
      const volumeFormatter = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Volume);
      const fVolume = IModelApp.quantityFormatter.formatQuantity(this.worldScale * this.worldScale * this.worldScale * this._volume, volumeFormatter);
      this.overrideText = [fVolume];
      this._cut = volume.cut;
      this._fill = volume.fill;
    }
    return volume;
  }

  private async computeVolume(viewport?: ScreenViewport) {
    const plane = this.computeShapePlane();
    if (!plane)
      return;
    const shapeOnPlane = this.projectShapeToMeanPlane(plane);
    if (!plane || !shapeOnPlane || !viewport)
      return;

    const clip = ClipVector.createEmpty();
    if (!clip.appendShape(shapeOnPlane)) {
      return;
    }

    const shapeRangeWorld = Range3d.createArray(shapeOnPlane);
    const offscreenViewport = VolumePolygon.createElevationViewport(shapeRangeWorld, viewport.view, clip);

    if (!offscreenViewport === undefined) {
      return;
    }

    const volume = await this.doComputeVolume(offscreenViewport, plane);
    if (!volume) {
      return;
    }

    return volume;
  }

  private computeShapePlane(): Plane3dByOriginAndUnitNormal | undefined {
    const momentData = MomentData.pointsToPrincipalAxes(this.points);
    if (!momentData)
      {return undefined;}

    const colZ = momentData.localToWorldMap.matrix.columnZ();
    return Plane3dByOriginAndUnitNormal.create(momentData.origin, colZ);
  }

  /* Compute the mean plane and project the shape to this plane in the z direction */
  private projectShapeToMeanPlane(plane: Plane3dByOriginAndUnitNormal): Point3d[] | undefined {
    if (plane === undefined)
      {return undefined;}

    const shapeOnPlane: Point3d[] = [];
    for (const pt of this.points) {
      const ray = Ray3d.create(pt, Vector3d.create(0, 0, 1));
      const intersectPt = Point3d.createZero();
      if (ray.intersectionWithPlane(plane, intersectPt) === undefined)
        {return undefined;}

      shapeOnPlane.push(intersectPt);
    }
    return shapeOnPlane;
  }

  private async doComputeVolume(viewport: OffScreenViewport, plane: Plane3dByOriginAndUnitNormal): Promise<VolumeInfo | undefined> {
    await this.waitForAllTilesToRender(viewport);
    const viewRect = viewport.viewRect;
    const devicePixelSize = viewport.getPixelSizeAtPoint() * viewport.devicePixelRatio;
    let volume: VolumeInfo | undefined;

    // Input rect is specified in CSS pixels - convert to device pixels.
    const deviceRect = new ViewRect(
      viewport.cssPixelsToDevicePixels(viewRect.left),
      viewport.cssPixelsToDevicePixels(viewRect.top),
      viewport.cssPixelsToDevicePixels(viewRect.right),
      viewport.cssPixelsToDevicePixels(viewRect.bottom)
    );

    viewport.readPixels(viewRect, Pixel.Selector.GeometryAndDistance, (pixels) => {
      if (!pixels)
        return;

      volume = this.computeVolumeNpc(viewport, pixels, devicePixelSize, deviceRect, plane);
    });

    if (!volume)
      return undefined;

    volume.pixelCount = deviceRect.width * deviceRect.height;
    volume.pixelSize = devicePixelSize;
    volume.area = volume.hitCount * devicePixelSize * devicePixelSize;
    return volume;
  }

  /* Compute volume using Npc coordinate. Usually twice as fast than computeVolumeWorld.
  *  It assumed a Npc to World transform without perspective and top oriented viewport.
  */
  private computeVolumeNpc(offViewport: Viewport, pixels: Pixel.Buffer, devicePixelSize: number, deviceRect: ViewRect, plane: Plane3dByOriginAndUnitNormal): VolumeInfo | undefined {
    // We assume we do not have perspective!
    const worldToNpc = offViewport.viewingSpace.worldToNpcMap.transform0.asTransform;
    if (!worldToNpc)
      return undefined;

    const planeInNpc = plane.cloneTransformed(worldToNpc);
    if (!planeInNpc)
      return undefined;

    const worldBottom = offViewport.npcToWorld(Point3d.create(0, 0, 0));
    const worldTop = offViewport.npcToWorld(Point3d.create(0, 0, 1));
    const viewBoxHeight = worldTop.distance(worldBottom);

    const volume = new VolumeInfo();
    for (let line = deviceRect.top; line < deviceRect.bottom; ++line) {
      for (let column = deviceRect.left; column < deviceRect.right; ++column) {
        const z = pixels.getPixel(column, line).distanceFraction;
        if (z <= 0.0)
          {continue;}  // hole or clipped

        const npcPoint = Point3d.create((column + 0.5) / deviceRect.width,
          1.0 - (line + 0.5) / deviceRect.height,
          z);

        const altitude = planeInNpc.altitude(npcPoint);
        if (altitude > 0) {
          volume.cut += altitude;
        } else {
          volume.fill += -altitude;
        }

        ++volume.hitCount;
      }
    }

    // Convert npc height to meters and apply sample size.
    volume.cut *= viewBoxHeight * devicePixelSize * devicePixelSize;
    volume.fill *= viewBoxHeight * devicePixelSize * devicePixelSize;
    return volume;
  }

  /** Create a top align viewport, fitted to the range.
   * @param range The view range in world coordinate.
   * @param viewRef The view seed.
   * @param clip Optional clip.
   * @param nbPixels  The view size in pixels. Aspect ratio of range is preserved so only one axis will have the requested amount
   * @returns The viewport
   */
  public static createElevationViewport(viewAlignedVolume: Range3d, viewRef: ViewState, clip?: ClipVector, nbPixels?: number) {
    const defaultNbPixels = 1024;
    const maxNbPixels = 2048;
    const minPixelSize = .01;

    const rotation = Matrix3d.createStandardWorldToView(StandardViewIndex.Top);
    const projectExtent = viewRef.iModel.projectExtents;
    const viewState = SpatialViewState.createBlank(viewRef.iModel, projectExtent.low, projectExtent.high.minus(projectExtent.low), rotation);

    const style = viewState.displayStyle;
    const viewFlags = style.viewFlags.copy({renderMode: RenderMode.SmoothShade, lighting: false, backgroundMap: false, transparency: false });
    style.viewFlags = viewFlags; // call to accessor to get the json properties to reflect the changes to ViewFlags

    style.backgroundColor = ColorDef.white;

    // Add Reality Data displayed coming from context share
    viewRef.displayStyle.forEachRealityModel((model) => {
      const props: ContextRealityModelProps = {
        rdSourceKey: model.rdSourceKey,
        tilesetUrl: model.url,
        name: model.name,
        description: model.description,
      };

      style.attachRealityModel(props);
    });

    // turn off the ground and sky box in the environment
    const env = style.environment.clone({displayGround: false, displaySky: false});
    style.environment = env; // call to accessor to get the json properties to reflect the changes

    if (clip !== undefined)
      {viewState.setViewClip(clip);}

    viewState.lookAtViewAlignedVolume(viewAlignedVolume);

    const aspectRatio = viewAlignedVolume.xLength() / viewAlignedVolume.yLength();
    const pixelCount = Math.min(nbPixels ?? defaultNbPixels, maxNbPixels);

    const viewRect = new ViewRect(0.0);
    if (aspectRatio > 1.0) {
      viewRect.right = Math.min(pixelCount, viewAlignedVolume.xLength() / minPixelSize);
      viewRect.bottom = Math.ceil(viewRect.width / aspectRatio);
    } else {
      viewRect.bottom = Math.min(pixelCount, viewAlignedVolume.yLength() / minPixelSize);
      viewRect.right = Math.ceil(viewRect.height * aspectRatio);
    }

    return OffScreenViewport.create({view: viewState, viewRect});
  }

  /** Render frame and wait for all tiles to render */
  private async waitForAllTilesToRender(viewport: OffScreenViewport): Promise<void> {
    viewport.renderFrame();

    // NB: ToolAdmin loop is not turned on, and this viewport is not tracked by ViewManager - must manually pump tile request scheduler.
    IModelApp.tileAdmin.process(); // eslint-disable-next-line @itwin/no-internal

    if (this.areAllTilesLoaded(viewport))
      {return Promise.resolve();}

    await new Promise<void>((resolve: any) => setTimeout(resolve, 100));

    // This viewport isn't added to ViewManager, so it won't be notified (and have its scene invalidated) when new tiles become loaded.
    viewport.invalidateScene();
    return this.waitForAllTilesToRender(viewport);
  }

  private areAllTilesLoaded(viewport: OffScreenViewport): boolean {
    if (viewport.numRequestedTiles > 0)
    return false;

    let allLoaded = true;
    viewport.view.forEachTileTreeRef((ref) => {
      allLoaded = allLoaded && ref.isLoadingComplete && this.areAllChildTilesLoaded(ref.treeOwner.tileTree?.rootTile);
    });

    return allLoaded;
  }

  private areAllChildTilesLoaded(parent?: Tile): boolean {
    if (!parent)
      return true;
    else if ((parent as any)._childrenLoadStatus === TileTreeLoadStatus.Loading  )
      return false;

    const kids = parent.children;
    if (!kids)
      return true;

    for (const kid of kids)
      {if (!this.areAllChildTilesLoaded(kid))
        {return false;}}

    return true;
  }
}

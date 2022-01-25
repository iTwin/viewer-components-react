/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { DecorateContext, Decorator, IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type { TextOffsetProps, TextStyleProps } from "@itwin/measure-tools-react";
import { TextOffsetType } from "@itwin/measure-tools-react";
import type { ElementProps, GeometricElement3dProps, MassPropertiesResponseProps } from "@itwin/core-common";
import { ColorDef, MassPropertiesOperation } from "@itwin/core-common";
import type { DecorationClickedHandler, SpaceLabelDecorationProps } from "./SpaceLabelDecoration";
import { SpaceLabelDecoration } from "./SpaceLabelDecoration";
import type { Id64Arg } from "@itwin/core-bentley";
import { assert } from "@itwin/core-bentley";
import { Point3d, Range3d } from "@itwin/core-geometry";

export interface SpaceDecorationCreationProps {
  userLabel: string;
  centerX: number;
  centerY: number;
  maxTextWidth: number;
  spaceId: Id64Arg;
}

export class SpaceLabelDecorator implements Decorator {
  private _roomLabelDecoration: SpaceLabelDecoration[] = [];

  constructor() {
    IModelApp.viewManager.addDecorator(this);
  }

  public addDecoration(props: SpaceLabelDecorationProps) {
    const decoration = new SpaceLabelDecoration(props);
    this._roomLabelDecoration.push(decoration);
  }

  public clearDecorations() {
    this._roomLabelDecoration = [];
  }

  public hideDecorations() {
    this._roomLabelDecoration.forEach((decoration) => {
      decoration.hide();
    });
  }

  public showDecorations() {
    this._roomLabelDecoration.forEach((decoration) => {
      decoration.show();
    });
  }

  public async addDecorationsForSpaces(imodel: IModelConnection, roomIds: string[], onClickHandler: DecorationClickedHandler) {
    const roomProps = await imodel.elements.getProps(roomIds[0]);
    const roomProp = roomProps[0] as GeometricElement3dProps;
    const origin = roomProp.placement?.origin;
    const low = roomProp.placement?.bbox?.low;
    const originZ = Array.isArray(origin) ? origin[2] : origin?.z;
    const lowZ = Array.isArray(low) ? low[2] : low?.z;
    let minHeight = lowZ + originZ;

    const allRoomsProps: ElementProps[] = await imodel.elements.getProps(roomIds);

    // Create the room labels
    const spaceDecorations: any[] = [];

    const massPropertiesPromises: Array<Promise<MassPropertiesResponseProps>> = [];
    for (const roomId of roomIds) {
      const massProps = imodel.getMassProperties({
        operation: MassPropertiesOperation.AccumulateAreas,
        candidates: [roomId],
      });
      massPropertiesPromises.push(massProps);
    }

    const massProperties = await Promise.all(massPropertiesPromises);

    for (let i = 0; i < allRoomsProps.length; i++) {
      assert(allRoomsProps.length === roomIds.length && roomIds.length === massProperties.length, "Incorrect data length");
      if (allRoomsProps.length !== roomIds.length || roomIds.length !== massProperties.length) {
        return;
      }

      const room = allRoomsProps[i] as GeometricElement3dProps;
      const roomId = roomIds[i];
      const massProps = massProperties[i];

      // Compute the min and max z values of the rooms in the storey.
      // We're using the minHeight property to assign the z value of the decorations, so that they appear on the floor.
      let roomOrigin = room.placement?.origin;
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      roomOrigin = Array.isArray(roomOrigin) ? roomOrigin : [roomOrigin?.x!, roomOrigin?.y!, roomOrigin?.z!];
      const roomLow = room.placement?.bbox?.low;
      const roomLowZ = Array.isArray(roomLow) ? roomLow[2] : roomLow?.z;
      const roomMinZ = roomLowZ + roomOrigin[2];
      minHeight = Math.min(minHeight, roomMinZ);
      const decorationData = this.createDecorationData(room, roomId, roomOrigin, massProps);
      spaceDecorations.push(decorationData);

    }

    this.addSpaceDecorations(spaceDecorations, minHeight, onClickHandler);
  }

  private createDecorationData(room: any, roomId: string, roomOrigin: number[], massProps: MassPropertiesResponseProps): SpaceDecorationCreationProps | undefined {
    const userLabel = (room as GeometricElement3dProps).userLabel;
    if (userLabel && userLabel !== "") {
      const roomBBoxLow = room.placement.bbox.low;
      const roomBBoxHigh = room.placement.bbox.high;
      const range = new Range3d(roomBBoxLow[0] + roomOrigin[0], roomBBoxLow[1] + roomOrigin[1], roomBBoxLow[2] + roomOrigin[2], roomBBoxHigh[0] + roomOrigin[0], roomBBoxHigh[1] + roomOrigin[1], roomBBoxHigh[2] + roomOrigin[2]);
      const center = range.center;
      const rangeWidth = range.xLength(); // Necessary in order to hide the labels once they get larger than their spaces
      let spaceDecoration: SpaceDecorationCreationProps;
      if (massProps.centroid) {
        // If the centroid exists, we use that to determine the location.
        const centroid: Point3d = Point3d.fromJSON(massProps.centroid);
        spaceDecoration = {
          userLabel,
          centerX: centroid.x,
          centerY: centroid.y,
          maxTextWidth: rangeWidth,
          spaceId: roomId,
        };
      } else {
        // If the centroid fails, we fall back to the center of the bounding box.  I'm not sure that this is required.
        spaceDecoration = {
          userLabel,
          centerX: center.x,
          centerY: center.y,
          maxTextWidth: rangeWidth,
          spaceId: roomId,
        };
      }
      return spaceDecoration;
    }
    return undefined;
  }

  private addSpaceDecorations(decorationData: SpaceDecorationCreationProps[], zPosition: number, clickHandler: DecorationClickedHandler) {
    decorationData.forEach((decoration) => {
      const decorationProps: SpaceLabelDecorationProps = {
        displayText: decoration.userLabel,
        xPosition: decoration.centerX,
        yPosition: decoration.centerY,
        zPosition,
        maxTextWidth: decoration.maxTextWidth,
        spaceId: decoration.spaceId,
        onClick: clickHandler,
      };
      this.addDecoration(decorationProps);
    });
  }

  public decorate(context: DecorateContext) {
    const styleProps: TextStyleProps = {
      textFont: "14px 'Open Sans'",
      textColor: ColorDef.black.getRgb(),
      boxPadding: 5,
      boxBorderWidth: 2,
      boxBorderColor: ColorDef.white.getRgb(),
      boxColor: ColorDef.white.getRgb(),
      boxCornerRadius: 5,
    };

    const offset: TextOffsetProps = {
      x: 0,
      y: 0,
      type: TextOffsetType.Percentage,
    };

    for (const decoration of this._roomLabelDecoration) {
      decoration.decorate(context, styleProps, offset);
    }
  }
}

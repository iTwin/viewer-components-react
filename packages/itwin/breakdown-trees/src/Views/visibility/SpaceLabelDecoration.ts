/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { BeButtonEvent, DecorateContext } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import type { TextOffsetProps, TextStyleProps } from "@itwin/measure-tools-react";
import { TextMarker } from "@itwin/measure-tools-react";
import type { Id64Arg } from "@itwin/core-bentley";

export type DecorationClickedHandler = (ev: BeButtonEvent, decoration?: SpaceLabelDecoration) => void;

export interface SpaceLabelDecorationProps {
  displayText: string; /// Single line of text to display
  xPosition: number; /// x location of the decorator in world space
  yPosition: number; /// y location of the decorator in world space
  zPosition: number; /// z location of the decorator in world space
  maxTextWidth: number; /// the maximum width of the decoration before it is hidden from the display
  spaceId: Id64Arg; /// The identifier of the space that this is decorating
  onClick: DecorationClickedHandler | undefined;
}

export class SpaceLabelDecoration {
  private _textMarker: TextMarker;
  private _spaceId: Id64Arg;
  private _onClick: DecorationClickedHandler | undefined;

  constructor(props: SpaceLabelDecorationProps) {
    const worldPosition = Point3d.create(props.xPosition, props.yPosition, props.zPosition);
    const decoration = TextMarker.createHoverBox([props.displayText], worldPosition);
    decoration.visibility = TextMarker.Visibility.CollapseOversized;
    decoration.maxWorldWidth = props.maxTextWidth;
    decoration.pickable = true;
    decoration.setMouseButtonHandler(this._handleDecorationClicked);
    this._textMarker = decoration;
    this._onClick = props.onClick;
    this._spaceId = props.spaceId;
  }

  private _handleDecorationClicked = (ev: BeButtonEvent): boolean => {
    if (!this._onClick) {
      return false;
    }

    this._onClick(ev, this);
    return true;
  };

  public hide() {
    this._textMarker.visibility = TextMarker.Visibility.Hidden;
  }

  public show() {
    this._textMarker.visibility = TextMarker.Visibility.CollapseOversized;
  }

  public spaceId() { return this._spaceId; }
  public marker() { return this._textMarker; }

  public decorate(context: DecorateContext, styleProps: TextStyleProps, offset: TextOffsetProps) {
    this._textMarker.applyStyle(styleProps);
    this._textMarker.offset = offset;
    this._textMarker.addDecoration(context);
  }
}

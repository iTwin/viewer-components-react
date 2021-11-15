/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Toolbar, ToolbarProps } from "@itwin/appui-layout-react";

/** Popup toolbar properties. */
export interface PopupToolbarProps extends ToolbarProps {
  onClose?: () => void;
}

/** A wrapper around the nine-zone toolbar that can be used as a Popup menu, it hooks into document
 * events to determine if the user clicked outside or used the mouse wheel, which will invoke a close
 * handler.
 */
export class PopupToolbar extends React.PureComponent<PopupToolbarProps> {
  private _toolbar: Toolbar;
  private _wrapperRef?: any;
  private _isClosing: boolean;

  constructor(popUpProps: PopupToolbarProps) {
    super(popUpProps);

    this._toolbar = new Toolbar(popUpProps);
    this._isClosing = false;

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseWheel = this.handleMouseWheel.bind(this);
    this.setWrapperRef = this.setWrapperRef.bind(this);
  }

  public override componentDidMount() {
    document.addEventListener("mousedown", this.handleMouseDown);
    document.addEventListener("wheel", this.handleMouseWheel);
  }

  public override componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleMouseDown);
    document.removeEventListener("wheel", this.handleMouseWheel);
    this._isClosing = false;
  }

  private handleMouseWheel(_event: WheelEvent) {
    if (!this._isClosing && this.props.onClose) {
      this.props.onClose();
      this._isClosing = true;
    }
  }

  private handleMouseDown(event: MouseEvent) {
    if (!this._isClosing && this.props.onClose !== undefined && this._wrapperRef && !this._wrapperRef.contains(event.target)) {
      this.props.onClose();
      this._isClosing = true;
    }
  }

  private setWrapperRef(node: any) {
    this._wrapperRef = node;
  }

  public override render() {
    return (<div ref={this.setWrapperRef}>
      {this._toolbar.render()}
    </div>);
  }
}

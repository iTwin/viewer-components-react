/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import * as React from "react";
import { ToolbarComposer, ToolbarItem, ToolbarOrientation, ToolbarUsage } from "@itwin/appui-react";
import { ExtensibleToolbarProps } from "@itwin/appui-react";

/** Popup toolbar properties. */
export interface PopupToolbarProps extends ExtensibleToolbarProps {
  onClose?: () => void;
}

export const PopupToolbar2: React.FC<PopupToolbarProps> = ({ items, usage, orientation, onClose }: PopupToolbarProps) => {
  const [toolbarItems, setItems] = React.useState<ToolbarItem[]>([]);
  const [toolbarUsage, setToolbarUsage] = React.useState<ToolbarUsage>(ToolbarUsage.ContentManipulation);
  const [toolbarOrientation, setToolbarOrientation] = React.useState<ToolbarOrientation>(ToolbarOrientation.Vertical);
  const [isClosing, setIsClosing] = React.useState<boolean>(false);
  const [wrapperRef, setWrapperRef] = React.useState<any>();

  const ref = React.useRef(wrapperRef);

  setItems(items);
  setToolbarUsage(usage);
  setToolbarOrientation(orientation);

  const handleMouseWheel = (event: WheelEvent) => {
    if (!isClosing && onClose) {
      onClose();
      setIsClosing(true);
    }
  }

  const handleMouseDown = (event: MouseEvent) => {
    if (!isClosing && onClose !== undefined && wrapperRef && !wrapperRef.contains(event.target)) {
      onClose();
      setIsClosing(true);
    }
  }

  React.useEffect(() => {
    const element = ref.current;
    element.addEventListener("mousedown", handleMouseDown);
    element.addEventListener("wheel", handleMouseWheel);
  }, [])

  return <div ref={wrapperRef}>
    {<ToolbarComposer items={toolbarItems} orientation={toolbarOrientation} usage={toolbarUsage} />}
  </div>
};

/** A wrapper around the nine-zone toolbar that can be used as a Popup menu, it hooks into document
 * events to determine if the user clicked outside or used the mouse wheel, which will invoke a close
 * handler.
 */
export class PopupToolbar extends React.PureComponent<PopupToolbarProps> {
  private _toolbar: JSX.Element;
  private _wrapperRef?: any;
  private _isClosing: boolean;

  constructor(popUpProps: PopupToolbarProps) {
    super(popUpProps);
    this._toolbar = <ToolbarComposer items={popUpProps.items} orientation={popUpProps.orientation} usage={popUpProps.usage} />;
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
      {this._toolbar}
    </div>);
  }
}
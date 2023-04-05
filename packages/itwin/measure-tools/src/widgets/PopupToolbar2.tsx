/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import * as React from "react";
import { ToolbarComposer, ToolbarItem, ToolbarOrientation, ToolbarUsage } from "@itwin/appui-react";
import { ExtensibleToolbarProps } from "@itwin/appui-react";
import { PopupToolbarProps } from "./PopupToolbar";


export const PopupToolbar2: React.FC<PopupToolbarProps> = ({ items, usage, orientation }: PopupToolbarProps) => {
  const [toolbarItems, setItems] = React.useState<ToolbarItem[]>([]);
  const [toolbarUsage, setToolbarUsage] = React.useState<ToolbarUsage>(ToolbarUsage.ContentManipulation);
  const [toolbarOrientation, setToolbarOrientation] = React.useState<ToolbarOrientation>(ToolbarOrientation.Vertical);
  const [isClosing, setIsClosing] = React.useState<boolean>(false);
  const [wrapperRef, setWrapperRef] = React.useState<any>();

  setItems(items);
  setToolbarUsage(usage);
  setToolbarOrientation(orientation);

  // const ref = React.useRef(wrapperRef);

  // const handleMouseWheel = () => {
  //   if (!isClosing) {
  //     setIsClosing(true);
  //   }
  // }

  // const handleMouseDown = (event: MouseEvent) => {
  //   if (!isClosing  && wrapperRef && !wrapperRef.contains(event.target)) {
  //     setIsClosing(true);
  //   }
  // }

  // React.useEffect(() => {
  //   const element = ref.current;
  //   element.addEventListener("mousedown", handleMouseDown);
  //   element.addEventListener("wheel", handleMouseWheel);
  // }, [items])

  return <div ref={wrapperRef}>
    {<ToolbarComposer items={toolbarItems} orientation={toolbarOrientation} usage={toolbarUsage} />}
  </div>
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import * as React from "react";
import { useEffect, useState, useRef }from "react";
import { ToolbarComposer } from "@itwin/appui-react";
import { ExtensibleToolbarProps } from "@itwin/appui-react";

export interface PopupToolbarProps extends ExtensibleToolbarProps {
  onClose?: () => void;
}

export const PopupToolbar: React.FC<PopupToolbarProps> = ({ items, usage, orientation, onClose }: PopupToolbarProps) => {
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const ref = useRef(null);

  const handleMouseWheel = () => {
    if (!isClosing && onClose) {
      onClose();
      setIsClosing(true);
    }
  }

  const handleMouseDown = () => {
    if (!isClosing && onClose) {
      setIsClosing(true);
    }
  }

  useEffect(() => {   
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("wheel", handleMouseWheel);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("wheel", handleMouseWheel);
      setIsClosing(false);
    }
  }, [])

  return <div ref={ref}>
    <ToolbarComposer items={items} orientation={orientation} usage={usage} />
  </div>
};

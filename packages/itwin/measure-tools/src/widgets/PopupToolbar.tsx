/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolbarProps } from "@itwin/appui-react";
import { Toolbar } from "@itwin/appui-react";

export interface PopupToolbarProps extends ToolbarProps {
  onClose?: () => void;
}

export const PopupToolbar: React.FC<PopupToolbarProps> = ({ items, onClose }: PopupToolbarProps) => {
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const ref = useRef(null);

  const handleMouseWheel = useCallback(() => {
    if (!isClosing && onClose) {
      onClose();
      setIsClosing(true);
    }
  }, [isClosing, onClose]);

  const handleClick = useCallback(() => {
    if (!isClosing && onClose) {
      onClose();
      setIsClosing(true);
    }
  }, [isClosing, onClose]);

  useEffect(() => {
    document.addEventListener("click", handleClick);
    document.addEventListener("wheel", handleMouseWheel);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("wheel", handleMouseWheel);
      setIsClosing(false);
    };
  }, [handleMouseWheel, handleClick]);

  return <div ref={ref}>
    <Toolbar items={items}/>
  </div>;
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useCallback, useState } from "react";
import { ResizableContainerObserver } from "@itwin/core-react";

/** @internal */
export interface Size {
  width: number;
  height: number;
}

/** @internal */
export interface AutoSizerProps {
  children: (size: Size) => React.ReactElement | null;
}

/** @internal */
export const AutoSizer = (props: AutoSizerProps) => {
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);
  const handleResize = useCallback((w: number, h: number) => {
    setHeight(h);
    setWidth(w);
  }, []);

  return (
    <ResizableContainerObserver onResize={handleResize}>
      {props.children({ height, width })}
    </ResizableContainerObserver>
  );
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  SpatialContainmentTreeProps} from "@itwin/appui-react";
import {
  SpatialContainmentTree,
} from "@itwin/appui-react";
import { useResizeObserver } from "@itwin/core-react";
import React, { useCallback, useState } from "react";

export const SpatialTreeComponent = (
  props: Omit<SpatialContainmentTreeProps, "width" | "height">
) => {
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);
  const handleResize = useCallback((w: number, h: number) => {
    setHeight(h);
    setWidth(w);
  }, []);
  const ref = useResizeObserver<HTMLDivElement>(handleResize);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {width && height && (
        <SpatialContainmentTree {...props} width={width} height={height} />
      )}
    </div>
  );
};

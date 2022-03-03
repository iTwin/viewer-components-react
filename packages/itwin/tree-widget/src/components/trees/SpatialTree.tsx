/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { SpatialContainmentTreeProps } from "@itwin/appui-react";
import { SpatialContainmentTree, useActiveIModelConnection } from "@itwin/appui-react";
import React from "react";
import { AutoSizer } from "./AutoSizer";

export const SpatialTreeComponent = (
  props: Omit<
    SpatialContainmentTreeProps,
    "iModel" | "width" | "height"
  >
) => {
  const iModel = useActiveIModelConnection();

  return !iModel ? null : (
    <AutoSizer>
      {({ width, height }) => <SpatialContainmentTree {...props} width={width} height={height} iModel={iModel} />}
    </AutoSizer>
  );
};

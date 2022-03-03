/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SpatialContainmentTree } from "@itwin/appui-react";
import React from "react";
import type { SpatialTreeProps } from "../../types";
import { AutoSizer } from "./AutoSizer";

export const SpatialTreeComponent = (
  props: SpatialTreeProps
) => {

  return (
    <AutoSizer>
      {({ width, height }) => <SpatialContainmentTree {...props} width={width} height={height} />}
    </AutoSizer>
  );
};

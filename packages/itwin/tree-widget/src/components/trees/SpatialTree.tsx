/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import React from "react";
import type { SpatialTreeProps } from "../../types";
import { SpatialContainmentTree } from "../core-trees/spatial-tree/SpatialContainmentTree";
import { AutoSizer } from "../utils/AutoSizer";

export const SpatialTreeComponent = (
  props: SpatialTreeProps) => {
  const iModel = useActiveIModelConnection();

  return (
    <>
      {iModel &&
        <AutoSizer>
          {({ width, height }) => <SpatialContainmentTree {...props} width={width} height={height} iModel={iModel} />}
        </AutoSizer>
      }
    </>
  );
};

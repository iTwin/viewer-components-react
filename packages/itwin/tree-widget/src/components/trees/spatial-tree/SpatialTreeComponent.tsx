/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { SpatialContainmentTree, useActiveIModelConnection } from "@itwin/appui-react";
import { AutoSizer } from "../../utils/AutoSizer";

import type { SpatialTreeProps } from "../../../types";

export const SpatialTreeComponent = (
  props: SpatialTreeProps) => {
  const iModel = useActiveIModelConnection();

  return (
    <>
      {iModel &&
        <AutoSizer>
          {
            // eslint-disable-next-line deprecation/deprecation
            ({ width, height }) => <SpatialContainmentTree {...props} width={width} height={height} iModel={iModel} />
          }
        </AutoSizer>
      }
    </>
  );
};

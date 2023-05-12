/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import * as React from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { AutoSizer } from "../../utils/AutoSizer";
import { ExternalSourcesTree } from "./ExternalSourcesTree";
import { IModelConnection } from "@itwin/core-frontend";

/**
 * A component that displays an External Sources tree and any necessary "chrome".
 * @alpha
 */
export function ExternalSourcesTreeComponent(props: {}) {
  const iModel = useActiveIModelConnection();
  if (!iModel) {
    return null;
  }
  return (
    <ExternalSourcesTreeComponentImpl {...props} iModel={iModel} />
  );
}

function ExternalSourcesTreeComponentImpl(props: { iModel: IModelConnection }) {
  return (
    <AutoSizer>
      {({ width, height }) => (
        <ExternalSourcesTree
          {...props}
          width={width}
          height={height}
        />
      )}
    </AutoSizer>
  );
}

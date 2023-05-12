/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget";
import { AutoSizer } from "../../utils/AutoSizer";
import { ExternalSourcesTree } from "./ExternalSourcesTree";

import type { IModelConnection } from "@itwin/core-frontend";

/**
 * A component that displays an External Sources tree and any necessary "chrome".
 * @alpha
 */
export const ExternalSourcesTreeComponent = (props: {}) => {
  const iModel = useActiveIModelConnection();
  if (!iModel) {
    return null;
  }
  return (
    <ExternalSourcesTreeComponentImpl {...props} iModel={iModel} />
  );
};

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

/**
 * Id of the component. May be used when a creating a [[TreeDefinition]] for [[ExternalSourcesTreeComponent]].
 * @alpha
 */
ExternalSourcesTreeComponent.id = "external-sources-tree";

/**
 * Label of the component. May be used when a creating a [[TreeDefinition]] for [[ExternalSourcesTreeComponent]].
 * @alpha
 */
ExternalSourcesTreeComponent.getLabel = () => TreeWidget.translate("externalSources");

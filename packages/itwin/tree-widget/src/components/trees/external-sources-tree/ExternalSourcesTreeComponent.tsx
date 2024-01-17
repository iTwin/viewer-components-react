/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget";
import { AutoSizer } from "../../utils/AutoSizer";
import { ExternalSourcesTree } from "./ExternalSourcesTree";

import type { ExternalSourcesTreeProps } from "./ExternalSourcesTree";

/**
 * Props for [[ExternalSourcesTreeComponent]].
 * @alpha
 */
export type ExternalSourcesTreeComponentProps = Omit<ExternalSourcesTreeProps, "iModel" | "width" | "height">;

/**
 * A component that displays an External Sources tree and any necessary "chrome".
 * @alpha
 */
export const ExternalSourcesTreeComponent = (props: ExternalSourcesTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  if (!iModel) {
    return null;
  }

  return <AutoSizer>{({ width, height }) => <ExternalSourcesTree {...props} iModel={iModel} width={width} height={height} />}</AutoSizer>;
};

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

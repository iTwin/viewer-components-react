/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { UnifiedSelectionProvider } from "@itwin/presentation-hierarchies-react";
import { AutoSizer } from "../../../utils/AutoSizer";
import { StatelessExternalSourcesTree } from "./ExternalSourcesTree";

import type { ComponentPropsWithoutRef } from "react";
import type { SelectionStorage } from "@itwin/presentation-hierarchies-react";

type StatelessExternalSourcesTreeProps = ComponentPropsWithoutRef<typeof StatelessExternalSourcesTree>;
interface StatelessExternalSourcesTreeComponentProps
  extends Pick<
    StatelessExternalSourcesTreeProps,
    "getSchemaContext" | "density" | "hierarchyLevelConfig" | "selectionMode" | "onPerformanceMeasured" | "onFeatureUsed"
  > {
  selectionStorage: SelectionStorage;
}

/**
 * A component that renders [[StatelessExternalSourcesTree]].
 * @beta
 */
export const StatelessExternalSourcesTreeComponent = (props: StatelessExternalSourcesTreeComponentProps) => {
  const imodel = useActiveIModelConnection();

  if (!imodel) {
    return null;
  }

  return (
    <UnifiedSelectionProvider storage={props.selectionStorage}>
      <AutoSizer>{({ width, height }) => <StatelessExternalSourcesTree {...props} imodel={imodel} width={width} height={height} />}</AutoSizer>
    </UnifiedSelectionProvider>
  );
};

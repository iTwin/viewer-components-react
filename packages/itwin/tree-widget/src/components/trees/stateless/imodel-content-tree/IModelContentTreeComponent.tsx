/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useActiveIModelConnection } from "@itwin/appui-react";
import { UnifiedSelectionProvider } from "@itwin/presentation-hierarchies-react";
import { AutoSizer } from "../../../utils/AutoSizer";
import { StatelessIModelContentTree } from "./IModelContentTree";

import type { ComponentPropsWithoutRef } from "react";
import type { SelectionStorage } from "@itwin/presentation-hierarchies-react";

type StatelessIModelContentTreeProps = ComponentPropsWithoutRef<typeof StatelessIModelContentTree>;
interface StatelessIModelContentTreeComponentProps
  extends Pick<
    StatelessIModelContentTreeProps,
    "getSchemaContext" | "density" | "hierarchyLevelConfig" | "selectionMode" | "onPerformanceMeasured" | "onFeatureUsed"
  > {
  selectionStorage: SelectionStorage;
}

/**
 * A component that renders [[StatelessIModelContentTree]].
 * @beta
 */
export const StatelessIModelContentTreeComponent = (props: StatelessIModelContentTreeComponentProps) => {
  const imodel = useActiveIModelConnection();

  if (!imodel) {
    return null;
  }

  return (
    <UnifiedSelectionProvider storage={props.selectionStorage}>
      <AutoSizer>{({ width, height }) => <StatelessIModelContentTree {...props} imodel={imodel} width={width} height={height} />}</AutoSizer>
    </UnifiedSelectionProvider>
  );
};

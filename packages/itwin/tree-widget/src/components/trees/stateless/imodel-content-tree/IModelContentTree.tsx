/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SvgFolder, SvgGroup, SvgHierarchyTree, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { useFeatureReporting } from "../../common/UseFeatureReporting";
import { FilterableTree } from "../common/components/FilterableTree";
import { IModelContentTreeDefinition } from "./IModelContentTreeDefinition";

import type { ReactElement } from "react";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { HierarchyLevelConfig } from "../../common/Types";

interface StatelessIModelContentTreeOwnProps {
  hierarchyLevelConfig?: Omit<HierarchyLevelConfig, "isFilteringEnabled">;
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

type FilterableTreeProps = Parameters<typeof FilterableTree>[0];
type GetHierarchyDefinitionsProviderCallback = FilterableTreeProps["getHierarchyDefinition"];
type StatelessIModelContentTreeProps = StatelessIModelContentTreeOwnProps &
  Pick<FilterableTreeProps, "imodel" | "getSchemaContext" | "height" | "width" | "density" | "selectionMode">;

const StatelessIModelContentTreeId = "imodel-content-tree-v2";

/** @internal */
export function StatelessIModelContentTree({ onPerformanceMeasured, onFeatureUsed, ...props }: StatelessIModelContentTreeProps) {
  const { reportUsage } = useFeatureReporting({ onFeatureUsed, treeIdentifier: StatelessIModelContentTreeId });
  return (
    <FilterableTree
      {...props}
      treeName="StatelessIModelContentTree"
      getHierarchyDefinition={getDefinitionsProvider}
      getIcon={getIcon}
      selectionMode={props.selectionMode ?? "none"}
      onPerformanceMeasured={(action, duration) => {
        onPerformanceMeasured?.(`${StatelessIModelContentTreeId}-${action}`, duration);
      }}
      reportUsage={reportUsage}
    />
  );
};

function getDefinitionsProvider(props: Parameters<GetHierarchyDefinitionsProviderCallback>[0]) {
  return new IModelContentTreeDefinition(props);
}

function getIcon(node: PresentationHierarchyNode): ReactElement | undefined {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  switch (node.extendedData.imageId) {
    case "icon-layers":
      return <SvgLayers />;
    case "icon-item":
      return <SvgItem />;
    case "icon-ec-class":
      return <SvgItem />;
    case "icon-imodel-hollow-2":
      return <SvgImodelHollow />;
    case "icon-folder":
      return <SvgFolder />;
    case "icon-model":
      return <SvgModel />;
    case "icon-hierarchy-tree":
      return <SvgHierarchyTree />;
    case "icon-group":
      return <SvgGroup />;
  }

  return undefined;
}

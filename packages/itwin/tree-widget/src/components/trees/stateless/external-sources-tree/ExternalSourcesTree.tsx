/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SvgDetails, SvgDocument, SvgItem } from "@itwin/itwinui-icons-react";
import { useFeatureReporting } from "../../common/UseFeatureReporting";
import { BaseTree } from "../common/components/BaseTree";
import { ExternalSourcesTreeDefinition } from "./ExternalSourcesTreeDefinition";

import type { ReactElement } from "react";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { HierarchyLevelConfig } from "../../common/Types";

interface StatelessExternalSourcesTreeOwnProps {
  hierarchyLevelConfig?: Omit<HierarchyLevelConfig, "isFilteringEnabled">;
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

type BaseTreeProps = Parameters<typeof BaseTree>[0];
type GetHierarchyDefinitionsProviderCallback = BaseTreeProps["getHierarchyDefinition"];
type StatelessExternalSourcesTreeProps = StatelessExternalSourcesTreeOwnProps &
  Pick<BaseTreeProps, "imodel" | "getSchemaContext" | "height" | "width" | "density" | "selectionMode">;

const StatelessExternalSourcesTreeId = "external-sources-tree-v2";

/** @internal */
export function StatelessExternalSourcesTree({ onPerformanceMeasured, onFeatureUsed, ...props }: StatelessExternalSourcesTreeProps) {
  const { reportUsage } = useFeatureReporting({ onFeatureUsed, treeIdentifier: StatelessExternalSourcesTreeId });
  return (
    <BaseTree
      {...props}
      treeName="StatelessExternalSourcesTree"
      getHierarchyDefinition={getDefinitionsProvider}
      getIcon={getIcon}
      selectionMode={props.selectionMode ?? "none"}
      onPerformanceMeasured={(action, duration) => {
        onPerformanceMeasured?.(`${StatelessExternalSourcesTreeId}-${action}`, duration);
      }}
      reportUsage={reportUsage}
    />
  );
};

function getDefinitionsProvider(props: Parameters<GetHierarchyDefinitionsProviderCallback>[0]) {
  return new ExternalSourcesTreeDefinition(props);
}

function getIcon(node: PresentationHierarchyNode): ReactElement | undefined {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  switch (node.extendedData.imageId) {
    case "icon-item":
      return <SvgItem />;
    case "icon-ec-class":
      return <SvgItem />;
    case "icon-document":
      return <SvgDocument />;
    case "icon-ec-schema":
      return <SvgDetails />;
  }

  return undefined;
}

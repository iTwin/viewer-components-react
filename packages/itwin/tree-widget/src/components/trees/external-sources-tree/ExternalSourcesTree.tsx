/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SvgDetails, SvgDocument, SvgItem } from "@itwin/itwinui-icons-react";
import { Tree } from "../common/components/Tree";
import { TreeRenderer } from "../common/components/TreeRenderer";
import { useFeatureReporting } from "../common/UseFeatureReporting";
import { ExternalSourcesTreeComponent } from "./ExternalSourcesTreeComponent";
import { ExternalSourcesTreeDefinition } from "./ExternalSourcesTreeDefinition";

import type { ReactElement } from "react";
import type { TreeUsageTrackedFeatures } from "../common/components/Tree";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

interface ExternalSourcesTreeOwnProps {
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

type TreeProps = Parameters<typeof Tree>[0];
type GetHierarchyDefinitionsProviderCallback = TreeProps["getHierarchyDefinition"];
type ExternalSourcesTreeProps = ExternalSourcesTreeOwnProps & Pick<TreeProps, "imodel" | "getSchemaContext" | "height" | "width" | "density" | "selectionMode">;

/** @internal */
export function ExternalSourcesTree({ onPerformanceMeasured, onFeatureUsed, ...props }: ExternalSourcesTreeProps) {
  const { reportUsage } = useFeatureReporting<TreeUsageTrackedFeatures>({ onFeatureUsed, treeIdentifier: ExternalSourcesTreeComponent.id });
  return (
    <Tree
      {...props}
      treeName={ExternalSourcesTreeComponent.id}
      getHierarchyDefinition={getDefinitionsProvider}
      selectionMode={props.selectionMode ?? "none"}
      onPerformanceMeasured={(action, duration) => {
        onPerformanceMeasured?.(`${ExternalSourcesTreeComponent.id}-${action}`, duration);
      }}
      reportUsage={reportUsage}
      treeRenderer={(treeProps) => <TreeRenderer {...treeProps} getIcon={getIcon} />}
    />
  );
}

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

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SvgFolder, SvgGroup, SvgHierarchyTree, SvgImodelHollow, SvgItem, SvgLayers, SvgModel } from "@itwin/itwinui-icons-react";
import { Tree } from "../common/components/Tree";
import { TreeRenderer } from "../common/components/TreeRenderer";
import { useFeatureReporting } from "../common/UseFeatureReporting";
import { IModelContentTreeComponent } from "./IModelContentTreeComponent";
import { IModelContentTreeDefinition } from "./IModelContentTreeDefinition";
import { IModelContentTreeIdsCache } from "./internal/IModelContentTreeIdsCache";

import type { ReactElement } from "react";
import type { TreeUsageTrackedFeatures } from "../common/components/Tree";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

interface IModelContentTreeOwnProps {
  hierarchyLevelConfig?: {
    sizeLimit?: number;
  };
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

type TreeProps = Parameters<typeof Tree>[0];
type GetHierarchyDefinitionsProviderCallback = TreeProps["getHierarchyDefinition"];
type IModelContentTreeProps = IModelContentTreeOwnProps & Pick<TreeProps, "imodel" | "getSchemaContext" | "height" | "width" | "density" | "selectionMode">;

/** @internal */
export function IModelContentTree({ onPerformanceMeasured, onFeatureUsed, ...props }: IModelContentTreeProps) {
  const { reportUsage } = useFeatureReporting<TreeUsageTrackedFeatures>({ onFeatureUsed, treeIdentifier: IModelContentTreeComponent.id });
  return (
    <Tree
      {...props}
      treeName={IModelContentTreeComponent.id}
      getHierarchyDefinition={getDefinitionsProvider}
      selectionMode={props.selectionMode ?? "extended"}
      onPerformanceMeasured={(action, duration) => {
        onPerformanceMeasured?.(`${IModelContentTreeComponent.id}-${action}`, duration);
      }}
      reportUsage={reportUsage}
      treeRenderer={(treeProps) => <TreeRenderer {...treeProps} getIcon={getIcon} />}
    />
  );
}

function getDefinitionsProvider(props: Parameters<GetHierarchyDefinitionsProviderCallback>[0]) {
  return new IModelContentTreeDefinition({
    imodelAccess: props.imodelAccess,
    idsCache: new IModelContentTreeIdsCache(props.imodelAccess),
  });
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

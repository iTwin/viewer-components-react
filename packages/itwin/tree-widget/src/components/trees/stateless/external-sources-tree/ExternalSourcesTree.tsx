/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { ReactElement } from "react";
import { SvgDetails, SvgDocument, SvgItem } from "@itwin/itwinui-icons-react";
import { FilterableTree } from "../common/components/FilterableTree";
import { ExternalSourcesTreeDefinition } from "./ExternalSourcesTreeDefinition";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { HierarchyLevelConfig } from "../../common/Types";
interface StatelessExternalSourcesTreeOwnProps {
  hierarchyLevelConfig?: Omit<HierarchyLevelConfig, "isFilteringEnabled">;
}

type FilterableTreeProps = Parameters<typeof FilterableTree>[0];
type GetHierarchyDefinitionsProviderCallback = FilterableTreeProps["getHierarchyDefinition"];
type StatelessExternalSourcesTreeProps = StatelessExternalSourcesTreeOwnProps &
  Pick<FilterableTreeProps, "imodel" | "getSchemaContext" | "height" | "width" | "density" | "selectionMode">;

/** @internal */
export const StatelessExternalSourcesTree = (props: StatelessExternalSourcesTreeProps) => {
  return (
    <FilterableTree
      {...props}
      treeName="StatelessExternalSourcesTree"
      getHierarchyDefinition={getDefinitionsProvider}
      getIcon={getIcon}
      selectionMode={props.selectionMode ?? "none"}
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

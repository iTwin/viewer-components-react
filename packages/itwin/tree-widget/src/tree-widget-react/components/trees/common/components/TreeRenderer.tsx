/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */

import { createFilterAction, LocalizationContextProvider, TreeRenderer as PresentationTree } from "@itwin/presentation-hierarchies-react";
import { useHierarchiesLocalization } from "../UseHierarchiesLocalization.js";
import { createVisibilityAction } from "./TreeNodeVisibilityButton.js";

import type { TreeItemVisibilityButtonProps } from "./TreeNodeVisibilityButton.js";
/** @beta */
export type TreeRendererProps = React.ComponentPropsWithoutRef<typeof PresentationTree> & { visibilityButtonProps?: TreeItemVisibilityButtonProps };

/**
 * Default renderer for rendering tree data.
 * @beta
 */
export function TreeRenderer({ rootNodes, onNodeClick, expandNode, visibilityButtonProps, ...props }: TreeRendererProps) {
  const localizedStrings = useHierarchiesLocalization();
  return (
    <LocalizationContextProvider localizedStrings={localizedStrings}>
      <PresentationTree
        {...props}
        onNodeClick={onNodeClick}
        expandNode={expandNode}
        rootNodes={rootNodes}
        actions={[
          ...(visibilityButtonProps ? [createVisibilityAction(visibilityButtonProps)] : []),
          createFilterAction({ onFilter: props.onFilterClick, getHierarchyLevelDetails: props.getHierarchyLevelDetails, label: "Filter" }),
        ]}
      />
    </LocalizationContextProvider>
  );
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */

import { LocalizationContextProvider, TreeRenderer as PresentationTree } from "@itwin/presentation-hierarchies-react";
import { useHierarchiesLocalization } from "../UseHierarchiesLocalization.js";
import { TreeItemVisibilityButton } from "./TreeNodeVisibilityButton.js";

import type { TreeItemVisibilityButtonProps } from "./TreeNodeVisibilityButton.js";
/** @beta */
export type TreeRendererProps = React.ComponentPropsWithoutRef<typeof PresentationTree> & { checkboxProps?: TreeItemVisibilityButtonProps };

/**
 * Default renderer for rendering tree data.
 * @beta
 */
export function TreeRenderer({ rootNodes, onNodeClick, expandNode, checkboxProps, ...props }: TreeRendererProps) {
  const localizedStrings = useHierarchiesLocalization();
  return (
    <LocalizationContextProvider localizedStrings={localizedStrings}>
      <PresentationTree
        {...props}
        onNodeClick={onNodeClick}
        expandNode={expandNode}
        rootNodes={rootNodes}
        actionsRenderer={checkboxProps ? (node) => <TreeItemVisibilityButton {...checkboxProps} node={node} /> : undefined}
      />
    </LocalizationContextProvider>
  );
}

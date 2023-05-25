/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect } from "react";
import { TreeImageLoader, TreeNodeRenderer, TreeRenderer } from "@itwin/components-react";
import { Checkbox } from "@itwin/itwinui-react";
import { useControlledPresentationTreeFiltering } from "@itwin/presentation-components";
import classNames from "classnames";

import type { AbstractTreeNodeLoaderWithProvider, TreeNodeRendererProps, TreeRendererProps } from "@itwin/components-react";
import type { NodeCheckboxRenderProps } from "@itwin/core-react";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { VisibilityTreeFilterInfo } from "./Common";

/**
 * Props for visibility tree node renderer.
 * @public
 */
export interface visibilityTreeRendererProps {
  /**
   * Specifies whether the icon at the left of the node label should be rendered.
   */
  iconsEnabled: boolean;
  /**
   * Specifies whether node description should be enabled.
   */
  descriptionEnabled: boolean;
  /**
   * Defines the size in pixels of how much the node label should be pushed to the right from the checkbox.
   * Default value is 20.
   */
  levelOffset?: number;
  /**
   * Defines the size in pixels of how much the leaf node label should be pushed to the right from the checkbox.
   * @note This value applies only to the leaf nodes.
   * Default value is 24.
   */
  expansionToggleWidth?: number;
  /**
   * Specifies whether the root node be expanded at all times.
   * Default value is false.
   */
  disableRootNodeCollapse?: boolean;
}

/**
 * Creates Visibility tree renderer which renders nodes with eye checkbox.
 * @public
 */
export const useVisibilityTreeRenderer = (visibilityTreeRendererProps: visibilityTreeRendererProps) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nodeRenderer = useCallback(createVisibilityTreeNodeRenderer(visibilityTreeRendererProps), [visibilityTreeRendererProps]);
  return useCallback((props: TreeRendererProps) => (
    <TreeRenderer
      {...props}
      nodeRenderer={nodeRenderer}
    />
  ), [nodeRenderer]);
};

const imageLoader = new TreeImageLoader();

/**
 * Creates node renderer which renders node with eye checkbox.
 * @public
 */
export const createVisibilityTreeNodeRenderer = ({ levelOffset = 20, expansionToggleWidth = 24, disableRootNodeCollapse = false, ...props }: visibilityTreeRendererProps) => {
  return (treeNodeProps: TreeNodeRendererProps) => ( // eslint-disable-line react/display-name
    <TreeNodeRenderer
      {...treeNodeProps}
      node={{ ...treeNodeProps.node, depth: 0, numChildren: 1 }}
      checkboxRenderer={(checkboxProps: NodeCheckboxRenderProps) => (
        <div className="checkboxWrapper" style={{ marginRight: `${treeNodeProps.node.depth * levelOffset + (treeNodeProps.node.numChildren === 0 ? expansionToggleWidth : 0)}px` }}>
          <VisibilityTreeNodeCheckboxRenderer { ...checkboxProps }/>
        </div>
      )}
      descriptionEnabled={props.descriptionEnabled}
      imageLoader={props.iconsEnabled ? imageLoader : undefined}
      className={classNames("with-checkbox", (treeNodeProps.node.numChildren === 0 || (disableRootNodeCollapse && treeNodeProps.node.parentId === undefined)) && "disable-expander", treeNodeProps.className)}
    />
  );
};

/**
 * Checkbox renderer that renders an eye.
 * @public
 */
export const VisibilityTreeNodeCheckboxRenderer = (props: NodeCheckboxRenderProps) => (
  <Checkbox
    className="visibility-tree-checkbox"
    variant="eyeball"
    checked={props.checked}
    onChange={(e) => props.onChange(e.currentTarget.checked)}
    disabled={props.disabled}
    title={props.title}
  />
);

/**
 * Filters data provider used in supplied node loader and invokes onFilterApplied when filtering is completed.
 * @public
 */
export const useVisibilityTreeFiltering = (
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
  filterInfo?: VisibilityTreeFilterInfo,
  onFilterApplied?: (filteredDataProvider: IPresentationTreeDataProvider, matchesCount: number) => void,
) => {
  const { filter, activeMatchIndex } = filterInfo ?? { filter: undefined, activeMatchIndex: undefined };
  const {
    filteredNodeLoader,
    isFiltering,
    matchesCount,
    nodeHighlightingProps,
  } = useControlledPresentationTreeFiltering({ nodeLoader, filter, activeMatchIndex });

  useEffect(
    () => {
      if (filter && matchesCount !== undefined && filteredNodeLoader !== nodeLoader)
        onFilterApplied && onFilterApplied(filteredNodeLoader.dataProvider, matchesCount);
    },
    [filter, matchesCount, nodeLoader, filteredNodeLoader, onFilterApplied],
  );

  return { filteredNodeLoader, isFiltering, nodeHighlightingProps };
};

/**
 * Properties for [[VisibilityTreeNoFilteredData]] component.
 * @public
 */
export interface VisibilityTreeNoFilteredDataProps {
  title: string;
  message: string;
}

/**
 * Renders message that no nodes was found for filter.
 * @public
 */
export function VisibilityTreeNoFilteredData(props: VisibilityTreeNoFilteredDataProps) {
  return (
    <div className="components-tree-errormessage">
      <span className="errormessage-header">{props.title}</span>
      <span className="errormessage-body">{props.message}</span>
    </div>
  );
}

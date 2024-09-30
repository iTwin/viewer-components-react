/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import classNames from "classnames";
import { useEffect } from "react";
import { TreeImageLoader, TreeNodeRenderer } from "@itwin/components-react";
import { Checkbox } from "@itwin/itwinui-react";
import { PresentationTreeNodeRenderer, useControlledPresentationTreeFiltering } from "@itwin/presentation-components";
import { TreeRenderer } from "./common/TreeRenderer";

import type { NodeCheckboxRenderProps } from "@itwin/core-react";
import type { TreeRendererBaseProps, TreeRendererProps } from "./common/TreeRenderer";
import type { AbstractTreeNodeLoaderWithProvider, TreeNodeRendererProps } from "@itwin/components-react";
import type { IPresentationTreeDataProvider, PresentationTreeNodeRendererProps } from "@itwin/presentation-components";
import type { VisibilityTreeFilterInfo } from "./common/Types";
/**
 * These constants are taken from `@itwin/core-react`.
 * Defines the size in pixels of the expansion toggle.
 * It is used to keep same hierarchy nodes with children and nodes without children in the same line.
 * @note This value applies only to the leaf nodes.
 */
const EXPANSION_TOGGLE_WIDTH = 24;
const EXPANDED_EXPANSION_TOGGLE_WIDTH = 42;

const imageLoader = new TreeImageLoader();

/**
 * Props for visibility tree renderer.
 * @public
 */
export interface VisibilityTreeRendererProps extends TreeRendererBaseProps {
  /** Props for single node renderer. */
  nodeRendererProps: VisibilityTreeNodeRendererProps;
}

/**
 * Props for visibility tree node renderer.
 * @public
 */
export interface VisibilityTreeNodeRendererProps {
  /**
   * Specifies whether the icon at the left of the node label should be rendered.
   */
  iconsEnabled: boolean;
  /**
   * Specifies whether node description should be enabled.
   */
  descriptionEnabled: boolean;
  /**
   * Defines the offset in pixels of how much each hierarchy level should be offset to the right from the checkbox.
   * Defaults to `20`.
   */
  levelOffset?: number;
  /**
   * Specifies whether the root node be expanded at all times.
   * Defaults to `false`.
   */
  disableRootNodeCollapse?: boolean;
  /**
   * Specifies whether the nodes should be enlarged (less dense and larger content).
   * Is `false` by default
   */
  isEnlarged?: boolean;
  /**
   * Callback called when visibility is toggled using a checkbox.
   */
  onVisibilityToggled?: (enabled: boolean) => void;
}

/**
 * Creates Visibility tree renderer which renders nodes with eye checkbox.
 * @public
 */
export function createVisibilityTreeRenderer({ nodeRendererProps, ...restProps }: VisibilityTreeRendererProps) {
  return function VisibilityTreeRenderer(treeProps: TreeRendererProps) {
    return <TreeRenderer {...treeProps} {...restProps} nodeRenderer={createVisibilityTreeNodeRenderer(nodeRendererProps)} />;
  };
}

/**
 * Creates node renderer which renders node with eye checkbox.
 * @public
 */
export function createVisibilityTreeNodeRenderer({
  levelOffset = 20,
  disableRootNodeCollapse = false,
  descriptionEnabled,
  iconsEnabled,
  onVisibilityToggled,
}: VisibilityTreeNodeRendererProps) {
  return function VisibilityTreeNodeRenderer(treeNodeProps: TreeNodeRendererProps) {
    const nodeOffset = treeNodeProps.node.depth * levelOffset + (treeNodeProps.node.numChildren === 0 ? EXPANSION_TOGGLE_WIDTH : 0);
    return (
      <TreeNodeRenderer
        {...treeNodeProps}
        node={{ ...treeNodeProps.node, depth: 0, numChildren: 1 }} // if we want to disable TreeNodeRenderer style calculations for tree nodes, we need to override these values.
        checkboxRenderer={(checkboxProps: NodeCheckboxRenderProps) => (
          <div className="visibility-tree-checkbox-container" style={{ marginRight: `${nodeOffset}px` }}>
            <VisibilityTreeNodeCheckbox {...checkboxProps} onVisibilityToggled={onVisibilityToggled} />
          </div>
        )}
        descriptionEnabled={descriptionEnabled}
        imageLoader={iconsEnabled ? imageLoader : undefined}
        className={classNames(
          "with-checkbox",
          (treeNodeProps.node.numChildren === 0 || (disableRootNodeCollapse && treeNodeProps.node.parentId === undefined)) && "disable-expander",
        )}
      />
    );
  };
}

interface VisibilityTreeNodeCheckboxProps extends NodeCheckboxRenderProps {
  onVisibilityToggled?: (enabled: boolean) => void;
}

/**
 * Checkbox renderer that renders an eye.
 * @public
 */
export function VisibilityTreeNodeCheckbox(props: VisibilityTreeNodeCheckboxProps) {
  return (
    <Checkbox
      className="visibility-tree-checkbox"
      variant="eyeball"
      checked={props.checked}
      onChange={(e) => {
        props.onVisibilityToggled?.(e.currentTarget.checked);
        props.onChange(e.currentTarget.checked);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
    />
  );
}

/**
 * Props for [[FilterableVisibilityTreeNodeRenderer]].
 * @beta
 */
export type FilterableVisibilityTreeNodeRendererProps = Omit<PresentationTreeNodeRendererProps, "descriptionEnabled"> & VisibilityTreeNodeRendererProps;

/**
 * Creates node renderer which renders node with eye checkbox and hierarchy level filtering actions.
 * @beta
 */
export function FilterableVisibilityTreeNodeRenderer({
  levelOffset = 20,
  disableRootNodeCollapse,
  descriptionEnabled,
  isEnlarged,
  onVisibilityToggled,
  ...restProps
}: FilterableVisibilityTreeNodeRendererProps) {
  const expansionToggleWidth = isEnlarged ? EXPANDED_EXPANSION_TOGGLE_WIDTH : EXPANSION_TOGGLE_WIDTH;
  const nodeOffset = restProps.node.depth * levelOffset + (restProps.node.numChildren === 0 ? expansionToggleWidth : 0);

  return (
    <PresentationTreeNodeRenderer
      {...restProps}
      checkboxRenderer={(checkboxProps: NodeCheckboxRenderProps) => (
        <div className="visibility-tree-checkbox-container" style={{ marginRight: `${nodeOffset}px` }}>
          <VisibilityTreeNodeCheckbox {...checkboxProps} onVisibilityToggled={onVisibilityToggled} />
        </div>
      )}
      descriptionEnabled={descriptionEnabled}
      imageLoader={imageLoader}
      className={classNames(
        "with-checkbox",
        (restProps.node.numChildren === 0 || (disableRootNodeCollapse && restProps.node.parentId === undefined)) && "disable-expander",
      )}
    />
  );
}

/**
 * Filters data provider used in supplied node loader and invokes onFilterApplied when filtering is completed.
 * @public
 * @deprecated in 2.0.0. Use [[useVisibilityTree]] instead.
 */
// istanbul ignore next
export function useVisibilityTreeFiltering(
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
  filterInfo?: VisibilityTreeFilterInfo,
  onFilterApplied?: (filteredDataProvider: IPresentationTreeDataProvider, matchesCount: number) => void,
) {
  const { filter, activeMatchIndex } = filterInfo ?? { filter: undefined, activeMatchIndex: undefined };
  const { filteredNodeLoader, isFiltering, matchesCount, nodeHighlightingProps } = useControlledPresentationTreeFiltering({
    nodeLoader,
    filter,
    activeMatchIndex,
  });

  useEffect(() => {
    if (filter && matchesCount !== undefined && filteredNodeLoader !== nodeLoader) {
      onFilterApplied && onFilterApplied(filteredNodeLoader.dataProvider, matchesCount);
    }
  }, [filter, matchesCount, nodeLoader, filteredNodeLoader, onFilterApplied]);

  return { filteredNodeLoader, isFiltering, nodeHighlightingProps };
}

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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import classNames from "classnames";
import { useEffect } from "react";
import { TreeImageLoader, TreeNodeRenderer } from "@itwin/components-react";
import { Checkbox } from "@itwin/itwinui-react";
import { useControlledPresentationTreeFiltering } from "@itwin/presentation-components";
import { TreeRenderer } from "./common/TreeRenderer";

import type { TreeRendererBaseProps } from "./common/TreeRenderer";
import type { AbstractTreeNodeLoaderWithProvider, IImageLoader, LoadedImage, TreeNodeItem, TreeNodeRendererProps, TreeRendererProps } from "@itwin/components-react";
import type { NodeCheckboxRenderProps } from "@itwin/core-react";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { VisibilityTreeFilterInfo } from "./common/Types";

/**
 * This constant is taken from `@itwin/core-react`.
 * Defines the size in pixels of the expansion toggle.
 * It is used to keep same hierarchy nodes with children and nodes without children in the same line.
 * @note This value applies only to the leaf nodes.
 */
const EXPANSION_TOGGLE_WIDTH = 24;

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
  descriptionEnabled: boolean;/**
  * Set with ECInstanceIds of elements outside of project extents
  */
  objectsOutsideExtents?: Set<string>;
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

interface ICustomSvgImageLoader extends IImageLoader {
  load: (item: TreeNodeItem) => LoadedImage | undefined;
}

/** Default image loader for the tree
 * @public
 */
class CustomSvgImageLoader implements ICustomSvgImageLoader {
  /** Loads image data from either [[TreeNodeItem]] */
  public load(_item: TreeNodeItem): LoadedImage | undefined {
    const svg = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width="1rem" height="1rem"><path d="M15.868 13.267l-6.77-11.62a1.15 1.15 0 00-1.1-.67 1.17 1.17 0 00-1.1.69l-6.77 11.59a1.2 1.2 0 001.1 1.72h13.45a1.237 1.237 0 001.306-1.06 1.19 1.19 0 00-.116-.65zm-6.87-.29h-2v-2h2zm0-3h-2v-5h2z" fill="var(--iui-color-icon-warning, hsl(33 90% 33%))"/></svg>`;

    return {
      sourceType: "svg",
      value: svg,
    };
  }
}

const defaultImageLoader = new TreeImageLoader();
const customImageLoader = new CustomSvgImageLoader();

/**
 * Creates node renderer which renders node with eye checkbox.
 * @public
 */
export function createVisibilityTreeNodeRenderer({ levelOffset = 20, disableRootNodeCollapse = false, objectsOutsideExtents, descriptionEnabled, iconsEnabled }: VisibilityTreeNodeRendererProps) {
  return function VisibilityTreeNodeRenderer(treeNodeProps: TreeNodeRendererProps) {
    const nodeOffset = treeNodeProps.node.depth * levelOffset + (treeNodeProps.node.numChildren === 0 ? EXPANSION_TOGGLE_WIDTH : 0);
    return (
      <TreeNodeRenderer
        {...treeNodeProps}
        node={{ ...treeNodeProps.node, depth: 0, numChildren: 1 }} // if we want to disable TreeNodeRenderer style calculations for tree nodes, we need to override these values.
        checkboxRenderer={(checkboxProps: NodeCheckboxRenderProps) => (
          <div className="visibility-tree-checkbox-container" style={{ marginRight: `${nodeOffset}px` }}>
            <VisibilityTreeNodeCheckbox {...checkboxProps} />
          </div>
        )}
        descriptionEnabled={descriptionEnabled}
        imageLoader={imageLoaderDecider(treeNodeProps, iconsEnabled, objectsOutsideExtents)}
        className={classNames("with-checkbox", (treeNodeProps.node.numChildren === 0 || (disableRootNodeCollapse && treeNodeProps.node.parentId === undefined)) && "disable-expander", treeNodeProps.className)}
      />
    );
  };
}
const imageLoaderDecider = (treeNodeProps: TreeNodeRendererProps, iconsEnabled: boolean, objectsOutsideExtents?: Set<string>) => {
  const nodeECInstanceId: string = (treeNodeProps.node.item as any).key.instanceKeys[0].id;
  const nodeOutsideExtents: boolean = objectsOutsideExtents ? objectsOutsideExtents.has(nodeECInstanceId) : false;
  return iconsEnabled ? (nodeOutsideExtents ? customImageLoader : defaultImageLoader) : undefined;
};

/**
 * Checkbox renderer that renders an eye.
 * @public
 */
export function VisibilityTreeNodeCheckbox(props: NodeCheckboxRenderProps) {
  return <Checkbox
    className="visibility-tree-checkbox"
    variant="eyeball"
    checked={props.checked}
    onChange={(e) => props.onChange(e.currentTarget.checked)}
    onClick={props.onClick}
    disabled={props.disabled}
    title={props.title}
  />;
}

/**
 * Filters data provider used in supplied node loader and invokes onFilterApplied when filtering is completed.
 * @public
 */
export function useVisibilityTreeFiltering(
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
  filterInfo?: VisibilityTreeFilterInfo,
  onFilterApplied?: (filteredDataProvider: IPresentationTreeDataProvider, matchesCount: number) => void,
) {
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

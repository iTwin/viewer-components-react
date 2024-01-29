/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { IModelConnection } from "@itwin/core-frontend";
import type { SelectionMode } from "@itwin/components-react";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { TreeRendererBaseProps } from "./TreeRenderer";

/**
 * An option of how class grouping should work in a component.
 * @public
 */
export enum ClassGroupingOption {
  /** Class grouping is disabled */
  No,
  /** Class grouping is enabled */
  Yes,
  /** Class grouping is enabled and grouping node shows grouped items count */
  YesWithCounts,
}

/**
 * Data structure that describes info used to filter visibility tree.
 * @public
 */
export interface VisibilityTreeFilterInfo {
  filter: string;
  activeMatchIndex?: number;
}

/**
 * Base props for tree components.
 * @public
 */
export interface BaseTreeProps extends TreeRendererBaseProps {
  /** An iModel to pull data from. */
  iModel: IModelConnection;
  /** Width of the component. */
  width: number;
  /** Height of the component. */
  height: number;
  /** Selection mode in the tree. */
  selectionMode?: SelectionMode;
}

/**
 * Base props for filterable tree components.
 * @public
 */
export interface BaseFilterableTreeProps extends BaseTreeProps {
  /** Information for tree filtering. */
  filterInfo?: VisibilityTreeFilterInfo;
  /** Callback invoked when tree is filtered. */
  onFilterApplied?: (filteredDataProvider: IPresentationTreeDataProvider, matchesCount: number) => void;
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect } from "react";
import { usePresentationTreeState } from "@itwin/presentation-components";
import { VisibilityTreeEventHandler } from "../VisibilityTreeEventHandler";

import type { IModelConnection } from "@itwin/core-frontend";
import type { Ruleset } from "@itwin/presentation-common";
import type { IFilteredPresentationTreeDataProvider, PresentationTreeEventHandlerProps, UsePresentationTreeStateProps } from "@itwin/presentation-components";
import type { IVisibilityHandler, VisibilityTreeEventHandlerParams, VisibilityTreeSelectionPredicate } from "../VisibilityTreeEventHandler";
import type { VisibilityTreeFilterInfo } from "./Types";

/**
 * Props for [[useVisibilityTreeState]] hook.
 * @beta
 */
export interface UseVisibilityTreeStateProps extends Omit<UsePresentationTreeStateProps<VisibilityTreeEventHandler>, "rulesetOrId"> {
  /** iModel to pull data from. */
  imodel: IModelConnection;
  /** Presentation rules to use when pulling data from iModel. */
  ruleset: Ruleset;
  /** Visibility handler that will be used to determine tree node visibility or change it. */
  visibilityHandler?: IVisibilityHandler;
  /** Info about filter that should be applied on tree. */
  filterInfo?: VisibilityTreeFilterInfo;
  /** Callback that is invoked when filter is applied, changed or removed. */
  onFilterChange?: (filteredDataProvider?: IFilteredPresentationTreeDataProvider, matchesCount?: number) => void;
  /** Callback that is used to determine if node can be selected. If not provided all nodes are selectable. */
  selectionPredicate?: VisibilityTreeSelectionPredicate;
  /** Factory for custom `VisibilityTreeEventHandler`. Defaults to `VisibilityTreeEventHandler`. */
  eventHandler?: (props: VisibilityTreeEventHandlerParams) => VisibilityTreeEventHandler;

  hierarchyLevelSizeLimit?: number;
}

/**
 * Custom hook for creating visibility tree component state.
 *
 * @returns `undefined` on first render cycle. On all other render cycles state is initialized and valid object is returned.
 * @beta
 */
export function useVisibilityTreeState({
  imodel,
  ruleset,
  filterInfo,
  onFilterChange,
  visibilityHandler,
  selectionPredicate,
  eventHandler,
  ...props
}: UseVisibilityTreeStateProps) {
  const eventHandlerFactory = useCallback(
    (params: PresentationTreeEventHandlerProps) => {
      if (!visibilityHandler) {
        return undefined;
      }

      const eventHandlerProps: VisibilityTreeEventHandlerParams = {
        nodeLoader: params.nodeLoader,
        visibilityHandler,
        selectionPredicate,
      };

      return eventHandler ? eventHandler(eventHandlerProps) : new VisibilityTreeEventHandler(eventHandlerProps);
    },
    [visibilityHandler, selectionPredicate, eventHandler],
  );

  const treeState = usePresentationTreeState({
    ...props,
    imodel,
    ruleset,
    eventHandlerFactory,
    filteringParams: filterInfo?.filter
      ? {
          filter: filterInfo.filter,
          activeMatchIndex: filterInfo?.activeMatchIndex,
        }
      : undefined,
  });

  useEffect(() => {
    onFilterChange && onFilterChange(treeState?.filteringResult?.filteredProvider, treeState?.filteringResult?.matchesCount);
  }, [treeState?.filteringResult?.matchesCount, treeState?.filteringResult?.filteredProvider, onFilterChange]);

  return treeState;
}

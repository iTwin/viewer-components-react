/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect } from "react";
import { VisibilityTreeEventHandler } from "../VisibilityTreeEventHandler";
import { usePresentationTreeState } from "@itwin/presentation-components";

import type { IModelConnection } from "@itwin/core-frontend";
import type { Ruleset } from "@itwin/presentation-common";
import type { IFilteredPresentationTreeDataProvider, PresentationTreeEventHandlerProps, UsePresentationTreeStateProps } from "@itwin/presentation-components";
import type { IVisibilityHandler, VisibilityTreeSelectionPredicate } from "../VisibilityTreeEventHandler";
import type { VisibilityTreeFilterInfo } from "./Types";

/**
 * Props for [[useVisibilityTree]] hook.
 * @beta
 */
export interface UseVisibilityTreeProps extends Omit<UsePresentationTreeStateProps<VisibilityTreeEventHandler>, "rulesetOrId"> {
  imodel: IModelConnection;
  ruleset: Ruleset;
  visibilityHandler?: IVisibilityHandler;
  filterInfo?: VisibilityTreeFilterInfo;
  onFilterChange?: (filteredDataProvider?: IFilteredPresentationTreeDataProvider, matchesCount?: number) => void;
  selectionPredicate?: VisibilityTreeSelectionPredicate;
}

/**
 * Custom hooks that creates state for visibility tree using [[usePresentationTreeState]] hook.
 * @beta
 */
export function useVisibilityTree({ imodel, ruleset, filterInfo, onFilterChange, visibilityHandler, selectionPredicate, ...props }: UseVisibilityTreeProps) {
  const eventHandlerFactory = useCallback((params: PresentationTreeEventHandlerProps) => {
    if (!visibilityHandler) {
      return undefined;
    }

    return new VisibilityTreeEventHandler({
      nodeLoader: params.nodeLoader,
      visibilityHandler,
      selectionPredicate,
    });
  }, [visibilityHandler, selectionPredicate]);

  const treeState = usePresentationTreeState({
    ...props,
    imodel,
    ruleset,
    eventHandlerFactory,
    filteringParams: filterInfo?.filter ? {
      filter: filterInfo.filter,
      activeMatchIndex: filterInfo?.activeMatchIndex,
    } : undefined,
  });

  useEffect(
    () => {
      onFilterChange && onFilterChange(treeState?.filteringResult?.filteredProvider, treeState?.filteringResult?.matchesCount);
    },
    [treeState?.filteringResult?.matchesCount, treeState?.filteringResult?.filteredProvider, onFilterChange],
  );

  return treeState;
}

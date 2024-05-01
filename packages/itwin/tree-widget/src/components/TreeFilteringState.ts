/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useState } from "react";

import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";

/** @internal */
export interface SearchOptions {
  isFiltering: boolean;
  onFilterCancel: () => void;
  onFilterStart: (newFilter: string) => void;
  onResultSelectedChanged: (index: number) => void;
  matchedResultCount: number | undefined;
  activeMatchIndex: number | undefined;
}

interface TreeFilteringState {
  filterString: string;
  matchedResultCount?: number;
  activeMatchIndex?: number;
  filteredProvider?: IPresentationTreeDataProvider;
}

/** @internal */
export const useTreeFilteringState = () => {
  const [{ filterString, matchedResultCount, activeMatchIndex, filteredProvider }, setState] = useState<TreeFilteringState>({ filterString: "" });

  const onFilterCancel = useCallback(() => {
    setState({ filterString: "" });
  }, []);

  const onFilterStart = useCallback((newFilter: string) => {
    setState({ filterString: newFilter });
  }, []);

  const onResultSelectedChanged = useCallback((index: number) => {
    setState((prev) => ({ ...prev, activeMatchIndex: index }));
  }, []);

  const onFilterApplied = useCallback((provider: IPresentationTreeDataProvider, matches: number) => {
    setState((prev) => ({
      ...prev,
      activeMatchIndex: prev.activeMatchIndex === undefined ? 1 : Math.min(prev.activeMatchIndex, matches),
      matchedResultCount: matches,
      filteredProvider: provider,
    }));
  }, []);

  const isFiltering = !!filterString && matchedResultCount === undefined;
  const searchOptions: SearchOptions = {
    isFiltering,
    onFilterCancel,
    onFilterStart,
    onResultSelectedChanged,
    matchedResultCount,
    activeMatchIndex,
  };

  return {
    searchOptions,
    filterString,
    onFilterApplied,
    filteredProvider,
  };
};

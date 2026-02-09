/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useState } from "react";
import type { IPresentationTreeDataProvider } from "@itwin/presentation-components";

export const useTreeFilteringState = () => {
  const [filterString, setFilterString] = useState("");
  const [matchedResultCount, setMatchedResultCount] = useState<number>();
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>();
  const [filteredProvider, setFilteredProvider] = useState<IPresentationTreeDataProvider>();

  const onFilterCancel = React.useCallback(() => {
    setFilterString("");
    setMatchedResultCount(undefined);
    setFilteredProvider(undefined);
  }, []);

  const onFilterStart = React.useCallback((newFilter: string) => {
    setFilterString(newFilter);
    setMatchedResultCount(undefined);
    setFilteredProvider(undefined);
  }, []);

  const onResultSelectedChanged = React.useCallback((index: number) => {
    setActiveMatchIndex(index);
  }, []);

  const onFilterApplied = React.useCallback((provider: IPresentationTreeDataProvider, matches: number) => {
    setFilteredProvider(provider);
    setMatchedResultCount(matches);
  }, []);

  const isFiltering = !!filterString && matchedResultCount === undefined;

  return {
    searchOptions: {
      isFiltering,
      onFilterCancel,
      onFilterStart,
      onResultSelectedChanged,
      matchedResultCount,
    },
    filterString,
    activeMatchIndex,
    onFilterApplied,
    filteredProvider,
  };
};

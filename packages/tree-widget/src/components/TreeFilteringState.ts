/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useState } from "react";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";

export interface SearchOptions {
  isFiltering: boolean;
  onFilterCancel: () => void;
  onFilterStart: (newFilter: string) => void;
  onResultSelectedChanged: (index: number) => void;
  matchedResultCount: number | undefined;
}

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
  const searchOptions: SearchOptions = {
    isFiltering,
    onFilterCancel,
    onFilterStart,
    onResultSelectedChanged,
    matchedResultCount,
  };

  return {
    searchOptions,
    filterString,
    activeMatchIndex,
    onFilterApplied,
    filteredProvider,
  };
};

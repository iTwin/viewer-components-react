/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useState } from "react";

interface UseFilteringResult {
  filter: string;
  activeMatchIndex: number;
  totalMatches: number;
  applyFilter: (filter: string) => void;
  clearFilter: () => void;
  onHighlightChanged: (index: number, matches?: number) => void;
}

export function useFiltering(): UseFilteringResult {
  const [filter, setFilter] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const applyFilter = useCallback((newFilter: string) => {
    setActiveMatchIndex(0);
    setFilter(newFilter);
  }, []);

  const clearFilter = useCallback(() => {
    setActiveMatchIndex(0);
    setFilter("");
  }, []);

  const onHighlightChanged = useCallback((index: number, matches?: number) => {
    setActiveMatchIndex(index);
    matches && setTotalMatches(matches);
  }, []);

  return { filter, activeMatchIndex, totalMatches, applyFilter, clearFilter, onHighlightChanged };
}

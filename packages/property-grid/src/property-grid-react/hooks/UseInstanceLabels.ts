/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupInstanceKeysByClass, InstanceLabelsProvider } from "../common/InstanceLabelsProvider.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { LabeledInstanceKey } from "../common/InstanceLabelsProvider.js";

const PAGE_SIZE = 100;

/**
 * Result of `useInstanceLabels` hook.
 * @internal
 */
interface UseInstanceLabelsResult {
  /** Loaded rows, followed by placeholders for the page currently loading. */
  rows: ReadonlyArray<LabeledInstanceKey | undefined>;
  /** Starts the next page unless a request is pending or there are no more results. */
  loadMore: () => void;
}

/**
 * Loads labels for `instanceKeys` in sorted pages on `loadMore` requests. While a page is loading,
 * `rows` includes placeholders for its expected results.
 * @internal
 */
export function useInstanceLabels({ imodel, instanceKeys }: { imodel: IModelConnection; instanceKeys: InstanceKey[] }): UseInstanceLabelsResult {
  const [rows, setRows] = useState<UseInstanceLabelsResult["rows"]>([]);
  const loadNextPage = useRef<(() => void) | undefined>(undefined);
  const labelsProvider = useMemo(() => new InstanceLabelsProvider({ imodel }), [imodel]);
  const distinctInstanceKeys = useMemo(() => [...groupInstanceKeysByClass(instanceKeys).values()].flatMap((keys) => [...keys.values()]), [instanceKeys]);
  const session = useMemo(() => labelsProvider.createSession(distinctInstanceKeys, PAGE_SIZE), [labelsProvider, distinctInstanceKeys]);

  useEffect(() => {
    let items: LabeledInstanceKey[] = [];
    let hasMore = distinctInstanceKeys.length > 0;
    let loading = false;
    const subscription = session.pages.subscribe(({ page, hasMore: nextHasMore }) => {
      items = [...items, ...page];
      hasMore = nextHasMore;
      loading = false;
      setRows(items);
    });
    const loadPage = () => {
      if (loading || !hasMore || subscription.closed) {
        return;
      }
      loading = true;
      const placeholderCount = Math.min(PAGE_SIZE, distinctInstanceKeys.length - items.length);
      setRows([...items, ...new Array<undefined>(placeholderCount).fill(undefined)]);
      session.loadRequests.next();
    };
    loadNextPage.current = loadPage;
    setRows([]);

    return () => {
      subscription.unsubscribe();
      loadNextPage.current = undefined;
    };
  }, [session, distinctInstanceKeys]);

  const loadMore = useCallback(() => loadNextPage.current?.(), []);

  return { rows, loadMore };
}

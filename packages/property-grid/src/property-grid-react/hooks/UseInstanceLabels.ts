/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logger } from "@itwin/core-bentley";
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
 * Loads labels for `instanceKeys` in sorted pages. The first page is loaded eagerly and subsequent ones on `loadMore`
 * requests. While a page is loading, `rows` includes placeholders for its expected results.
 * @internal
 */
export function useInstanceLabels({ imodel, instanceKeys }: { imodel: IModelConnection; instanceKeys: InstanceKey[] }): UseInstanceLabelsResult {
  const [rows, setRows] = useState<UseInstanceLabelsResult["rows"]>([]);
  const loadNextPage = useRef<(() => Promise<void>) | undefined>(undefined);
  const labelsProvider = useMemo(() => new InstanceLabelsProvider({ imodel }), [imodel]);
  const distinctKeys = useMemo(() => [...groupInstanceKeysByClass(instanceKeys).values()].flatMap((keys) => [...keys.values()]), [instanceKeys]);

  useEffect(() => {
    let items: LabeledInstanceKey[] = [];
    let hasMore = distinctKeys.length > 0;
    let loading = false;
    let disposed = false;

    const loadPage = async () => {
      if (disposed || loading || !hasMore) {
        return;
      }
      loading = true;
      const placeholderCount = Math.min(PAGE_SIZE, distinctKeys.length - items.length);
      setRows([...items, ...new Array<undefined>(placeholderCount).fill(undefined)]);
      try {
        const page = await labelsProvider.getLabelsPage(distinctKeys, { offset: items.length, limit: PAGE_SIZE });
        if (disposed) {
          return;
        }
        items = [...items, ...page];
        hasMore = items.length < distinctKeys.length;
      } catch (error) {
        hasMore = false;
        if (!disposed) {
          Logger.logError("PropertyGrid", `Error loading instance labels: ${error instanceof Error ? error.message : String(error)}`);
        }
      } finally {
        loading = false;
        if (!disposed) {
          setRows(items);
        }
      }
    };
    loadNextPage.current = loadPage;
    setRows([]);
    void loadPage();

    return () => {
      disposed = true;
      loadNextPage.current = undefined;
    };
  }, [labelsProvider, distinctKeys]);

  const loadMore = useCallback(() => void loadNextPage.current?.(), []);

  return { rows, loadMore };
}

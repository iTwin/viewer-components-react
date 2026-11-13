/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeFullClassName } from "@itwin/presentation-shared";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";

export interface LabeledInstanceKey {
  instanceKey: InstanceKey;
  label: string;
}

export function createMockUseInstanceLabels(loadPage: (keys: InstanceKey[], page: { offset: number; limit: number }) => Promise<LabeledInstanceKey[]>) {
  return function useMockInstanceLabels({ instanceKeys }: { imodel: IModelConnection; instanceKeys: InstanceKey[] }) {
    const [rows, setRows] = useState<Array<LabeledInstanceKey | undefined>>([]);
    const loadRef = useRef<(() => void) | undefined>(undefined);
    const keys = useMemo(() => {
      const byClass = new Map<string, Map<string, InstanceKey>>();
      for (const key of instanceKeys) {
        const name = normalizeFullClassName(key.className);
        let byId = byClass.get(name);
        if (!byId) {
          byId = new Map();
          byClass.set(name, byId);
        }
        byId.set(key.id, key);
      }
      return [...byClass.values()].flatMap((values) => [...values.values()]);
    }, [instanceKeys]);
    useEffect(() => {
      let items: LabeledInstanceKey[] = [];
      let loading = false;
      let hasMore = keys.length > 0;
      let disposed = false;
      loadRef.current = () => {
        if (loading || !hasMore) {
          return;
        }
        loading = true;
        setRows([...items, ...new Array<undefined>(Math.min(100, keys.length - items.length)).fill(undefined)]);
        void loadPage(keys, { offset: items.length, limit: 100 }).then((page) => {
          if (!disposed) {
            items = [...items, ...page];
            hasMore = page.length === 100 && items.length < keys.length;
            loading = false;
            setRows(items);
          }
        });
      };
      setRows([]);
      return () => {
        disposed = true;
        loadRef.current = undefined;
      };
    }, [keys]);
    return { rows, loadMore: useCallback(() => loadRef.current?.(), []) };
  };
}

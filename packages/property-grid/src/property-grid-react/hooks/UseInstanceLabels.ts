/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { concatMap, defer, EMPTY, exhaustMap, from, map, mergeMap, of, Subject, switchMap, take, tap, toArray } from "rxjs";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import {
  createBisInstanceLabelSelectClauseFactory,
  createCachingECClassHierarchyInspector,
  createDefaultValueFormatter,
  ECSql,
  formatConcatenatedValue,
  normalizeFullClassName,
  parseFullClassName,
  parseInstanceLabel,
} from "@itwin/presentation-shared";
import { trackTime } from "../common/TimeTracker.js";
import { useTelemetryContext } from "./UseTelemetryContext.js";

import type { Observable } from "rxjs";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { ECSqlBinding } from "@itwin/presentation-shared";

const MAX_COMPOUND_SELECTS = 500;
const PAGE_SIZE = 100;

interface LabeledInstanceKey {
  instanceKey: InstanceKey;
  label: string;
}

interface InstanceLabelsSession {
  /** Request a page after subscribing to `pages`. */
  loadRequests: Subject<void>;
  /** Page stream for a single subscriber. */
  pages: Observable<{ page: LabeledInstanceKey[]; hasMore: boolean }>;
}

function groupInstanceKeysByClass(instanceKeys: InstanceKey[]): Map<string, Map<Id64String, InstanceKey>> {
  const keysByClass = new Map<string, Map<Id64String, InstanceKey>>();
  for (const key of instanceKeys) {
    const className = normalizeFullClassName(key.className);
    let keys = keysByClass.get(className);
    if (!keys) {
      keys = new Map();
      keysByClass.set(className, keys);
    }
    keys.set(key.id, key);
  }
  return keysByClass;
}

interface UseInstanceLabelsResult {
  rows: ReadonlyArray<LabeledInstanceKey | undefined>;
  loadMore: () => void;
}

/** Loads labels in sorted pages, with placeholders while a page is loading. @internal */
export function useInstanceLabels({ imodel, instanceKeys }: { imodel: IModelConnection; instanceKeys: InstanceKey[] }): UseInstanceLabelsResult {
  const [rows, setRows] = useState<UseInstanceLabelsResult["rows"]>([]);
  const loadNextPage = useRef<(() => void) | undefined>(undefined);
  const { onPerformanceMeasured } = useTelemetryContext();
  const keysByClass = useMemo(() => groupInstanceKeysByClass(instanceKeys), [instanceKeys]);
  const total = useMemo(() => [...keysByClass.values()].reduce((count, keys) => count + keys.size, 0), [keysByClass]);
  const session = useMemo(() => createSession(imodel, keysByClass, total), [imodel, keysByClass, total]);

  useEffect(() => {
    let items: LabeledInstanceKey[] = [];
    let hasMore = total > 0;
    let loading = false;
    let timer: ReturnType<typeof trackTime> | undefined;
    const subscription = session.pages.subscribe(({ page, hasMore: nextHasMore }) => {
      timer?.finish();
      timer = undefined;
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
      timer = trackTime(true, (elapsedTime) => onPerformanceMeasured("elements-list-load", elapsedTime));
      const placeholderCount = Math.min(PAGE_SIZE, total - items.length);
      setRows([...items, ...new Array<undefined>(placeholderCount).fill(undefined)]);
      session.loadRequests.next();
    };
    loadNextPage.current = loadPage;
    setRows([]);

    return () => {
      timer?.dispose();
      subscription.unsubscribe();
      loadNextPage.current = undefined;
    };
  }, [session, total, onPerformanceMeasured]);

  const loadMore = useCallback(() => loadNextPage.current?.(), []);
  return { rows, loadMore };
}

function createSession(imodel: IModelConnection, keysByClass: Map<string, Map<Id64String, InstanceKey>>, total: number): InstanceLabelsSession {
  const schemaProvider = createECSchemaProvider(imodel.schemaContext);
  const queryExecutor = createECSqlQueryExecutor(imodel);
  const labelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({
    classHierarchyInspector: createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 100 }),
  });
  const valueFormatter = createDefaultValueFormatter();
  const loadRequests = new Subject<void>();
  const prepare = () =>
    from(keysByClass).pipe(
      mergeMap(async ([fullClassName, keys], index) => {
        const { schemaName, className } = parseFullClassName(fullClassName);
        const [label, sortLabel] = await Promise.all([
          labelSelectClauseFactory.createSelectClause({ classAlias: "this", className: fullClassName }),
          labelSelectClauseFactory.createSelectClause({
            classAlias: "this",
            className: fullClassName,
            selectorsConcatenator: ECSql.createConcatenatedValueStringSelector,
          }),
        ]);
        return {
          index,
          ecsql: `SELECT this.ECInstanceId AS id, '${fullClassName}' AS className, ${label} AS label, ${sortLabel} AS sortLabel
        FROM [${schemaName}].[${className}] AS this JOIN IdSet(?) AS ids ON ids.id = this.ECInstanceId`,
          binding: { type: "idset", value: [...keys.keys()] } satisfies ECSqlBinding,
        };
      }),
      toArray(),
      map((selects) => createSortedLabelsPageQuery(selects.sort((a, b) => a.index - b.index))),
    );
  const pages = defer(() => {
    let offset = 0;
    let hasMore = total > 0;
    let prepared: ReturnType<typeof createSortedLabelsPageQuery> | undefined;
    return loadRequests.pipe(
      exhaustMap(() => {
        if (!hasMore) {
          return EMPTY;
        }
        return (prepared ? of(prepared) : prepare().pipe(tap((query) => (prepared = query)))).pipe(
          switchMap((query) =>
            defer(() =>
              from(
                queryExecutor.createQueryReader(
                  {
                    ...query,
                    bindings: [...query.bindings, { type: "long", value: PAGE_SIZE }, { type: "long", value: offset }],
                  },
                  { rowFormat: "ECSqlPropertyNames" },
                ),
              ),
            ).pipe(
              take(PAGE_SIZE),
              concatMap(async (row): Promise<LabeledInstanceKey> => {
                const instanceKey = keysByClass.get(row.className)?.get(row.id);
                if (!instanceKey) {
                  throw new Error("Label query returned an instance outside the requested selection.");
                }
                return { instanceKey, label: await formatConcatenatedValue({ value: parseInstanceLabel(row.label), valueFormatter }) };
              }),
              toArray(),
            ),
          ),
          map((page) => {
            offset += page.length;
            hasMore = page.length === PAGE_SIZE && offset < total;
            return { page, hasMore };
          }),
        );
      }),
    );
  });
  return { loadRequests, pages };
}

function createSortedLabelsPageQuery(selects: Array<{ ecsql: string; binding: ECSqlBinding }>) {
  const { ctes, branches } = createBatchedLabelCtes(selects.map(({ ecsql }) => ecsql));
  return {
    ctes,
    ecsql: `SELECT id, className, label FROM (${branches.join(" UNION ALL ")}) ORDER BY LOWER(sortLabel), className, id LIMIT ? OFFSET ?`,
    bindings: selects.map(({ binding }) => binding),
  };
}

function createBatchedLabelCtes(selects: string[]): { ctes: string[]; branches: string[] } {
  const ctes: string[] = [];
  let branches = selects;
  // SQLite limits each compound SELECT to 500 branches. Build CTE levels until the final
  // UNION ALL also fits that limit, so sorting and pagination apply to the entire selection.
  for (let level = 0; level === 0 || branches.length > MAX_COMPOUND_SELECTS; ++level) {
    const batched: string[] = [];
    for (let offset = 0; offset < branches.length; offset += MAX_COMPOUND_SELECTS) {
      const name = `labels_${level}_${batched.length}`;
      ctes.push(`${name}(id, className, label, sortLabel) AS (${branches.slice(offset, offset + MAX_COMPOUND_SELECTS).join(" UNION ALL ")})`);
      batched.push(`SELECT id, className, label, sortLabel FROM ${name}`);
    }
    branches = batched;
  }
  return { ctes, branches };
}

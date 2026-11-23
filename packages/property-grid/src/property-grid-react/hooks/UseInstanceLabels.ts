/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { concatMap, defer, EMPTY, exhaustMap, from, map, shareReplay, Subject, switchMap, take, toArray } from "rxjs";
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
import type { ECClassHierarchyInspector, ECSqlBinding, InstanceKey } from "@itwin/presentation-shared";

const PAGE_SIZE = 100;

interface LabeledInstanceKey {
  instanceKey: InstanceKey;
  label: string;
}

interface InstanceLabelsSession {
  /** Request a page after subscribing to `pages`. */
  loadMore: () => void;
  /** Page stream for a single subscriber. */
  pages: Observable<{ page: LabeledInstanceKey[]; hasMore: boolean }>;
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
  const labelQueryServices = useMemo(() => createLabelQueryServices(imodel), [imodel]);
  const session = useMemo(() => createSession(labelQueryServices, instanceKeys), [labelQueryServices, instanceKeys]);

  useEffect(() => {
    let items: LabeledInstanceKey[] = [];
    const total = instanceKeys.length;
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
      timer = trackTime(true, (elapsedTime) => onPerformanceMeasured("elements-list-page-load", elapsedTime));
      const placeholderCount = Math.min(PAGE_SIZE, total - items.length);
      setRows([...items, ...new Array<undefined>(placeholderCount).fill(undefined)]);
      session.loadMore();
    };
    loadNextPage.current = loadPage;
    setRows([]);

    return () => {
      timer?.dispose();
      subscription.unsubscribe();
      loadNextPage.current = undefined;
    };
  }, [session, instanceKeys.length, onPerformanceMeasured]);

  const loadMore = useCallback(() => loadNextPage.current?.(), []);
  return { rows, loadMore };
}

function createLabelQueryServices(imodel: IModelConnection) {
  const schemaProvider = createECSchemaProvider(imodel.schemaContext);
  const classHierarchyInspector = createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 100 });
  return {
    queryExecutor: createECSqlQueryExecutor(imodel),
    labelSelectClauseFactory: createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector }),
    classHierarchyInspector,
    valueFormatter: createDefaultValueFormatter(),
  };
}

function createSession(
  { queryExecutor, labelSelectClauseFactory, classHierarchyInspector, valueFormatter }: ReturnType<typeof createLabelQueryServices>,
  instanceKeys: InstanceKey[],
): InstanceLabelsSession {
  const loadRequests = new Subject<void>();
  const pages = defer(() => {
    let offset = 0;
    let hasMore = instanceKeys.length > 0;
    const preparedQuery = defer(async () => {
      const idsByBaseClass = await groupInstanceIdsByCommonBase(classHierarchyInspector, instanceKeys);
      const groupSelects = await Promise.all(
        [...idsByBaseClass].map(async ([baseClass, ids]) => {
          const { schemaName, className } = parseFullClassName(baseClass);
          const [label, sortLabel] = await Promise.all([
            labelSelectClauseFactory.createSelectClause({ classAlias: "this", className: baseClass }),
            labelSelectClauseFactory.createSelectClause({
              classAlias: "this",
              className: baseClass,
              selectorsConcatenator: ECSql.createConcatenatedValueStringSelector,
            }),
          ]);
          return {
            ecsql: `SELECT this.ECInstanceId AS id, ec_classname(this.ECClassId, 's.c') AS className, ${label} AS label, ${sortLabel} AS sortLabel
        FROM [${schemaName}].[${className}] AS this JOIN IdSet(?) AS ids ON ids.id = this.ECInstanceId`,
            bindings: [{ type: "idset", value: [...ids] } satisfies ECSqlBinding],
          };
        }),
      );
      return { query: createSortedLabelsPageQuery(groupSelects), total: [...idsByBaseClass.values()].reduce((count, ids) => count + ids.size, 0) };
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    return loadRequests.pipe(
      exhaustMap(() => {
        if (!hasMore) {
          return EMPTY;
        }
        return preparedQuery.pipe(
          switchMap(({ query, total }) =>
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
              concatMap(async (row): Promise<LabeledInstanceKey> => ({
                instanceKey: { className: row.className, id: row.id },
                label: await formatConcatenatedValue({ value: parseInstanceLabel(row.label), valueFormatter }),
              })),
              toArray(),
              map((page) => {
                offset += page.length;
                hasMore = offset < total;
                return { page, hasMore };
              }),
            ),
          ),
        );
      }),
    );
  });
  return { loadMore: () => loadRequests.next(), pages };
}

async function groupInstanceIdsByCommonBase(classHierarchyInspector: ECClassHierarchyInspector, instanceKeys: InstanceKey[]) {
  const idsByBaseClass = new Map<string, Set<Id64String>>();
  for (const key of instanceKeys) {
    let className = normalizeFullClassName(key.className);
    for (const baseClass of ["BisCore.Element", "BisCore.Model"]) {
      const result = classHierarchyInspector.classDerivesFrom(className, baseClass);
      if (result instanceof Promise ? await result : result) {
        className = baseClass;
        break;
      }
    }
    idsByBaseClass.set(className, (idsByBaseClass.get(className) ?? new Set<Id64String>()).add(key.id));
  }
  return idsByBaseClass;
}

function createSortedLabelsPageQuery(selects: Array<{ ecsql: string; bindings: ECSqlBinding[] }>) {
  return {
    ecsql: `SELECT id, className, label FROM (${selects.map(({ ecsql }) => ecsql).join(" UNION ALL ")}) ORDER BY LOWER(sortLabel), className, id LIMIT ? OFFSET ?`,
    bindings: selects.flatMap(({ bindings }) => bindings),
  };
}

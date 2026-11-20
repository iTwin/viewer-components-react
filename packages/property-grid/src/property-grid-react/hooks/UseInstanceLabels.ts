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
  pages: Observable<{ page: LabeledInstanceKey[]; hasMore: boolean; total: number }>;
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
  const initialKeyCount = useMemo(() => [...keysByClass.values()].reduce((count, keys) => count + keys.size, 0), [keysByClass]);
  const labelQueryServices = useMemo(() => createLabelQueryServices(imodel), [imodel]);
  const session = useMemo(() => createSession(labelQueryServices, keysByClass), [labelQueryServices, keysByClass]);

  useEffect(() => {
    let items: LabeledInstanceKey[] = [];
    let total = initialKeyCount;
    let hasMore = total > 0;
    let loading = false;
    let timer: ReturnType<typeof trackTime> | undefined;
    const subscription = session.pages.subscribe(({ page, hasMore: nextHasMore, total: groupedTotal }) => {
      timer?.finish();
      timer = undefined;
      items = [...items, ...page];
      hasMore = nextHasMore;
      // reduce total amount if some instances are duplicates under two different classes (base and derived)
      total = groupedTotal;
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
  }, [session, initialKeyCount, onPerformanceMeasured]);

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
  keysByClass: Map<string, Map<Id64String, InstanceKey>>,
): InstanceLabelsSession {
  const loadRequests = new Subject<void>();
  const pages = defer(() => {
    let offset = 0;
    let hasMore = keysByClass.size > 0;
    const preparedQuery = defer(async () => {
      const groups =
        keysByClass.size === 1
          ? [...keysByClass.keys()].map((baseClass) => ({ baseClass, classNames: [baseClass] }))
          : await groupClassesByCommonBase(classHierarchyInspector, [...keysByClass.keys()]);
      const groupSelects = await Promise.all(
        groups.map(async ({ baseClass: groupBaseClass, classNames }) => {
          const baseClass = classNames.length === 1 ? classNames[0] : groupBaseClass;
          const { schemaName, className } = parseFullClassName(baseClass);
          const keys = new Map<Id64String, InstanceKey>();
          for (const name of classNames) {
            const classKeys = keysByClass.get(name);
            if (!classKeys) {
              throw new Error(`Missing selected keys for class "${name}".`);
            }
            for (const [id, key] of classKeys) {
              if (!keys.has(id)) {
                keys.set(id, key);
              }
            }
          }
          const [label, sortLabel] = await Promise.all([
            labelSelectClauseFactory.createSelectClause({ classAlias: "this", className: baseClass }),
            labelSelectClauseFactory.createSelectClause({
              classAlias: "this",
              className: baseClass,
              selectorsConcatenator: ECSql.createConcatenatedValueStringSelector,
            }),
          ]);
          return {
            groupBaseClass,
            keys,
            ecsql: `SELECT this.ECInstanceId AS id, '${groupBaseClass}' AS className, ${label} AS label, ${sortLabel} AS sortLabel
        FROM [${schemaName}].[${className}] AS this JOIN IdSet(?) AS ids ON ids.id = this.ECInstanceId`,
            bindings: [{ type: "idset", value: [...keys.keys()] } satisfies ECSqlBinding],
          };
        }),
      );
      return {
        query: createSortedLabelsPageQuery(groupSelects),
        keysByGroup: new Map(groupSelects.map(({ groupBaseClass, keys }) => [groupBaseClass, keys])),
        total: groupSelects.reduce((count, { keys }) => count + keys.size, 0),
      };
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    return loadRequests.pipe(
      exhaustMap(() => {
        if (!hasMore) {
          return EMPTY;
        }
        return preparedQuery.pipe(
          switchMap(({ query, keysByGroup, total }) =>
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
                const instanceKey = keysByGroup.get(row.className)?.get(row.id);
                if (!instanceKey) {
                  throw new Error("Label query returned an instance outside the requested selection.");
                }
                return { instanceKey, label: await formatConcatenatedValue({ value: parseInstanceLabel(row.label), valueFormatter }) };
              }),
              toArray(),
              map((page) => {
                offset += page.length;
                hasMore = page.length === PAGE_SIZE && offset < total;
                return { page, hasMore, total };
              }),
            ),
          ),
        );
      }),
    );
  });
  return { loadMore: () => loadRequests.next(), pages };
}

async function groupClassesByCommonBase(classHierarchyInspector: ECClassHierarchyInspector, classNames: string[]) {
  const classesWithBases = await Promise.all(
    classNames.map(async (className) => {
      for (const baseClass of ["BisCore.Element", "BisCore.Model"]) {
        const result = classHierarchyInspector.classDerivesFrom(className, baseClass);
        if (result instanceof Promise ? await result : result) {
          return { className, baseClass };
        }
      }
      return { className, baseClass: className };
    }),
  );
  const groups = new Map<string, string[]>();
  for (const { className, baseClass } of classesWithBases) {
    const group = groups.get(baseClass) ?? [];
    group.push(className);
    groups.set(baseClass, group);
  }
  return [...groups].map(([baseClass, names]) => ({ baseClass, classNames: names }));
}

function createSortedLabelsPageQuery(selects: Array<{ ecsql: string; bindings: ECSqlBinding[] }>) {
  return {
    ecsql: `SELECT id, className, label FROM (${selects.map(({ ecsql }) => ecsql).join(" UNION ALL ")}) ORDER BY LOWER(sortLabel), className, id LIMIT ? OFFSET ?`,
    bindings: selects.flatMap(({ bindings }) => bindings),
  };
}

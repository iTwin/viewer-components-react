/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, defer, EMPTY, exhaustMap, from, map, Subject, switchMap, take, toArray } from "rxjs";
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

import type { Observable } from "rxjs";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { ECSqlBinding, ECSqlQueryExecutor, IInstanceLabelSelectClauseFactory, IPrimitiveValueFormatter } from "@itwin/presentation-shared";

const MAX_COMPOUND_SELECTS = 500;

export interface InstanceLabelsProviderProps {
  imodel: IModelConnection;
}

export interface LabeledInstanceKey {
  instanceKey: InstanceKey;
  label: string;
}

export interface InstanceLabelsSession {
  /** Request a page after subscribing to `pages`. */
  loadRequests: Subject<void>;
  /** Page stream for a single subscriber. */
  pages: Observable<{ page: LabeledInstanceKey[]; hasMore: boolean }>;
}

export function groupInstanceKeysByClass(instanceKeys: InstanceKey[]): Map<string, Map<Id64String, InstanceKey>> {
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

export class InstanceLabelsProvider {
  readonly #queryExecutor: ECSqlQueryExecutor;
  readonly #labelSelectClauseFactory: IInstanceLabelSelectClauseFactory;
  readonly #valueFormatter: IPrimitiveValueFormatter;

  constructor({ imodel }: InstanceLabelsProviderProps) {
    const schemaProvider = createECSchemaProvider(imodel.schemaContext);
    this.#queryExecutor = createECSqlQueryExecutor(imodel);
    this.#labelSelectClauseFactory = createBisInstanceLabelSelectClauseFactory({
      classHierarchyInspector: createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 100 }),
    });
    this.#valueFormatter = createDefaultValueFormatter();
  }

  public createSession(distinctInstanceKeys: InstanceKey[], pageSize: number): InstanceLabelsSession {
    const keysByClass = groupInstanceKeysByClass(distinctInstanceKeys);
    const loadRequests = new Subject<void>();
    const prepare = async () => {
      const selects = await Promise.all(
        [...keysByClass.keys()].map(async (fullClassName) => {
          const { schemaName, className } = parseFullClassName(fullClassName);
          const [label, sortLabel] = await Promise.all([
            this.#labelSelectClauseFactory.createSelectClause({ classAlias: "this", className: fullClassName }),
            this.#labelSelectClauseFactory.createSelectClause({
              classAlias: "this",
              className: fullClassName,
              selectorsConcatenator: ECSql.createConcatenatedValueStringSelector,
            }),
          ]);
          return `SELECT this.ECInstanceId AS id, '${fullClassName}' AS className, ${label} AS label, ${sortLabel} AS sortLabel
        FROM [${schemaName}].[${className}] AS this JOIN IdSet(?) AS ids ON ids.id = this.ECInstanceId`;
        }),
      );
      const bindings: ECSqlBinding[] = [...keysByClass.values()].map((keys) => ({ type: "idset", value: [...keys.keys()] }));
      return createSortedLabelsPageQuery(selects, bindings);
    };
    const pages = defer(() => {
      let offset = 0;
      let hasMore = distinctInstanceKeys.length > 0;
      let prepared: ReturnType<typeof prepare> | undefined;
      return loadRequests.pipe(
        exhaustMap(() => {
          if (!hasMore) {
            return EMPTY;
          }
          prepared ??= prepare();
          return from(prepared).pipe(
            switchMap((query) =>
              defer(() =>
                from(
                  this.#queryExecutor.createQueryReader(
                    {
                      ...query,
                      bindings: [...query.bindings, { type: "long", value: pageSize }, { type: "long", value: offset }],
                    },
                    { rowFormat: "ECSqlPropertyNames" },
                  ),
                ),
              ).pipe(
                take(pageSize),
                concatMap(async (row): Promise<LabeledInstanceKey> => {
                  const instanceKey = keysByClass.get(row.className)?.get(row.id);
                  if (!instanceKey) {
                    throw new Error("Label query returned an instance outside the requested selection.");
                  }
                  return { instanceKey, label: await this.#formatLabel(row.label) };
                }),
                toArray(),
              ),
            ),
            map((page) => {
              offset += page.length;
              hasMore = page.length === pageSize && offset < distinctInstanceKeys.length;
              return { page, hasMore };
            }),
          );
        }),
      );
    });
    return { loadRequests, pages };
  }

  async #formatLabel(rawLabel: string | undefined): Promise<string> {
    return formatConcatenatedValue({ value: parseInstanceLabel(rawLabel), valueFormatter: this.#valueFormatter });
  }
}

function createSortedLabelsPageQuery(selects: string[], bindings: ECSqlBinding[]) {
  const { ctes, branches } = createBatchedLabelCtes(selects);
  return {
    ctes,
    ecsql: `SELECT id, className, label FROM (${branches.join(" UNION ALL ")}) ORDER BY LOWER(sortLabel), className, id LIMIT ? OFFSET ?`,
    bindings,
  };
}

function createBatchedLabelCtes(selects: string[]): { ctes: string[]; branches: string[] } {
  const ctes: string[] = [];
  let branches = selects;
  let level = 0;
  do {
    const batched: string[] = [];
    for (let offset = 0; offset < branches.length; offset += MAX_COMPOUND_SELECTS) {
      const name = `labels_${level}_${batched.length}`;
      ctes.push(`${name}(id, className, label, sortLabel) AS (${branches.slice(offset, offset + MAX_COMPOUND_SELECTS).join(" UNION ALL ")})`);
      batched.push(`SELECT id, className, label, sortLabel FROM ${name}`);
    }
    branches = batched;
    ++level;
  } while (branches.length > MAX_COMPOUND_SELECTS);
  return { ctes, branches };
}

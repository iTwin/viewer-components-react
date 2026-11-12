/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, from, lastValueFrom, take, toArray } from "rxjs";
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

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { ECSqlBinding, ECSqlQueryDef, ECSqlQueryExecutor, IInstanceLabelSelectClauseFactory, IPrimitiveValueFormatter } from "@itwin/presentation-shared";

const MAX_COMPOUND_SELECTS = 500;

export interface InstanceLabelsProviderProps {
  imodel: IModelConnection;
}

export interface LabeledInstanceKey {
  instanceKey: InstanceKey;
  label: string;
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

  public async getLabelsPage(instanceKeys: InstanceKey[], page: { offset: number; limit: number }): Promise<LabeledInstanceKey[]> {
    if (!Number.isInteger(page.offset) || page.offset < 0 || !Number.isInteger(page.limit) || page.limit < 1) {
      throw new Error("Page offset must be a non-negative integer and limit must be a positive integer.");
    }
    if (instanceKeys.length === 0) {
      return [];
    }
    const keysByClass = groupInstanceKeysByClass(instanceKeys);
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
    const query = createSortedLabelsPageQuery(selects, bindings, page);
    const reader = this.#queryExecutor.createQueryReader(query, { rowFormat: "ECSqlPropertyNames" });
    return lastValueFrom(
      from(reader).pipe(
        take(page.limit),
        concatMap(async (row): Promise<LabeledInstanceKey> => {
          const instanceKey = keysByClass.get(row.className)?.get(row.id);
          if (!instanceKey) {
            throw new Error("Label query returned an instance outside the requested selection.");
          }
          return { instanceKey, label: await this.#formatLabel(row.label) };
        }),
        toArray(),
      ),
    );
  }

  async #formatLabel(rawLabel: string | undefined): Promise<string> {
    return formatConcatenatedValue({ value: parseInstanceLabel(rawLabel), valueFormatter: this.#valueFormatter });
  }
}

function createSortedLabelsPageQuery(selects: string[], bindings: ECSqlBinding[], page: { offset: number; limit: number }): ECSqlQueryDef {
  const { ctes, branches } = createBatchedLabelCtes(selects);
  return {
    ctes,
    ecsql: `SELECT id, className, label FROM (${branches.join(" UNION ALL ")}) ORDER BY LOWER(sortLabel), className, id LIMIT ? OFFSET ?`,
    bindings: [...bindings, { type: "long", value: page.limit }, { type: "long", value: page.offset }],
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

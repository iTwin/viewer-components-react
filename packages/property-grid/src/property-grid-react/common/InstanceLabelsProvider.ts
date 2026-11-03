/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import {
  createBisInstanceLabelSelectClauseFactory,
  createCachingECClassHierarchyInspector,
  createDefaultValueFormatter,
  formatConcatenatedValue,
  normalizeFullClassName,
  parseFullClassName,
  parseInstanceLabel,
} from "@itwin/presentation-shared";

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { ECSqlQueryExecutor, IInstanceLabelSelectClauseFactory, IPrimitiveValueFormatter } from "@itwin/presentation-shared";

export interface InstanceLabelsProviderProps {
  imodel: IModelConnection;
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

  /** Returns labels in the same order as given `instanceKeys`. Instances that don't exist in the iModel get an empty label. */
  public async getLabels(instanceKeys: InstanceKey[]): Promise<string[]> {
    const normalizedKeys = instanceKeys.map(({ className, id }) => ({ fullClassName: normalizeFullClassName(className), id }));

    const idsByClass = new Map<string, Id64String[]>();
    for (const { fullClassName, id } of normalizedKeys) {
      const ids = idsByClass.get(fullClassName);
      if (ids) {
        ids.push(id);
      } else {
        idsByClass.set(fullClassName, [id]);
      }
    }

    const labelsByClass = new Map<string, Map<Id64String, string>>();
    await Promise.all(
      [...idsByClass.entries()].map(async ([fullClassName, ids]) => {
        labelsByClass.set(fullClassName, await this.#queryLabels(fullClassName, ids));
      }),
    );

    return normalizedKeys.map(({ fullClassName, id }) => labelsByClass.get(fullClassName)?.get(id) ?? "");
  }

  async #queryLabels(fullClassName: string, ids: Id64String[]): Promise<Map<Id64String, string>> {
    const { schemaName, className } = parseFullClassName(fullClassName);
    const labelSelectClause = await this.#labelSelectClauseFactory.createSelectClause({ classAlias: "this", className: fullClassName });
    const reader = this.#queryExecutor.createQueryReader(
      {
        ecsql: `
          SELECT this.ECInstanceId AS id, ${labelSelectClause} AS label
          FROM [${schemaName}].[${className}] AS this
          JOIN IdSet(?) AS ids ON ids.id = this.ECInstanceId
        `,
        bindings: [{ type: "idset", value: ids }],
      },
      { rowFormat: "ECSqlPropertyNames" },
    );
    // start formatting each label as soon as its row arrives, without blocking the reader
    const entries = new Array<Promise<[Id64String, string]>>();
    for await (const row of reader) {
      entries.push(this.#formatLabel(row.label).then((label) => [row.id, label]));
    }
    return new Map(await Promise.all(entries));
  }

  async #formatLabel(rawLabel: string | undefined): Promise<string> {
    return formatConcatenatedValue({ value: parseInstanceLabel(rawLabel), valueFormatter: this.#valueFormatter });
  }
}

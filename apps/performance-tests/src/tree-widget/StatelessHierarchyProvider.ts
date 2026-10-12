/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { asyncScheduler, expand, filter, finalize, from, observeOn, of, tap } from "rxjs";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createIModelHierarchyProvider, createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { LOGGER } from "../util/Logging.js";

import type { IModelDb } from "@itwin/core-backend";
import type { HierarchyDefinition, HierarchyNode, HierarchyProvider, HierarchySearchTree } from "@itwin/presentation-hierarchies";
import type { EC, ECSchemaProvider, ECSqlQueryDef, ECSqlQueryExecutor, ECSqlQueryReaderOptions } from "@itwin/presentation-shared";
import type { CategoriesTreeIdsCache, ModelsTreeIdsCache } from "@itwin/tree-widget-react/internal";

interface ProviderOptionsBase {
  rowLimit?: number | "unbounded";
  getHierarchyFactory(imodelAccess: ECSchemaProvider, idsCache?: typeof ModelsTreeIdsCache | typeof CategoriesTreeIdsCache): HierarchyDefinition;
  search?: {
    paths: HierarchySearchTree[];
  };
  queryCacheSize?: number;
}

type ProviderOptionsWithIModel = { iModel: IModelDb } & ProviderOptionsBase;

type ProviderOptionsWithIModelAccess = { imodelAccess: IModelAccess } & ProviderOptionsBase;

type ProviderOptions = ProviderOptionsWithIModel | ProviderOptionsWithIModelAccess;

const LOG_CATEGORY = "TreeWidget.PerformanceTests.StatelessHierarchyProvider";

function log(messageOrCallback: string | (() => string)) {
  if (LOGGER.isEnabled(LOG_CATEGORY, "trace")) {
    LOGGER.logTrace(LOG_CATEGORY, typeof messageOrCallback === "string" ? messageOrCallback : messageOrCallback());
  }
}

const DEFAULT_ROW_LIMIT = 1000;

export interface IModelAccess {
  createQueryReader(
    query: ECSqlQueryDef,
    config?: ECSqlQueryReaderOptions & {
      limit?: number | "unbounded";
    },
  ): ReturnType<ECSqlQueryExecutor["createQueryReader"]>;
  classDerivesFrom(derivedClassFullName: string, candidateBaseClassFullName: string): Promise<boolean> | boolean;
  getSchema(schemaName: string): Promise<EC.Schema | undefined>;
  imodelKey: string;
}

export class StatelessHierarchyProvider implements Disposable {
  readonly #provider: HierarchyProvider & Disposable;
  #props: ProviderOptions;

  constructor(props: ProviderOptions) {
    this.#props = props;
    this.#provider = this.createProvider();
  }

  public async loadHierarchy(props?: { shouldExpand?: (node: HierarchyNode, index: number) => boolean }): Promise<number> {
    let nodeCount = 0;
    return new Promise<number>((resolve, reject) => {
      const nodesObservable = of<HierarchyNode | undefined>(undefined).pipe(
        expand((parentNode) => {
          const parentNodeLabel = parentNode ? parentNode.label : "<root>";
          log(`Requesting children for ${parentNodeLabel}`);
          return from(this.#provider.getNodes({ parentNode })).pipe(
            finalize(() => {
              log(`Got children for ${parentNodeLabel}`);
            }),
            tap(() => ++nodeCount),
            filter((node, index) => (props?.shouldExpand ? props.shouldExpand(node, index) : true)),
            observeOn(asyncScheduler),
          );
        }, 1),
      );
      nodesObservable.subscribe({
        complete: () => resolve(nodeCount),
        error: reject,
      });
    });
  }

  public [Symbol.dispose]() {
    this.#provider[Symbol.dispose]();
  }

  private createProvider() {
    const imodelAccess =
      "iModel" in this.#props ? StatelessHierarchyProvider.createIModelAccess(this.#props.iModel, this.#props.rowLimit) : this.#props.imodelAccess;
    return createIModelHierarchyProvider({
      imodelAccess,
      hierarchyDefinition: this.#props.getHierarchyFactory(imodelAccess),
      queryCacheSize: this.#props.queryCacheSize ?? 0,
      search: this.#props.search,
    });
  }

  public static createIModelAccess(iModel: IModelDb, rowLimit?: number | "unbounded"): IModelAccess {
    const schemaProvider = createECSchemaProvider(iModel);
    const rowLimitToUse = rowLimit ?? DEFAULT_ROW_LIMIT;
    const imodelAccess = {
      imodelKey: iModel.key,
      ...schemaProvider,
      ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(iModel), rowLimitToUse),
    };
    return imodelAccess;
  }
}

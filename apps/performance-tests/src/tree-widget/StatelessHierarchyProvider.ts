/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { asyncScheduler, expand, filter, finalize, from, observeOn, of, tap } from "rxjs";
import { BeDuration } from "@itwin/core-bentley";
import { Schema, SchemaContext, SchemaJsonLocater } from "@itwin/ecschema-metadata";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createIModelHierarchyProvider, createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import { LOGGER } from "../util/Logging.cjs";

import type { IModelDb } from "@itwin/core-backend";
import type { SchemaKey, SchemaMatchType, SchemaPropsGetter } from "@itwin/ecschema-metadata";
import type { HierarchyDefinition, HierarchyFilteringPath, HierarchyNode, HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { EC, ECClassHierarchyInspector, ECSchemaProvider, ECSqlQueryDef, ECSqlQueryExecutor, ECSqlQueryReaderOptions } from "@itwin/presentation-shared";
import type { CategoriesTreeIdsCache, ModelsTreeIdsCache } from "@itwin/tree-widget-react/internal";

interface ProviderOptionsBase {
  rowLimit?: number | "unbounded";
  getHierarchyFactory(
    imodelAccess: ECSchemaProvider & ECClassHierarchyInspector,
    idsCache?: typeof ModelsTreeIdsCache | typeof CategoriesTreeIdsCache,
  ): HierarchyDefinition;
  filtering?: {
    paths: HierarchyFilteringPath[];
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

  public async loadHierarchy(props?: { depth?: number }): Promise<number> {
    const depth = props?.depth;

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
            filter((node) => node.children && (!depth || getNodeDepth(node) < depth)),
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

  private static createECSchemaProvider(iModel: IModelDb) {
    const schemas = new SchemaContext();
    const locater = new AsyncSchemaJsonLocater((schemaName) => iModel.getSchemaProps(schemaName));
    schemas.addLocater(locater);
    return createECSchemaProvider(schemas);
  }

  private createProvider() {
    const imodelAccess =
      "iModel" in this.#props ? StatelessHierarchyProvider.createIModelAccess(this.#props.iModel, this.#props.rowLimit) : this.#props.imodelAccess;
    return createIModelHierarchyProvider({
      imodelAccess,
      hierarchyDefinition: this.#props.getHierarchyFactory(imodelAccess),
      queryCacheSize: this.#props.queryCacheSize ?? 0,
      filtering: this.#props.filtering,
    });
  }

  public static createIModelAccess(iModel: IModelDb, rowLimit?: number | "unbounded"): IModelAccess {
    const schemaProvider = this.createECSchemaProvider(iModel);
    const rowLimitToUse = rowLimit ?? DEFAULT_ROW_LIMIT;
    const imodelAccess = {
      imodelKey: iModel.key,
      ...schemaProvider,
      ...createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 1000 }),
      ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(iModel), rowLimitToUse),
    };
    return imodelAccess;
  }
}

function getNodeDepth(node: HierarchyNode): number {
  return node.parentKeys.length + 1;
}

class AsyncSchemaJsonLocater extends SchemaJsonLocater {
  #_getSchema: SchemaPropsGetter;
  public constructor(getSchema: SchemaPropsGetter) {
    super(getSchema);
    this.#_getSchema = getSchema;
  }
  public override async getSchema<T extends Schema>(
    schemaKey: Readonly<SchemaKey>,
    _matchType: SchemaMatchType,
    context: SchemaContext,
  ): Promise<T | undefined> {
    const schemaProps = this.#_getSchema(schemaKey.name);
    if (!schemaProps) {
      return undefined;
    }

    await BeDuration.wait(0);
    const schema = await Schema.fromJson(schemaProps, context);
    return schema as T;
  }
}

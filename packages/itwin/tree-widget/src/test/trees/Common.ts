/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { vi } from "vitest";
import { BeEvent } from "@itwin/core-bentley";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";

import type { QueryBinder, QueryOptions } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, ECSchemaProvider } from "@itwin/presentation-shared";
import type { TreeWidgetViewport } from "../../tree-widget-react/components/trees/common/TreeWidgetViewport.js";
import type { TreeWidgetTestingViewport } from "./TreeUtils.js";

type QueryHandler = (query: string, params?: QueryBinder, config?: QueryOptions) => any[] | Promise<any[]>;
type GetCategoryInfo = IModelConnection["categories"]["getCategoryInfo"];

export function createIModelMock(props: { queryHandler?: QueryHandler; getCategoryInfo?: GetCategoryInfo }) {
  return {
    isBriefcaseConnection: vi.fn(() => false),
    createQueryReader: vi.fn(async function* (query: string, params?: QueryBinder, config?: QueryOptions): AsyncIterableIterator<any> {
      const result = (await props.queryHandler?.(query, params, config)) ?? [];
      for (const item of result) {
        yield { ...item, toRow: () => item, toArray: () => Object.values(item) };
      }
    }),
    categories: {
      getCategoryInfo: props.getCategoryInfo,
    },
    onClose: new BeEvent(),
  } as unknown as IModelConnection;
}

export function createFakeViewport(
  props?: Partial<Omit<TreeWidgetViewport, "alwaysDrawn" | "neverDrawn">> & {
    neverDrawn?: Set<string>;
    alwaysDrawn?: Set<string>;
    queryHandler?: QueryHandler;
    getCategoryInfo?: GetCategoryInfo;
  },
): TreeWidgetTestingViewport & Disposable {
  let alwaysDrawn = props?.alwaysDrawn;
  let neverDrawn = props?.neverDrawn;

  const onAlwaysDrawnChanged = new BeEvent();
  const onNeverDrawnChanged = new BeEvent();
  const result: TreeWidgetTestingViewport & Disposable = {
    changeCategoryDisplay: vi.fn(),
    changeModelDisplay: vi.fn(),
    isAlwaysDrawnExclusive: false,
    onPerModelCategoriesOverridesChanged: new BeEvent(),
    onDisplayedCategoriesChanged: new BeEvent(),
    onDisplayStyleChanged: new BeEvent(),
    onDisplayedModelsChanged: new BeEvent(),
    onAlwaysDrawnChanged,
    onNeverDrawnChanged,
    changeSubCategoryDisplay: vi.fn(),
    clearPerModelCategoryOverrides: vi.fn(),
    getPerModelCategoryOverride: vi.fn(() => "none" as const),
    setPerModelCategoryOverride: vi.fn(),
    viewsCategory: vi.fn(() => true),
    viewsModel: vi.fn(() => true),
    viewsSubCategory: vi.fn(() => true),
    viewType: "3d",
    perModelCategoryOverrides: [],
    ...props,
    get alwaysDrawn() {
      return alwaysDrawn;
    },
    get neverDrawn() {
      return neverDrawn;
    },
    setAlwaysDrawn: vi.fn((x) => {
      alwaysDrawn = x.elementIds;
      onAlwaysDrawnChanged.raiseEvent(result);
    }),
    setNeverDrawn: vi.fn((x) => {
      neverDrawn = x.elementIds;
      onNeverDrawnChanged.raiseEvent(result);
    }),
    clearAlwaysDrawn: vi.fn(() => {
      if (alwaysDrawn?.size) {
        alwaysDrawn.clear();
        onAlwaysDrawnChanged.raiseEvent(result);
      }
    }),
    clearNeverDrawn: vi.fn(() => {
      if (neverDrawn?.size) {
        neverDrawn.clear();
        onNeverDrawnChanged.raiseEvent(result);
      }
    }),
    iModel: props?.iModel ?? createIModelMock({ queryHandler: props?.queryHandler, getCategoryInfo: props?.getCategoryInfo }),
    renderFrame: vi.fn(),
    [Symbol.dispose]() {
      this.iModel.onClose.raiseEvent(this.iModel);
    },
  };
  return result;
}

type IModelAccess = ECSchemaProvider &
  LimitingECSqlQueryExecutor &
  ECClassHierarchyInspector & {
    imodelKey: string;
  };

export function createIModelAccess(imodel: IModelConnection): IModelAccess {
  const schemas = new SchemaContext();
  schemas.addLocater(new ECSchemaRpcLocater(imodel.getRpcProps()));
  const schemaProvider = createECSchemaProvider(schemas);
  return {
    imodelKey: imodel.key,
    ...schemaProvider,
    ...createCachingECClassHierarchyInspector({ schemaProvider }),
    ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
  };
}

export async function collect<T>(items: AsyncIterableIterator<T>) {
  const result: T[] = [];
  for await (const item of items) {
    result.push(item);
  }
  return result;
}

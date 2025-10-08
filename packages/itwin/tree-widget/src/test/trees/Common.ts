/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import sinon from "sinon";
import { BeEvent } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";

import type { LimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, ECSchemaProvider } from "@itwin/presentation-shared";
import type { QueryBinder, QueryOptions } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "../../tree-widget-react/components/trees/common/TreeWidgetViewport.js";
import type { TreeWidgetTestingViewport } from "./TreeUtils.js";

type QueryHandler = (query: string, params?: QueryBinder, config?: QueryOptions) => any[] | Promise<any[]>;
type GetCategoryInfo = IModelConnection["categories"]["getCategoryInfo"];

export function createIModelMock(props: { queryHandler?: QueryHandler; getCategoryInfo?: GetCategoryInfo }) {
  return {
    isBriefcaseConnection: sinon.fake.returns(false),
    createQueryReader: sinon.fake(async function* (query: string, params?: QueryBinder, config?: QueryOptions): AsyncIterableIterator<any> {
      const result = (await props.queryHandler?.(query, params, config)) ?? [];
      for (const item of result) {
        yield { ...item, toRow: () => item, toArray: () => Object.values(item) };
      }
    }),
    categories: {
      getCategoryInfo: props.getCategoryInfo,
    },
  } as unknown as IModelConnection;
}

export function createFakeSinonViewport(
  props?: Partial<Omit<TreeWidgetViewport, "alwaysDrawn" | "neverDrawn">> & {
    neverDrawn?: Set<string>;
    alwaysDrawn?: Set<string>;
    queryHandler?: QueryHandler;
    getCategoryInfo?: GetCategoryInfo;
  },
): TreeWidgetTestingViewport {
  let alwaysDrawn = props?.alwaysDrawn;
  let neverDrawn = props?.neverDrawn;

  const onAlwaysDrawnChanged = new BeEvent();
  const onNeverDrawnChanged = new BeEvent();
  const result: TreeWidgetTestingViewport = {
    changeCategoryDisplay: sinon.fake(),
    changeModelDisplay: sinon.fake(),
    isAlwaysDrawnExclusive: false,
    onPerModelCategoriesOverridesChanged: new BeEvent(),
    onDisplayedCategoriesChanged: new BeEvent(),
    onDisplayStyleChanged: new BeEvent(),
    onDisplayedModelsChanged: new BeEvent(),
    onAlwaysDrawnChanged,
    onNeverDrawnChanged,
    changeSubCategoryDisplay: sinon.fake(),
    clearPerModelCategoryOverrides: sinon.fake(),
    getPerModelCategoryOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.None),
    setPerModelCategoryOverride: sinon.fake(),
    viewsCategory: sinon.fake.returns(true),
    viewsModel: sinon.fake.returns(true),
    viewsSubCategory: sinon.fake.returns(true),
    viewType: "spatial",
    perModelCategoryOverrides: [],
    ...props,
    get alwaysDrawn() {
      return alwaysDrawn;
    },
    get neverDrawn() {
      return neverDrawn;
    },
    setAlwaysDrawn: sinon.fake((x) => {
      alwaysDrawn = x.elementIds;
      onAlwaysDrawnChanged.raiseEvent(result);
    }),
    setNeverDrawn: sinon.fake((x) => {
      neverDrawn = x;
      onNeverDrawnChanged.raiseEvent(result);
    }),
    clearAlwaysDrawn: sinon.fake(() => {
      if (alwaysDrawn?.size) {
        alwaysDrawn.clear();
        onAlwaysDrawnChanged.raiseEvent(result);
      }
    }),
    clearNeverDrawn: sinon.fake(() => {
      if (neverDrawn?.size) {
        neverDrawn.clear();
        onNeverDrawnChanged.raiseEvent(result);
      }
    }),
    iModel: createIModelMock({ queryHandler: props?.queryHandler, getCategoryInfo: props?.getCategoryInfo }),
    renderFrame: sinon.fake,
    [Symbol.dispose]() {},
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

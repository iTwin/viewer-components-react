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
import type { IModelConnection, Viewport, ViewState } from "@itwin/core-frontend";

export function createIModelMock(queryHandler?: (query: string, params?: QueryBinder, config?: QueryOptions) => any[] | Promise<any[]>) {
  return {
    createQueryReader: sinon.fake(async function* (query: string, params?: QueryBinder, config?: QueryOptions): AsyncIterableIterator<any> {
      const result = (await queryHandler?.(query, params, config)) ?? [];
      for (const item of result) {
        yield { ...item, toRow: () => item, toArray: () => Object.values(item) };
      }
    }),
  } as unknown as IModelConnection;
}

export function createFakeSinonViewport(
  props?: Partial<Omit<Viewport, "view" | "perModelCategoryVisibility">> & {
    view?: Partial<Omit<ViewState, "isSpatialView">> & { isSpatialView?: () => boolean };
    perModelCategoryVisibility?: Partial<PerModelCategoryVisibility.Overrides>;
    queryHandler?: Parameters<typeof createIModelMock>[0];
  },
): Viewport {
  let alwaysDrawn = props?.alwaysDrawn;
  let neverDrawn = props?.neverDrawn;

  // Stubs are defined as partial to ensure that the overridden implementation is compatible with original interfaces
  const perModelCategoryVisibility: Partial<PerModelCategoryVisibility.Overrides> = {
    getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.None),
    setOverride: sinon.fake(),
    clearOverrides: sinon.fake(),
    ...props?.perModelCategoryVisibility,
  };

  const view: NonNullable<typeof props>["view"] = {
    isSpatialView: sinon.fake.returns(true),
    viewsCategory: sinon.fake.returns(true),
    viewsModel: sinon.fake.returns(true),
    is2d: sinon.fake.returns(false) as any,
    is3d: sinon.fake.returns(true) as any,
    ...props?.view,
  };

  const onAlwaysDrawnChanged = new BeEvent();
  const onNeverDrawnChanged = new BeEvent();

  const result: Partial<Viewport> = {
    addViewedModels: sinon.fake.resolves(undefined),
    changeCategoryDisplay: sinon.fake(),
    changeModelDisplay: sinon.fake.returns(true),
    isAlwaysDrawnExclusive: false,
    onViewedCategoriesPerModelChanged: new BeEvent(),
    onViewedCategoriesChanged: new BeEvent(),
    onDisplayStyleChanged: new BeEvent(),
    onViewedModelsChanged: new BeEvent(),
    onAlwaysDrawnChanged,
    onNeverDrawnChanged,
    ...props,
    get alwaysDrawn() {
      return alwaysDrawn;
    },
    get neverDrawn() {
      return neverDrawn;
    },
    setAlwaysDrawn: sinon.fake((x) => {
      alwaysDrawn = x;
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
    perModelCategoryVisibility: perModelCategoryVisibility as PerModelCategoryVisibility.Overrides,
    view: view as ViewState,
    iModel: createIModelMock(props?.queryHandler),
  };

  return result as Viewport;
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

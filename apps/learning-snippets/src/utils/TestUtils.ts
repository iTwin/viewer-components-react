/* eslint-disable @itwin/no-internal */
import { UiFramework } from "@itwin/appui-react";
import { EmptyLocalization } from "@itwin/core-common";
import { TreeWidget } from "@itwin/tree-widget-react";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { BeEvent } from "@itwin/core-bentley";

export class TestUtils {
  private static _initialized = false;

  public static async initialize() {
    if (TestUtils._initialized) {
      return;
    }

    await UiFramework.initialize(undefined);
    await TreeWidget.initialize(new EmptyLocalization());
    TestUtils._initialized = true;
  }

  public static terminate() {
    UiFramework.terminate();
    TreeWidget.terminate();
    TestUtils._initialized = false;
  }
}

export function getSchemaContext(imodel: IModelConnection) {
  const schemaLocater = new ECSchemaRpcLocater(imodel.getRpcProps());
  const schemaContext = new SchemaContext();
  schemaContext.addLocater(schemaLocater);
  return schemaContext;
}

export function getTestViewer(imodel: IModelConnection) {
  return {
    onViewedCategoriesPerModelChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedModelsChanged: new BeEvent<(vp: Viewport) => void>(),
    onAlwaysDrawnChanged: new BeEvent<() => void>(),
    onNeverDrawnChanged: new BeEvent<() => void>(),
    onIModelHierarchyChanged: new BeEvent<() => void>(),
    onDisplayStyleChanged: new BeEvent<() => void>(),
    view: { isSpatialView: () => true, is3d: () => true, is2d: () => false, viewsCategory: () => true, viewsModel: () => false },
    iModel: imodel,
  } as unknown as Viewport;
}

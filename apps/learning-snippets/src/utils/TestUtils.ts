/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { TreeWidget } from "@itwin/tree-widget-react";

import type { IModelConnection, Viewport } from "@itwin/core-frontend";
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
    view: { isSpatialView: () => true, is3d: () => true, is2d: () => false, viewsCategory: () => true, viewsModel: () => true },
    viewsModel: () => true,
    perModelCategoryVisibility: { getOverride: () => PerModelCategoryVisibility.Override.Show },
    iModel: imodel,
  } as unknown as Viewport;
}

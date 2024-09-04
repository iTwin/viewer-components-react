/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @itwin/no-internal */
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
// __PUBLISH_EXTRACT_START__ Presentation.TreeWidget.TreeWidgetInitializeImports
import { TreeWidget } from "@itwin/tree-widget-react";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_END__

import type { IModelConnection, Viewport } from "@itwin/core-frontend";
export class TestUtils {
  private static _initialized = false;

  public static async initialize() {
    if (TestUtils._initialized) {
      return;
    }

    await UiFramework.initialize();
    // __PUBLISH_EXTRACT_START__ Presentation.TreeWidget.TreeWidgetInitialize
    await TreeWidget.initialize(IModelApp.localization);
    // __PUBLISH_EXTRACT_END__
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

export function getTestViewer(imodel: IModelConnection, isSimple = false) {
  return {
    onViewedCategoriesPerModelChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
    onViewedModelsChanged: new BeEvent<(vp: Viewport) => void>(),
    onAlwaysDrawnChanged: new BeEvent<() => void>(),
    onNeverDrawnChanged: new BeEvent<() => void>(),
    onIModelHierarchyChanged: new BeEvent<() => void>(),
    onDisplayStyleChanged: new BeEvent<() => void>(),
    view: { isSpatialView: () => !isSimple, is3d: () => !isSimple, is2d: () => false, viewsCategory: () => !isSimple, viewsModel: () => !isSimple },
    viewsModel: () => !isSimple,
    perModelCategoryVisibility: { getOverride: () => PerModelCategoryVisibility.Override.Show },
    iModel: imodel,
  } as unknown as Viewport;
}

export function mockGetBoundingClientRect() {
  sinon.stub(window.Element.prototype, "getBoundingClientRect").returns({
    height: 20,
    width: 20,
    x: 0,
    y: 0,
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    toJSON: () => {},
  });
}

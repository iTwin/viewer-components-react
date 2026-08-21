/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { Root } from "@stratakit/mui";
import { render as rtlRender } from "@testing-library/react";

import type { PropsWithChildren, ReactElement } from "react";
import type { IModelConnection, ScreenViewport, Viewport } from "@itwin/core-frontend";
import type { RenderOptions, RenderResult } from "@testing-library/react";

/**
 * Wraps rendered tree components with the StrataKit MUI `Root` context that the tree widget components require.
 */
function TreeWidgetTestWrapper({ children }: PropsWithChildren<unknown>) {
  return <Root colorScheme="light">{children}</Root>;
}

/**
 * Custom `render` that always wraps the rendered UI with the StrataKit MUI `Root` context required by the tree
 * widget components. All other `@testing-library/react` utilities are re-exported below, so tests can import
 * everything (`render`, `waitFor`, `cleanup`, ...) from this module.
 */
function customRender(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">): RenderResult {
  return rtlRender(ui, { wrapper: TreeWidgetTestWrapper, ...options });
}

export * from "@testing-library/react";
export { customRender as render };

export class TreeWidgetTestUtils {
  private static _initialized = false;

  public static async initialize() {
    if (TreeWidgetTestUtils._initialized) {
      return;
    }

    await UiFramework.initialize();
    TreeWidgetTestUtils._initialized = true;
  }

  public static terminate() {
    UiFramework.terminate();
    TreeWidgetTestUtils._initialized = false;
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
  } as unknown as ScreenViewport;
}

export function mockGetBoundingClientRect() {
  beforeEach(() => {
    vi.spyOn(window.HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(800);
    vi.spyOn(window.HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);

    vi.spyOn(window.Element.prototype, "getBoundingClientRect").mockReturnValue({
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
  });
}

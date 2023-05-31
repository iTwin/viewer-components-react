/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import deepEqual from "deep-equal";
import * as moq from "typemoq";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { TreeWidget } from "../TreeWidget";

import type { IModelConnection, PerModelCategoryVisibility, Viewport, ViewState } from "@itwin/core-frontend";
import type { PresentationManager, RulesetVariablesManager } from "@itwin/presentation-frontend";
import type { VariableValue } from "@itwin/presentation-common";

export class TestUtils {
  private static _initialized = false;

  public static async initialize() {
    if (TestUtils._initialized)
      return;

    // eslint-disable-next-line deprecation/deprecation
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

/** typemoq matcher for deep equality */
export const deepEquals = <T>(expected: T) => {
  return moq.It.is((actual: T) => deepEqual(actual, expected));
};

export const mockPresentationManager = () => {
  const onRulesetVariableChanged = new BeEvent<(variableId: string, prevValue: VariableValue, currValue: VariableValue) => void>();
  const rulesetVariablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();
  rulesetVariablesManagerMock.setup((x) => x.onVariableChanged).returns(() => onRulesetVariableChanged);

  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  presentationManagerMock.setup((x) => x.vars(moq.It.isAny())).returns(() => rulesetVariablesManagerMock.object);

  return {
    rulesetVariablesManager: rulesetVariablesManagerMock,
    presentationManager: presentationManagerMock,
  };
};

export async function flushAsyncOperations() {
  return new Promise((resolve) => setTimeout(resolve));
}

interface ViewportMockProps {
  viewState?: ViewState;
  perModelCategoryVisibility?: PerModelCategoryVisibility.Overrides;
  onViewedCategoriesPerModelChanged?: BeEvent<(vp: Viewport) => void>;
  onViewedCategoriesChanged?: BeEvent<(vp: Viewport) => void>;
  onViewedModelsChanged?: BeEvent<(vp: Viewport) => void>;
  onAlwaysDrawnChanged?: BeEvent<() => void>;
  onNeverDrawnChanged?: BeEvent<() => void>;
  onDisplayStyleChanged?: BeEvent<(vp: Viewport) => void>;
  imodel?: IModelConnection;
}

export function mockViewport(props?: ViewportMockProps) {
  if (!props)
    props = {};
  if (!props.viewState)
    props.viewState = moq.Mock.ofType<ViewState>().object;
  if (!props.perModelCategoryVisibility)
    props.perModelCategoryVisibility = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>().object;
  if (!props.onViewedCategoriesPerModelChanged)
    props.onViewedCategoriesPerModelChanged = new BeEvent<(vp: Viewport) => void>();
  if (!props.onDisplayStyleChanged)
    props.onDisplayStyleChanged = new BeEvent<(vp: Viewport) => void>();
  if (!props.onViewedCategoriesChanged)
    props.onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
  if (!props.onViewedModelsChanged)
    props.onViewedModelsChanged = new BeEvent<(vp: Viewport) => void>();
  if (!props.onAlwaysDrawnChanged)
    props.onAlwaysDrawnChanged = new BeEvent<() => void>();
  if (!props.onNeverDrawnChanged)
    props.onNeverDrawnChanged = new BeEvent<() => void>();
  if (!props.imodel)
    props.imodel = moq.Mock.ofType<IModelConnection>().object;
  const vpMock = moq.Mock.ofType<Viewport>();
  vpMock.setup((x) => x.iModel).returns(() => props!.imodel!);
  vpMock.setup((x) => x.view).returns(() => props!.viewState!);
  vpMock.setup((x) => x.perModelCategoryVisibility).returns(() => props!.perModelCategoryVisibility!);
  vpMock.setup((x) => x.onViewedCategoriesPerModelChanged).returns(() => props!.onViewedCategoriesPerModelChanged!);
  vpMock.setup((x) => x.onDisplayStyleChanged).returns(() => props!.onDisplayStyleChanged!);
  vpMock.setup((x) => x.onViewedCategoriesChanged).returns(() => props!.onViewedCategoriesChanged!);
  vpMock.setup((x) => x.onViewedModelsChanged).returns(() => props!.onViewedModelsChanged!);
  vpMock.setup((x) => x.onAlwaysDrawnChanged).returns(() => props!.onAlwaysDrawnChanged!);
  vpMock.setup((x) => x.onNeverDrawnChanged).returns(() => props!.onNeverDrawnChanged!);
  return vpMock;
}

export function stubCancelAnimationFrame() {
  const originalCaf= global.cancelAnimationFrame;

  before(() => {
    Object.defineProperty(global, "cancelAnimationFrame", {
      writable: true,
      value: (handle: number) => {
        clearTimeout(handle);
      },
    });
  });

  after(() => {
    Object.defineProperty(global, "cancelAnimationFrame", {
      writable: true,
      value: originalCaf,
    });
  });
}

export function createResolvablePromise<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((resolvePromise) => {resolve = resolvePromise;});
  return { promise, resolve };
}

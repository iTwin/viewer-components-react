/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import deepEqual from "deep-equal";
import { createElement, Fragment, StrictMode } from "react";
import sinon from "sinon";
import * as moq from "typemoq";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { renderHook as renderHookRTL, render as renderRTL } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { TreeWidget } from "../TreeWidget";

import type { PropsWithChildren, ReactElement } from "react";
import type { RenderHookOptions, RenderHookResult, RenderOptions, RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { Viewport as CoreViewport, IModelConnection, ViewState } from "@itwin/core-frontend";
import type { IModelHierarchyChangeEventArgs, PresentationManager, RulesetManager, RulesetVariablesManager } from "@itwin/presentation-frontend";
import type { RegisteredRuleset, Ruleset, VariableValue } from "@itwin/presentation-common";
import type { Viewport } from "../components/trees/models-tree/internal/VisibilityStateHandler";
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

/** typemoq matcher for deep equality */
export function deepEquals<T>(expected: T) {
  return moq.It.is((actual: T) => deepEqual(actual, expected));
}

export function mockPresentationManager() {
  const onRulesetVariableChanged = new BeEvent<(variableId: string, prevValue: VariableValue, currValue: VariableValue) => void>();
  const rulesetVariablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();
  rulesetVariablesManagerMock.setup((x) => x.onVariableChanged).returns(() => onRulesetVariableChanged);

  const onRulesetModified = new BeEvent<(curr: RegisteredRuleset, prev: Ruleset) => void>();
  const rulesetsManagerMock = moq.Mock.ofType<RulesetManager>();
  rulesetsManagerMock.setup((x) => x.onRulesetModified).returns(() => onRulesetModified);

  const onIModelHierarchyChanged = new BeEvent<(args: IModelHierarchyChangeEventArgs) => void>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  presentationManagerMock.setup((x) => x.vars(moq.It.isAny())).returns(() => rulesetVariablesManagerMock.object);
  // eslint-disable-next-line @itwin/no-internal
  presentationManagerMock.setup((x) => x.onIModelHierarchyChanged).returns(() => onIModelHierarchyChanged);
  presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetsManagerMock.object);

  return {
    rulesetVariablesManager: rulesetVariablesManagerMock,
    presentationManager: presentationManagerMock,
    rulesetsManager: rulesetsManagerMock,
  };
}

export async function flushAsyncOperations() {
  return new Promise((resolve) => setTimeout(resolve));
}

interface ViewportMockProps {
  viewState?: ViewState;
  perModelCategoryVisibility?: PerModelCategoryVisibility.Overrides;
  onViewedCategoriesPerModelChanged?: BeEvent<(vp: CoreViewport) => void>;
  onViewedCategoriesChanged?: BeEvent<(vp: CoreViewport) => void>;
  onViewedModelsChanged?: BeEvent<(vp: CoreViewport) => void>;
  onAlwaysDrawnChanged?: BeEvent<() => void>;
  onNeverDrawnChanged?: BeEvent<() => void>;
  onDisplayStyleChanged?: BeEvent<(vp: CoreViewport) => void>;
  imodel?: IModelConnection;
}

export function mockViewport(props?: ViewportMockProps) {
  if (!props) {
    props = {};
  }
  if (!props.viewState) {
    props.viewState = moq.Mock.ofType<ViewState>().object;
  }
  if (!props.perModelCategoryVisibility) {
    props.perModelCategoryVisibility = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>().object;
  }
  if (!props.onViewedCategoriesPerModelChanged) {
    props.onViewedCategoriesPerModelChanged = new BeEvent<(vp: CoreViewport) => void>();
  }
  if (!props.onDisplayStyleChanged) {
    props.onDisplayStyleChanged = new BeEvent<(vp: CoreViewport) => void>();
  }
  if (!props.onViewedCategoriesChanged) {
    props.onViewedCategoriesChanged = new BeEvent<(vp: CoreViewport) => void>();
  }
  if (!props.onViewedModelsChanged) {
    props.onViewedModelsChanged = new BeEvent<(vp: CoreViewport) => void>();
  }
  if (!props.onAlwaysDrawnChanged) {
    props.onAlwaysDrawnChanged = new BeEvent<() => void>();
  }
  if (!props.onNeverDrawnChanged) {
    props.onNeverDrawnChanged = new BeEvent<() => void>();
  }
  if (!props.imodel) {
    props.imodel = moq.Mock.ofType<IModelConnection>().object;
  }
  const vpMock = moq.Mock.ofType<CoreViewport>();
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

export function createFakeSinonViewport(
  props?: Partial<Omit<Viewport, "view" | "perModelCategoryVisibility">> & {
    view?: Partial<ViewState>;
    perModelCategoryVisibility?: Partial<PerModelCategoryVisibility.Overrides>;
  },
): Viewport {
  return {
    alwaysDrawn: undefined,
    neverDrawn: undefined,
    setAlwaysDrawn: sinon.fake(),
    setNeverDrawn: sinon.fake(),
    addViewedModels: sinon.fake.resolves(undefined),
    changeCategoryDisplay: sinon.fake(),
    changeModelDisplay: sinon.fake.returns(true),
    isAlwaysDrawnExclusive: false,
    ...props,
    perModelCategoryVisibility: {
      getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.None),
      setOverride: sinon.fake(),
      ...props?.perModelCategoryVisibility,
    },
    view: {
      isSpatialView: sinon.fake.returns(true),
      viewsCategory: sinon.fake.returns(true),
      viewsModel: sinon.fake.returns(true),
      ...props?.view,
    },
  };
}

export function stubCancelAnimationFrame() {
  const originalCaf = global.cancelAnimationFrame;

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
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createWrapper(wrapper?: React.JSXElementConstructor<{ children: React.ReactElement }>, disableStrictMode?: boolean) {
  // if `DISABLE_STRICT_MODE` is set do not wrap components into `StrictMode` component
  const StrictModeWrapper = process.env.DISABLE_STRICT_MODE || disableStrictMode ? Fragment : StrictMode;

  return wrapper
    ? ({ children }: PropsWithChildren<unknown>) => <StrictModeWrapper>{createElement(wrapper, undefined, children)}</StrictModeWrapper>
    : StrictModeWrapper;
}

/**
 * Custom render function that wraps around `render` function from `@testing-library/react` and additionally
 * setup `userEvent` from `@testing-library/user-event`.
 *
 * It should be used when test need to do interactions with rendered components.
 */
function customRender(ui: ReactElement, options?: RenderOptions & { disableStrictMode?: boolean }): RenderResult & { user: UserEvent } {
  const wrapper = createWrapper(options?.wrapper, options?.disableStrictMode);
  return {
    ...renderRTL(ui, { ...options, wrapper }),
    user: userEvent.setup(),
  };
}

function customRenderHook<Result, Props>(
  render: (initialProps: Props) => Result,
  options?: RenderHookOptions<Props> & { disableStrictMode?: boolean },
): RenderHookResult<Result, Props> {
  const wrapper = createWrapper(options?.wrapper, options?.disableStrictMode);
  return renderHookRTL(render, { ...options, wrapper });
}

export * from "@testing-library/react";
export { customRender as render };
export { customRenderHook as renderHook };

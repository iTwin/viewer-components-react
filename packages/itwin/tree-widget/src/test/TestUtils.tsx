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
import { Descriptor } from "@itwin/presentation-common";
import { renderHook as renderHookRTL, render as renderRTL } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { TreeWidget } from "../TreeWidget";
import { createTestCategoryDescription, createTestSelectClassInfo } from "./trees/Common";

import type { IModelConnection, PerModelCategoryVisibility, Viewport, ViewState } from "@itwin/core-frontend";
import type { DescriptorSource, Field, RegisteredRuleset, Ruleset, VariableValue } from "@itwin/presentation-common";
import type { PropsWithChildren, ReactElement } from "react";
import type { RenderHookOptions, RenderHookResult, RenderOptions, RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { IModelHierarchyChangeEventArgs, PresentationManager, RulesetManager, RulesetVariablesManager } from "@itwin/presentation-frontend";
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
  onViewedCategoriesPerModelChanged?: BeEvent<(vp: Viewport) => void>;
  onViewedCategoriesChanged?: BeEvent<(vp: Viewport) => void>;
  onViewedModelsChanged?: BeEvent<(vp: Viewport) => void>;
  onAlwaysDrawnChanged?: BeEvent<() => void>;
  onNeverDrawnChanged?: BeEvent<() => void>;
  onDisplayStyleChanged?: BeEvent<(vp: Viewport) => void>;
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
    props.onViewedCategoriesPerModelChanged = new BeEvent<(vp: Viewport) => void>();
  }
  if (!props.onDisplayStyleChanged) {
    props.onDisplayStyleChanged = new BeEvent<(vp: Viewport) => void>();
  }
  if (!props.onViewedCategoriesChanged) {
    props.onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
  }
  if (!props.onViewedModelsChanged) {
    props.onViewedModelsChanged = new BeEvent<(vp: Viewport) => void>();
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

export function createTestContentDescriptor(props: Partial<DescriptorSource> & { fields: Field[] }) {
  return new Descriptor({
    connectionId: "",
    displayType: "",
    contentFlags: 0,
    selectClasses: [createTestSelectClassInfo()],
    categories: [createTestCategoryDescription()],
    ...props,
  });
}

export function stubDOMMatrix() {
  const domMatrix = global.DOMMatrix;

  before(() => {
    Object.defineProperty(global, "DOMMatrix", {
      writable: true,
      value: sinon.fake(() => ({ m41: 0, m42: 0 })),
    });
  });

  after(() => {
    Object.defineProperty(global, "DOMGlobal", {
      writable: true,
      value: domMatrix,
    });
  });
}

export async function* createAsyncIterator<T>(values: T[]): AsyncIterableIterator<T> {
  for (const value of values) {
    yield value;
  }
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

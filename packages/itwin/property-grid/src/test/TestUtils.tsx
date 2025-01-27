/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createElement, Fragment, StrictMode } from "react";
import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";
import { KeySet } from "@itwin/presentation-common";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";
import { renderHook as renderHookRTL, render as renderRTL } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import type { PropsWithChildren, ReactElement } from "react";
import type { RenderHookOptions, RenderHookResult, RenderOptions, RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import type { FavoritePropertiesManager, SelectionManager, SelectionScopesManager } from "@itwin/presentation-frontend";

export function createPropertyRecord(value: PropertyValue, description: Partial<PropertyDescription>) {
  const propertyDescription: PropertyDescription = {
    displayLabel: "Test Property",
    name: "test-prop",
    typename: "string",
    ...description,
  };
  return new PropertyRecord(value, propertyDescription);
}

export function stubSelectionManager() {
  const selectionManagerStub = {
    selectionChange: new SelectionChangeEvent(),
    getSelectionLevels: createFunctionStub<SelectionManager["getSelectionLevels"]>().returns([0]),
    getSelection: createFunctionStub<SelectionManager["getSelection"]>().returns(new KeySet()),
    replaceSelection: createFunctionStub<SelectionManager["replaceSelection"]>(),
    scopes: {
      computeSelection: createFunctionStub<SelectionScopesManager["computeSelection"]>().resolves(new KeySet()),
    },
  };

  sinon.stub(Presentation, "selection").get(() => selectionManagerStub);
  return selectionManagerStub;
}

export function stubFavoriteProperties() {
  const favoritePropertiesStub = {
    onFavoritesChanged: new BeEvent<() => void>(),
    hasAsync: createFunctionStub<FavoritePropertiesManager["hasAsync"]>().resolves(false),
    add: createFunctionStub<FavoritePropertiesManager["add"]>(),
    remove: createFunctionStub<FavoritePropertiesManager["remove"]>(),
  };

  sinon.stub(Presentation, "favoriteProperties").get(() => favoritePropertiesStub);

  return favoritePropertiesStub;
}

export function stubPresentation() {
  const presentationStub = {
    onIModelContentChanged: new BeEvent(),
    rulesets: () => ({
      onRulesetModified: new BeEvent(),
    }),
    vars: () => ({
      onVariableChanged: new BeEvent(),
    }),
  };

  sinon.stub(Presentation, "presentation").get(() => presentationStub);
  return presentationStub;
}

export function createFunctionStub<TFunc extends (...args: any) => any>() {
  return sinon.stub<Parameters<TFunc>, ReturnType<TFunc>>();
}

export function createResolvablePromise<T>() {
  let resolveFn: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    resolveFn = resolve;
  });
  return {
    promise,
    resolve: async (value: T) => {
      resolveFn(value);
      await new Promise((resolve) => setTimeout(resolve));
    },
  };
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

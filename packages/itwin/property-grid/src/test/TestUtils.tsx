/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createElement, Fragment, StrictMode } from "react";
import { vi } from "vitest";
import { PropertyRecord } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";
import { Presentation } from "@itwin/presentation-frontend";
import { Selectables } from "@itwin/unified-selection";
import { renderHook as renderHookRTL, render as renderRTL } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import type { PropsWithChildren, ReactElement } from "react";
import type { Mock, Mocked } from "vitest";
import type { PropertyDescription, PropertyValue } from "@itwin/appui-abstract";
import type { FavoritePropertiesManager, PresentationManager } from "@itwin/presentation-frontend";
import type { SelectionStorage, StorageSelectionChangesListener } from "@itwin/unified-selection";
import type { RenderHookOptions, RenderHookResult, RenderOptions, RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

export function createPropertyRecord(
  value: PropertyValue,
  description: Partial<PropertyDescription>,
  props?: Pick<PropertyRecord, "isMerged">,
): PropertyRecord {
  const propertyDescription: PropertyDescription = {
    displayLabel: "Test Property",
    name: "test-prop",
    typename: "string",
    ...description,
  };
  const record = new PropertyRecord(value, propertyDescription);
  if (props?.isMerged !== undefined) {
    record.isMerged = props.isMerged;
  }
  return record;
}

export function stubSelectionStorage(): Mocked<SelectionStorage> & { selectionChangeEvent: BeEvent<StorageSelectionChangesListener> } {
  return {
    addToSelection: vi.fn(),
    clearSelection: vi.fn(),
    clearStorage: vi.fn(),
    getSelectionLevels: vi.fn<SelectionStorage["getSelectionLevels"]>().mockReturnValue([0]),
    getSelection: vi.fn<SelectionStorage["getSelection"]>().mockReturnValue(Selectables.create([])),
    removeFromSelection: vi.fn(),
    replaceSelection: vi.fn(),
    selectionChangeEvent: new BeEvent<StorageSelectionChangesListener>(),
  };
}

export function stubFavoriteProperties() {
  const favoritePropertiesStub = {
    onFavoritesChanged: new BeEvent<() => void>(),
    hasAsync: createFunctionStub<FavoritePropertiesManager["hasAsync"]>().mockResolvedValue(false),
    add: createFunctionStub<FavoritePropertiesManager["add"]>(),
    remove: createFunctionStub<FavoritePropertiesManager["remove"]>(),
  };

  vi.spyOn(Presentation, "favoriteProperties", "get").mockReturnValue(favoritePropertiesStub as any);

  return favoritePropertiesStub;
}

export function stubPresentation(): {
  onIModelContentChanged: BeEvent<() => void>;
  getDisplayLabelDefinitionsIterator: Mock<PresentationManager["getDisplayLabelDefinitionsIterator"]>;
  rulesets: () => { onRulesetModified: BeEvent<() => void> };
  vars: () => { onVariableChanged: BeEvent<() => void> };
} {
  const presentationStub = {
    onIModelContentChanged: new BeEvent(),
    getDisplayLabelDefinitionsIterator: vi.fn<PresentationManager["getDisplayLabelDefinitionsIterator"]>().mockResolvedValue({
      items: (async function* () {})(),
      total: 0,
    }),
    rulesets: () => ({
      onRulesetModified: new BeEvent(),
    }),
    vars: () => ({
      onVariableChanged: new BeEvent(),
    }),
  };

  vi.spyOn(Presentation, "presentation", "get").mockReturnValue(presentationStub as any);
  return presentationStub;
}

export function createFunctionStub<TFunc extends (...args: any) => any>() {
  return vi.fn<TFunc>();
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

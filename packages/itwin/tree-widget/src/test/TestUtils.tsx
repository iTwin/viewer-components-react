/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { EmptyLocalization } from "@itwin/core-common";
import { renderHook as renderHookRTL, render as renderRTL } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { TreeWidget } from "../tree-widget-react/TreeWidget.js";

import type { ReactElement } from "react";
import type { RenderHookOptions, RenderHookResult, RenderOptions, RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

export class TestUtils {
  private static _initialized = false;

  public static async initialize() {
    if (TestUtils._initialized) {
      return;
    }

    await UiFramework.initialize();
    await TreeWidget.initialize(new EmptyLocalization());
    TestUtils._initialized = true;
  }

  public static terminate() {
    UiFramework.terminate();
    TreeWidget.terminate();
    TestUtils._initialized = false;
  }
}

export async function flushAsyncOperations() {
  return new Promise((resolve) => setTimeout(resolve));
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
  let reject: (error: any) => void = () => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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

/**
 * Custom render function that wraps around `render` function from `@testing-library/react` and additionally
 * setup `userEvent` from `@testing-library/user-event`.
 *
 * It should be used when test need to do interactions with rendered components.
 */
function customRender(ui: ReactElement, options?: RenderOptions): RenderResult & { user: UserEvent } {
  return {
    ...renderRTL(ui, options),
    user: userEvent.setup(),
  };
}

function customRenderHook<Result, Props>(render: (initialProps: Props) => Result, options?: RenderHookOptions<Props>): RenderHookResult<Result, Props> {
  return renderHookRTL(render, options);
}

export * from "@testing-library/react";
export { customRender as render };
export { customRenderHook as renderHook };

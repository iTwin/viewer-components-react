/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";

import type { Viewport } from "@itwin/core-frontend";

/** @internal */
export interface IVisibilityChangeEventListener extends Disposable {
  onVisibilityChange: BeEvent<() => void>;
  suppressChangeEvents(): void;
  resumeChangeEvents(): void;
}

/** @internal */
export class VisibilityChangeEventListener implements IVisibilityChangeEventListener {
  #onVisibilityChange: BeEvent<() => void>;
  #pendingVisibilityChange: undefined | ReturnType<typeof setTimeout>;
  #suppressChangeEvents = 0;
  #hasFiredDuringSuppress = true;
  #listeners: Array<() => void>;

  constructor(viewport: Viewport) {
    this.#onVisibilityChange = new BeEvent<() => void>();
    this.#listeners = [
      viewport.onViewedCategoriesPerModelChanged.addListener(() => {
        this.#hasFiredDuringSuppress = true;
        this.handleVisibilityChange();
      }),
      viewport.onViewedCategoriesChanged.addListener(() => {
        this.#hasFiredDuringSuppress = true;
        this.handleVisibilityChange();
      }),
      viewport.onViewedModelsChanged.addListener(() => {
        this.#hasFiredDuringSuppress = true;
        this.handleVisibilityChange();
      }),
      viewport.onAlwaysDrawnChanged.addListener(() => {
        this.#hasFiredDuringSuppress = true;
        this.handleVisibilityChange();
      }),
      viewport.onNeverDrawnChanged.addListener(() => {
        this.#hasFiredDuringSuppress = true;
        this.handleVisibilityChange();
      }),
    ];
  }

  public [Symbol.dispose]() {
    if (this.#pendingVisibilityChange) {
      clearTimeout(this.#pendingVisibilityChange);
      this.#pendingVisibilityChange = undefined;
    }
    this.#listeners.forEach((listener) => listener());
    this.#listeners.length = 0;
  }

  public get isVisibilityChangePending(): boolean {
    return this.#pendingVisibilityChange !== undefined;
  }

  private handleVisibilityChange() {
    if (this.#pendingVisibilityChange || this.#suppressChangeEvents > 0) {
      return;
    }
    this.#pendingVisibilityChange = setTimeout(() => {
      this.#onVisibilityChange.raiseEvent();
      this.#pendingVisibilityChange = undefined;
    }, 10);
  }

  public get onVisibilityChange() {
    return this.#onVisibilityChange;
  }

  public suppressChangeEvents() {
    this.#hasFiredDuringSuppress = false;
    ++this.#suppressChangeEvents;
  }

  public resumeChangeEvents() {
    --this.#suppressChangeEvents;
    if (this.#suppressChangeEvents === 0 && !this.#hasFiredDuringSuppress) {
      this.handleVisibilityChange();
    }
  }
}

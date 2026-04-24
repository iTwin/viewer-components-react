/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
class ResizeObserverMock {
  public constructor(_callback: ResizeObserverCallback) {}

  public observe(_target: Element): void {}

  public unobserve(_target: Element): void {}

  public disconnect(): void {}

  public takeRecords(): ResizeObserverEntry[] {
    return [];
  }
}

// @dnd-kit reads ResizeObserver during module evaluation, which jsdom does not provide.
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

beforeEach(() => {
  vi.stubGlobal("fetch", async () => Promise.resolve(new Response()));
});

afterEach(() => {
  vi.useRealTimers();
});
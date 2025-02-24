/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

beforeEach(() => {
  vi.stubGlobal("fetch", async () => Promise.resolve(new Response()));
});

afterEach(() => {
  vi.useRealTimers();
});
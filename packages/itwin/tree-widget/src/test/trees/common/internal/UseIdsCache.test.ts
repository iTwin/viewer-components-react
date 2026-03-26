/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BeEvent } from "@itwin/core-bentley";
import { useIdsCache } from "../../../../tree-widget-react/components/trees/common/internal/useTreeHooks/UseIdsCache.js";
import { act, renderHook } from "../../../TestUtils.js";

import type { BriefcaseConnection } from "@itwin/core-frontend";

describe("useIdsCache", () => {
  const cache = {};
  let createCacheSpy: ReturnType<typeof vi.fn<() => typeof cache>>;
  let imodel: BriefcaseConnection;
  beforeEach(() => {
    createCacheSpy = vi.fn<() => typeof cache>(() => cache);
    imodel = {
      key: "imodelKey",
      isBriefcaseConnection: () => true,
      txns: {
        onCommit: new BeEvent(),
        onCommitted: new BeEvent(),
        onChangesApplied: new BeEvent(),
      },
      onClose: new BeEvent(),
    } as unknown as BriefcaseConnection;
  });

  it("calls createCache when imodelKey differs", () => {
    const { result } = renderHook(useIdsCache);
    const cache1 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    const newIModel = { ...imodel, key: "newImodelKey" } as unknown as BriefcaseConnection;

    const cache2 = result.current.getCache({
      imodel: newIModel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    expect(createCacheSpy).toHaveBeenCalledTimes(2);
    expect(cache1).toBe(cache2);
  });

  it("calls createCache when cacheKey differs", () => {
    const { result } = renderHook(useIdsCache);
    const cache1 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });

    const cache2 = result.current.getCache({
      imodel,
      cacheKey: "newCacheKey",
      createCache: createCacheSpy,
    });
    expect(createCacheSpy).toHaveBeenCalledTimes(2);
    expect(cache1).toBe(cache2);
  });

  it("creates a new cache when new cache is requested", () => {
    const { result } = renderHook(useIdsCache);
    const cache1 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    const cache2: Disposable = {
      [Symbol.dispose]() {},
    };
    const createCacheSpy2 = vi.fn(() => cache2);
    const cache2Result = result.current.getCache({
      imodel,
      cacheKey: "newCacheKey",
      createCache: createCacheSpy2,
    });
    expect(createCacheSpy).toHaveBeenCalledOnce();
    expect(createCacheSpy2).toHaveBeenCalledOnce();
    expect(cache1).not.toBe(cache2Result);
  });

  it("calls createCache only once with the same imodel key and cacheKey", () => {
    const { result } = renderHook(useIdsCache);
    const cache1 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    const cache2: Disposable = {
      [Symbol.dispose]() {},
    };
    const createCacheSpy2 = vi.fn(() => cache2);
    const cache2Result = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy2,
    });
    expect(createCacheSpy).toHaveBeenCalledOnce();
    expect(cache1).toBe(cache2Result);
  });

  it("calls createCache after onClose event fires", () => {
    const { result } = renderHook(useIdsCache);
    let cache1 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    let cache2 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey2",
      createCache: createCacheSpy,
    });
    expect(createCacheSpy).toHaveBeenCalledTimes(2);
    expect(cache1).toBe(cache2);

    act(() => {
      imodel.onClose.raiseEvent(imodel);
    });

    cache1 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    cache2 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey2",
      createCache: createCacheSpy,
    });
    expect(createCacheSpy.mock.calls.length).toBe(4);
    expect(cache1).toBe(cache2);
  });

  it("calls createCache after onCommitted event fires", () => {
    const { result } = renderHook(useIdsCache);
    let cache1 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    let cache2 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey2",
      createCache: createCacheSpy,
    });
    expect(createCacheSpy).toHaveBeenCalledTimes(2);
    expect(cache1).toBe(cache2);

    act(() => {
      imodel.txns.onCommit.raiseEvent();
      imodel.txns.onCommitted.raiseEvent(false, 1);
    });

    cache1 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    cache2 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey2",
      createCache: createCacheSpy,
    });
    expect(createCacheSpy.mock.calls.length).toBe(4);
    expect(cache1).toBe(cache2);
  });

  it("calls createCache after onChangesApplied event fires", () => {
    const { result } = renderHook(useIdsCache);
    let cache1 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    let cache2 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey2",
      createCache: createCacheSpy,
    });
    expect(createCacheSpy).toHaveBeenCalledTimes(2);
    expect(cache1).toBe(cache2);
    act(() => {
      imodel.txns.onChangesApplied.raiseEvent();
    });

    cache1 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    cache2 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey2",
      createCache: createCacheSpy,
    });
    expect(createCacheSpy.mock.calls.length).toBe(4);
    expect(cache1).toBe(cache2);
  });

  it("does not call createCache after onCommit event fires", () => {
    const { result } = renderHook(useIdsCache);
    const cache1 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    imodel.txns.onCommit.raiseEvent();

    const cache2 = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy,
    });
    expect(createCacheSpy).to.be.calledOnce;
    expect(cache1).to.equal(cache2);
  });
});

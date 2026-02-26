/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { BeEvent } from "@itwin/core-bentley";
import { useIdsCache } from "../../../../tree-widget-react/components/trees/common/internal/useTreeHooks/UseIdsCache.js";
import { renderHook } from "../../../TestUtils.js";

import type { BriefcaseConnection } from "@itwin/core-frontend";

describe("useIdsCache", () => {
  let disposeSpy: sinon.SinonSpy;
  let cache: Disposable;
  let createCacheSpy: sinon.SinonSpy;
  let imodel: BriefcaseConnection;
  beforeEach(() => {
    disposeSpy = sinon.spy();
    cache = {
      [Symbol.dispose]: disposeSpy,
    };
    createCacheSpy = sinon.spy(() => cache);
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
    sinon.restore();
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
    expect(createCacheSpy).to.be.calledTwice;
    expect(cache1).to.equal(cache2);
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
    expect(createCacheSpy).to.be.calledTwice;
    expect(cache1).to.equal(cache2);
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
    const createCacheSpy2 = sinon.spy(() => cache2);
    const cache2Result = result.current.getCache({
      imodel,
      cacheKey: "newCacheKey",
      createCache: createCacheSpy2,
    });
    expect(createCacheSpy).to.be.calledOnce;
    expect(createCacheSpy2).to.be.calledOnce;
    expect(cache1).to.not.equal(cache2Result);
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
    const createCacheSpy2 = sinon.spy(() => cache2);
    const cache2Result = result.current.getCache({
      imodel,
      cacheKey: "cacheKey",
      createCache: createCacheSpy2,
    });
    expect(createCacheSpy).to.be.calledOnce;
    expect(cache1).to.equal(cache2Result);
  });

  it("disposes caches and calls createCache after onClose event fires", () => {
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
    expect(createCacheSpy).to.be.calledTwice;
    expect(cache1).to.equal(cache2);

    imodel.onClose.raiseEvent(imodel);
    expect(disposeSpy).to.be.calledTwice;

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
    expect(createCacheSpy.callCount).to.be.equal(4);
    expect(cache1).to.equal(cache2);
  });

  it("disposes caches and calls createCache after onCommitted event fires", () => {
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
    expect(createCacheSpy).to.be.calledTwice;
    expect(cache1).to.equal(cache2);

    imodel.txns.onCommit.raiseEvent();
    imodel.txns.onCommitted.raiseEvent(false, 1);
    expect(disposeSpy).to.be.calledTwice;

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
    expect(createCacheSpy.callCount).to.be.equal(4);
    expect(cache1).to.equal(cache2);
  });

  it("disposes caches and calls createCache after onChangesApplied event fires", () => {
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
    expect(createCacheSpy).to.be.calledTwice;
    expect(cache1).to.equal(cache2);

    imodel.txns.onChangesApplied.raiseEvent();
    expect(disposeSpy).to.be.calledTwice;

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
    expect(createCacheSpy.callCount).to.be.equal(4);
    expect(cache1).to.equal(cache2);
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
    expect(disposeSpy).to.not.be.called;
  });
});

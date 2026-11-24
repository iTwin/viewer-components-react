/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BeEvent } from "@itwin/core-bentley";
import { useIdsProvider } from "../../../../tree-widget-react/shared/internal/hooks/UseIdsProvider.js";
import { act, renderHook } from "../../../TestUtils.js";

import type { BriefcaseConnection } from "@itwin/core-frontend";

describe("useIdsProvider", () => {
  const idsProvider = {};
  let createIdsProviderSpy: ReturnType<typeof vi.fn<() => typeof idsProvider>>;
  let imodel: BriefcaseConnection;
  beforeEach(() => {
    createIdsProviderSpy = vi.fn<() => typeof idsProvider>(() => idsProvider);
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

  it("calls createIdsProvider when imodelKey differs", () => {
    const { result } = renderHook(useIdsProvider);
    const idsProvider1 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    const newIModel = { ...imodel, key: "newImodelKey" } as unknown as BriefcaseConnection;

    const idsProvider2 = result.current.getIdsProvider({
      imodel: newIModel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    expect(createIdsProviderSpy).toHaveBeenCalledTimes(2);
    expect(idsProvider1).toBe(idsProvider2);
  });

  it("calls createIdsProvider when idsProviderKey differs", () => {
    const { result } = renderHook(useIdsProvider);
    const idsProvider1 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });

    const idsProvider2 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "newIdsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    expect(createIdsProviderSpy).toHaveBeenCalledTimes(2);
    expect(idsProvider1).toBe(idsProvider2);
  });

  it("creates a new idsProvider when new idsProvider is requested", () => {
    const { result } = renderHook(useIdsProvider);
    const idsProvider1 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    const idsProvider2: Disposable = {
      [Symbol.dispose]() {},
    };
    const createIdsProviderSpy2 = vi.fn(() => idsProvider2);
    const idsProvider2Result = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "newIdsProviderKey",
      createIdsProvider: createIdsProviderSpy2,
    });
    expect(createIdsProviderSpy).toHaveBeenCalledOnce();
    expect(createIdsProviderSpy2).toHaveBeenCalledOnce();
    expect(idsProvider1).not.toBe(idsProvider2Result);
  });

  it("calls createIdsProvider only once with the same imodel key and idsProviderKey", () => {
    const { result } = renderHook(useIdsProvider);
    const idsProvider1 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    const idsProvider2: Disposable = {
      [Symbol.dispose]() {},
    };
    const createIdsProviderSpy2 = vi.fn(() => idsProvider2);
    const idsProvider2Result = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy2,
    });
    expect(createIdsProviderSpy).toHaveBeenCalledOnce();
    expect(idsProvider1).toBe(idsProvider2Result);
  });

  it("calls createIdsProvider after onClose event fires", () => {
    const { result } = renderHook(useIdsProvider);
    let idsProvider1 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    let idsProvider2 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey2",
      createIdsProvider: createIdsProviderSpy,
    });
    expect(createIdsProviderSpy).toHaveBeenCalledTimes(2);
    expect(idsProvider1).toBe(idsProvider2);

    act(() => {
      imodel.onClose.raiseEvent(imodel);
    });

    idsProvider1 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    idsProvider2 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey2",
      createIdsProvider: createIdsProviderSpy,
    });
    expect(createIdsProviderSpy.mock.calls.length).toBe(4);
    expect(idsProvider1).toBe(idsProvider2);
  });

  it("calls createIdsProvider after onCommitted event fires", () => {
    const { result } = renderHook(useIdsProvider);
    let idsProvider1 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    let idsProvider2 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey2",
      createIdsProvider: createIdsProviderSpy,
    });
    expect(createIdsProviderSpy).toHaveBeenCalledTimes(2);
    expect(idsProvider1).toBe(idsProvider2);

    act(() => {
      imodel.txns.onCommit.raiseEvent();
      imodel.txns.onCommitted.raiseEvent(false, 1);
    });

    idsProvider1 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    idsProvider2 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey2",
      createIdsProvider: createIdsProviderSpy,
    });
    expect(createIdsProviderSpy.mock.calls.length).toBe(4);
    expect(idsProvider1).toBe(idsProvider2);
  });

  it("calls createIdsProvider after onChangesApplied event fires", () => {
    const { result } = renderHook(useIdsProvider);
    let idsProvider1 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    let idsProvider2 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey2",
      createIdsProvider: createIdsProviderSpy,
    });
    expect(createIdsProviderSpy).toHaveBeenCalledTimes(2);
    expect(idsProvider1).toBe(idsProvider2);
    act(() => {
      imodel.txns.onChangesApplied.raiseEvent();
    });

    idsProvider1 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    idsProvider2 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey2",
      createIdsProvider: createIdsProviderSpy,
    });
    expect(createIdsProviderSpy.mock.calls.length).toBe(4);
    expect(idsProvider1).toBe(idsProvider2);
  });

  it("does not call createIdsProvider after onCommit event fires", () => {
    const { result } = renderHook(useIdsProvider);
    const idsProvider1 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    imodel.txns.onCommit.raiseEvent();

    const idsProvider2 = result.current.getIdsProvider({
      imodel,
      idsProviderKey: "idsProviderKey",
      createIdsProvider: createIdsProviderSpy,
    });
    expect(createIdsProviderSpy).toHaveBeenCalledOnce();
    expect(idsProvider1).toBe(idsProvider2);
  });
});

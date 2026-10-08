/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { QuantityFormatting } from "../QuantityFormatting.js";

describe("QuantityFormatting", () => {
  // The shared test setup starts QuantityFormatting; restore that state after each test.
  afterEach(async () => {
    QuantityFormatting.terminate();
    await QuantityFormatting.startup({ localization: new EmptyLocalization() });
  });

  it("registers the namespace once for concurrent startup calls", async () => {
    QuantityFormatting.terminate();
    const localization = new EmptyLocalization();
    const registerNamespace = vi.spyOn(localization, "registerNamespace");

    await Promise.all([QuantityFormatting.startup({ localization }), QuantityFormatting.startup({ localization })]);

    expect(registerNamespace).toHaveBeenCalledTimes(1);
    expect(QuantityFormatting.isInitialized).toBe(true);
  });

  it("throws a descriptive error when localization is read before startup", () => {
    QuantityFormatting.terminate();
    expect(() => QuantityFormatting.localization).toThrow(/QuantityFormatting\.startup\(\)/);
  });

  it("allows startup to be retried after a failure", async () => {
    QuantityFormatting.terminate();
    const localization = new EmptyLocalization();
    vi.spyOn(localization, "registerNamespace").mockRejectedValueOnce(new Error("load failed"));

    await expect(QuantityFormatting.startup({ localization })).rejects.toThrow("load failed");
    expect(QuantityFormatting.isInitialized).toBe(false);
    await QuantityFormatting.startup({ localization });
    expect(QuantityFormatting.isInitialized).toBe(true);
  });

  it("ignores a startup that completes after terminate", async () => {
    QuantityFormatting.terminate();
    const stale = new EmptyLocalization();
    let rejectStale!: (error: Error) => void;
    vi.spyOn(stale, "registerNamespace").mockReturnValueOnce(new Promise<void>((_resolve, reject) => (rejectStale = reject)));
    const staleStartup = QuantityFormatting.startup({ localization: stale });

    QuantityFormatting.terminate();
    const current = new EmptyLocalization();
    await QuantityFormatting.startup({ localization: current });

    rejectStale(new Error("stale failure"));
    await expect(staleStartup).rejects.toThrow("stale failure");
    expect(QuantityFormatting.isInitialized).toBe(true);
    expect(QuantityFormatting.localization).toBe(current);
  });

  it("unregisters a namespace whose registration completes after terminate", async () => {
    QuantityFormatting.terminate();
    const stale = new EmptyLocalization();
    let resolveStale!: () => void;
    vi.spyOn(stale, "registerNamespace").mockReturnValueOnce(new Promise<void>((resolve) => (resolveStale = resolve)));
    const unregister = vi.spyOn(stale, "unregisterNamespace");
    const staleStartup = QuantityFormatting.startup({ localization: stale });

    QuantityFormatting.terminate();
    resolveStale();
    await staleStartup;

    expect(unregister).toHaveBeenCalledWith("QuantityFormat");
    expect(QuantityFormatting.isInitialized).toBe(false);
  });

  it("keeps the namespace when a newer startup reuses the same localization", async () => {
    QuantityFormatting.terminate();
    const localization = new EmptyLocalization();
    let resolveFirst!: () => void;
    vi.spyOn(localization, "registerNamespace").mockReturnValueOnce(new Promise<void>((resolve) => (resolveFirst = resolve)));
    const unregister = vi.spyOn(localization, "unregisterNamespace");
    const firstStartup = QuantityFormatting.startup({ localization });

    QuantityFormatting.terminate();
    await QuantityFormatting.startup({ localization });
    resolveFirst();
    await firstStartup;

    expect(unregister).not.toHaveBeenCalled();
    expect(QuantityFormatting.isInitialized).toBe(true);
  });
});

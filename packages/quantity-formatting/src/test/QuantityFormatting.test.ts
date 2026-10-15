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
});

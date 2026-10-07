/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { IModelApp } from "@itwin/core-frontend";
import { BasicUnitsProvider } from "@itwin/core-quantity";
import type { UnitsProvider } from "@itwin/core-quantity";
import { useUnitsProvider } from "../../../components/quantityformat/internal/useUnitsProvider.js";

describe("useUnitsProvider", () => {
  let original: UnitsProvider;

  beforeAll(() => {
    original = IModelApp.quantityFormatter.unitsProvider;
  });

  afterEach(async () => {
    await IModelApp.quantityFormatter.setUnitsProvider(original);
  });

  it("defaults to the quantity formatter's units provider", () => {
    const { result } = renderHook(() => useUnitsProvider());
    expect(result.current).toBe(original);
  });

  it("follows the quantity formatter when the app replaces its units provider", async () => {
    const { result } = renderHook(() => useUnitsProvider());
    const replacement = new BasicUnitsProvider();

    await act(async () => IModelApp.quantityFormatter.setUnitsProvider(replacement));

    expect(result.current).toBe(replacement);
  });

  it("prefers an explicit units provider", async () => {
    const explicit = new BasicUnitsProvider();
    const { result } = renderHook(() => useUnitsProvider(explicit));

    await act(async () => IModelApp.quantityFormatter.setUnitsProvider(new BasicUnitsProvider()));

    expect(result.current).toBe(explicit);
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { FormatSetFormatsProvider } from "@itwin/ecschema-metadata";
import { useFormatSet } from "../../components/quantityformat/useFormatSet.js";

import type { FormatDefinition } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";

const length: FormatDefinition = { type: "decimal", precision: 2, label: "Length" };

function createFormatSet(): FormatSet {
  return { name: "Set", label: "Set", unitSystem: "metric", formats: { length } };
}

describe("useFormatSet", () => {
  it("returns a copy with the same formats", () => {
    const formatSet = createFormatSet();
    const { result } = renderHook(() => useFormatSet(formatSet, undefined));
    expect(result.current).not.toBe(formatSet);
    expect(result.current).toEqual(formatSet);
  });

  it("returns the same copy across renders while nothing changes", () => {
    const formatSet = createFormatSet();
    const provider = new FormatSetFormatsProvider({ formatSet });
    const { result, rerender } = renderHook(() => useFormatSet(formatSet, provider));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("returns a new copy with the latest formats after the provider updates its format set", async () => {
    const formatSet = createFormatSet();
    const provider = new FormatSetFormatsProvider({ formatSet });
    const { result } = renderHook(() => useFormatSet(formatSet, provider));
    const before = result.current;

    const updated: FormatDefinition = { ...length, decimalSeparator: "," };
    await act(async () => provider.addFormat("length", updated));

    expect(result.current).not.toBe(before);
    expect(result.current?.formats.length).toEqual(updated);
    expect(before?.formats.length).toEqual(length);
  });

  it("keeps the old formats when given an object other than the provider's format set", async () => {
    const formatSet = createFormatSet();
    const provider = new FormatSetFormatsProvider({ formatSet });
    const copy = { ...formatSet, formats: { ...formatSet.formats } };
    const { result } = renderHook(() => useFormatSet(copy, provider));

    await act(async () => provider.addFormat("length", { ...length, decimalSeparator: "," }));

    expect(result.current?.formats.length).toEqual(length);
  });

  it("follows a different format set", () => {
    const first = createFormatSet();
    const second = { ...createFormatSet(), name: "Other" };
    const { result, rerender } = renderHook(({ formatSet }) => useFormatSet(formatSet, undefined), { initialProps: { formatSet: first } });
    rerender({ formatSet: second });
    expect(result.current?.name).toBe("Other");
  });

  it("returns undefined without a format set", () => {
    const { result } = renderHook(() => useFormatSet(undefined, undefined));
    expect(result.current).toBeUndefined();
  });
});

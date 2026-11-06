/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FractionDash } from "../../../components/quantityformat/internal/FractionDash.js";
import { KeepDecimalPoint } from "../../../components/quantityformat/internal/KeepDecimalPoint.js";
import { KeepSingleZero } from "../../../components/quantityformat/internal/KeepSingleZero.js";
import { ShowTrailingZeros } from "../../../components/quantityformat/internal/ShowTrailingZeros.js";
import { UseThousandsSeparator } from "../../../components/quantityformat/internal/ThousandsSeparator.js";
import { ZeroEmpty } from "../../../components/quantityformat/internal/ZeroEmpty.js";

import type { FormatProps } from "@itwin/core-quantity";

type TraitCheckbox = (props: { formatProps: FormatProps; onChange: (formatProps: FormatProps) => void }) => React.ReactNode;

// Format.toJSON writes PascalCase trait names, while these editors write lowerCamel ones.
const cases: Array<[string, TraitCheckbox, string]> = [
  ["FractionDash", FractionDash, "FractionDash"],
  ["KeepDecimalPoint", KeepDecimalPoint, "KeepDecimalPoint"],
  ["KeepSingleZero", KeepSingleZero, "KeepSingleZero"],
  ["ShowTrailingZeros", ShowTrailingZeros, "TrailZeroes"],
  ["UseThousandsSeparator", UseThousandsSeparator, "Use1000Separator"],
  ["ZeroEmpty", ZeroEmpty, "ZeroEmpty"],
];

describe.each(cases)("%s", (_name, Component, pascalTrait) => {
  const formatProps: FormatProps = { type: "decimal", precision: 2, formatTraits: [pascalTrait, "ApplyRounding"] };

  it("shows a PascalCase trait as checked", () => {
    render(<Component formatProps={formatProps} onChange={vi.fn()} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("clears a PascalCase trait without touching other traits", () => {
    const onChange = vi.fn();
    render(<Component formatProps={formatProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ formatTraits: ["ApplyRounding"] }));
  });
});

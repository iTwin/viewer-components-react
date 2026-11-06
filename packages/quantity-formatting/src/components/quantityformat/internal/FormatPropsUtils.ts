/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Format, getTraitString } from "@itwin/core-quantity";

import type { FormatProps, FormatTraits } from "@itwin/core-quantity";

function getTraitEntries(formatProps: FormatProps): string[] {
  const { formatTraits } = formatProps;
  if (!formatTraits) return [];
  return Array.isArray(formatTraits) ? formatTraits : formatTraits.split(/,|;|\|/);
}

function isSameTrait(entry: string, trait: FormatTraits): boolean {
  return entry.toLowerCase() === getTraitString(trait).toLowerCase();
}

/**
 * Returns true if the trait is present in `formatProps.formatTraits`.
 * Trait names are matched case-insensitively, the same way `Format.fromJSON` parses them, so persisted
 * spellings such as `ShowUnitLabel` and `showUnitLabel` are both recognized.
 * @internal
 */
export function isFormatTraitSet(formatProps: FormatProps, trait: FormatTraits): boolean {
  return getTraitEntries(formatProps).some((entry) => isSameTrait(entry, trait));
}

/**
 * Returns new format props with the trait set or cleared. Every spelling of the trait is removed before the
 * trait is added back once, so toggling never leaves duplicate or stale casing variants behind.
 * Other entries keep their spelling and order.
 * @internal
 */
export function setFormatTrait<T extends FormatProps>(formatProps: T, trait: FormatTraits, setActive: boolean): T {
  const formatTraits = getTraitEntries(formatProps).filter((entry) => !isSameTrait(entry, trait));
  if (setActive) formatTraits.push(getTraitString(trait));
  return { ...formatProps, formatTraits };
}

/** Decimal separator the formatter uses for these props; core falls back to the locale default when unset.
 * @internal
 */
export function getDecimalSeparator(formatProps: FormatProps): string {
  return formatProps.decimalSeparator ?? new Format("").decimalSeparator;
}

/** Thousands separator the formatter uses for these props; core falls back to the locale default when unset.
 * @internal
 */
export function getThousandSeparator(formatProps: FormatProps): string {
  return formatProps.thousandSeparator ?? new Format("").thousandSeparator;
}

/**
 * Returns format props whose effective decimal and thousands separators differ. Only call this while the
 * Use1000Separator trait is active; otherwise the thousands separator is unused and should be left alone.
 * When the separators collide, the one named by `keep` wins and the other is switched between "." and ",".
 * Empty separators never collide: an empty thousands separator disables grouping.
 * @internal
 */
export function resolveSeparatorConflict<T extends FormatProps>(formatProps: T, keep: "decimalSeparator" | "thousandSeparator"): T {
  const decimalSeparator = getDecimalSeparator(formatProps);
  if (decimalSeparator === "" || decimalSeparator !== getThousandSeparator(formatProps)) return formatProps;

  const replacement = decimalSeparator === "," ? "." : ",";
  return keep === "decimalSeparator"
    ? { ...formatProps, thousandSeparator: replacement }
    : { ...formatProps, decimalSeparator: replacement };
}

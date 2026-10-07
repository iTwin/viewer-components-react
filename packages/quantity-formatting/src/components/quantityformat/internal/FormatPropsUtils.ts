/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { getTraitString } from "@itwin/core-quantity";

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

/**
 * Returns format props whose decimal and thousands separators differ. When they collide, the separator named by
 * `keep` wins and the other one is switched between "." and ",". Unset separators are treated as the editor
 * defaults: "." for decimal and "," for thousands.
 * @internal
 */
export function resolveSeparatorConflict<T extends FormatProps>(formatProps: T, keep: "decimalSeparator" | "thousandSeparator"): T {
  const decimalSeparator = formatProps.decimalSeparator ?? ".";
  const thousandSeparator = formatProps.thousandSeparator ?? ",";
  if (decimalSeparator !== thousandSeparator) return formatProps;

  const replacement = decimalSeparator === "," ? "." : ",";
  return keep === "decimalSeparator"
    ? { ...formatProps, thousandSeparator: replacement }
    : { ...formatProps, decimalSeparator: replacement };
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { TreeWidget } from "../../../../TreeWidget.js";

import type { VisibilityStatus } from "../UseHierarchyVisibility.js";

/** @internal */
export type Visibility = "visible" | "hidden" | "partial";

/** @internal */
export type NonPartialVisibilityStatus = Omit<VisibilityStatus, "state"> & { state: "visible" | "hidden" };

interface VisibilityStatusOptions {
  // id of localized string to use as an additional tooltip or false to not use tooltip at all
  // if undefined tooltip will be created based only on the visibility status
  useTooltip?: string | false;
}

/** @internal */
export function createVisibilityStatus(
  status: "visible" | "hidden",
  options?: VisibilityStatusOptions,
): NonPartialVisibilityStatus & { tooltipStringId: string | undefined };
export function createVisibilityStatus(
  status: "visible" | "hidden" | "partial" | "disabled",
  options?: VisibilityStatusOptions,
): VisibilityStatus & { tooltipStringId: string | undefined };
export function createVisibilityStatus(
  status: Visibility | "disabled",
  { useTooltip }: VisibilityStatusOptions = {},
): VisibilityStatus & { tooltipStringId: string | undefined } {
  return {
    state: status === "disabled" ? "hidden" : status,
    isDisabled: status === "disabled",
    tooltip: useTooltip === false ? undefined : createTooltip(status, useTooltip),
    tooltipStringId: typeof useTooltip === "string" ? useTooltip : undefined,
  };
}

/** @internal */
export function createTooltip(status: Visibility | "disabled", tooltipStringId: string | undefined): string {
  const statusStringId = `visibilityTooltips.status.${status}`;
  const statusString = TreeWidget.translate(statusStringId);
  if (!tooltipStringId) {
    return statusString;
  }

  tooltipStringId = `visibilityTooltips.${tooltipStringId}`;
  const tooltipString = TreeWidget.translate(tooltipStringId);
  return `${statusString}: ${tooltipString}`;
}

/** @internal */
export function getTooltipOptions(key: string | undefined, ignoreTooltip?: boolean) {
  return {
    useTooltip: ignoreTooltip ? (false as const) : key,
  };
}

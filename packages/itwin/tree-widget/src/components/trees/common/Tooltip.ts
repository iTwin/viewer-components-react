/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { TreeWidget } from "../../../TreeWidget";

import type { VisibilityStatus } from "./UseHierarchyVisibility";

/** @internal */
export type Visibility = "visible" | "hidden" | "partial";

/** @internal */
export type NonPartialVisibilityStatus = Omit<VisibilityStatus, "state"> & { state: "visible" | "hidden" };

interface VisibilityStatusOptions {
  tooltipStringId?: string;
  ignoreTooltip?: boolean;
}

/** @internal */
export function createVisibilityStatus(status: "visible" | "hidden", options?: VisibilityStatusOptions): NonPartialVisibilityStatus;
export function createVisibilityStatus(status: "visible" | "hidden" | "partial" | "disabled", options?: VisibilityStatusOptions): VisibilityStatus;
export function createVisibilityStatus(status: Visibility | "disabled", { ignoreTooltip, tooltipStringId }: VisibilityStatusOptions = {}): VisibilityStatus {
  return {
    state: status === "disabled" ? "hidden" : status,
    isDisabled: status === "disabled",
    tooltip: ignoreTooltip ? undefined : createTooltip(status, tooltipStringId),
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

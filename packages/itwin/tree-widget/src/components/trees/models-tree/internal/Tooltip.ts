/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { TreeWidget } from "../../../../TreeWidget";

import type { VisibilityStatus } from "../../VisibilityTreeEventHandler";


/** @internal */
export type Visibility = "visible" | "hidden" | "partial";

/** @internal */
export function createVisibilityStatus(status: Visibility | "disabled", tooltipStringId?: string): VisibilityStatus {
  return {
    state: status === "disabled" ? "hidden" : status,
    isDisabled: status === "disabled",
    tooltip: createTooltip(status, tooltipStringId),
  };
}

/** @internal */
export function createTooltip(status: Visibility | "disabled", tooltipStringId: string | undefined): string {
  const statusStringId = `modelTree.status.${status}`;
  const statusString = TreeWidget.translate(statusStringId);
  if (!tooltipStringId) {
    return statusString;
  }

  tooltipStringId = `modelTree.tooltips.${tooltipStringId}`;
  const tooltipString = TreeWidget.translate(tooltipStringId);
  return `${statusString}: ${tooltipString}`;
}

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

/** @internal */
export function createVisibilityStatus(status: "visible" | "hidden"): NonPartialVisibilityStatus;
export function createVisibilityStatus(status: "visible" | "hidden" | "partial" | "disabled"): VisibilityStatus;
export function createVisibilityStatus(status: Visibility | "disabled"): VisibilityStatus {
  return {
    state: status === "disabled" ? "hidden" : status,
    isDisabled: status === "disabled",
  };
}

/** @internal */
export function createTooltip(status: Visibility | "disabled" | "determining"): string {
  const statusStringId = `visibilityTooltips.status.${status}`;
  const statusString = TreeWidget.translate(statusStringId);
  return statusString;
}

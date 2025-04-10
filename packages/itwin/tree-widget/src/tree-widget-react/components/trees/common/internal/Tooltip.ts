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
  // if undefined or true tooltip will be created based only on the visibility status
  useTooltip?: boolean;
}

/** @internal */
export function createVisibilityStatus(status: "visible" | "hidden", options?: VisibilityStatusOptions): NonPartialVisibilityStatus;
export function createVisibilityStatus(status: "visible" | "hidden" | "partial" | "disabled", options?: VisibilityStatusOptions): VisibilityStatus;
export function createVisibilityStatus(status: Visibility | "disabled", { useTooltip }: VisibilityStatusOptions = {}): VisibilityStatus {
  return {
    state: status === "disabled" ? "hidden" : status,
    isDisabled: status === "disabled",
    tooltip: useTooltip === false ? undefined : createTooltip(status),
  };
}

/** @internal */
export function createTooltip(status: Visibility | "disabled"): string {
  const statusStringId = `visibilityTooltips.status.${status}`;
  const statusString = TreeWidget.translate(statusStringId);
  return statusString;
}

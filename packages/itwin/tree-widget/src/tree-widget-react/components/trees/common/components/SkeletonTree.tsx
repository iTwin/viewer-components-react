/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./SkeletonTree.css";
import { Skeleton, VisuallyHidden } from "@stratakit/bricks";
import { TreeWidget } from "../../../../TreeWidget.js";

/**
 * Represents the loaded tree content before it finishes loading.
 * @beta
 */
export function SkeletonTree() {
  return (
    <div className="tw-skeleton-container">
      {Array.from({ length: 20 }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
      <VisuallyHidden id={"tw-progress-bar"}>{TreeWidget.translate("loading.skeleton")}</VisuallyHidden>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="tw-skeleton-row">
      <Skeleton variant={"object"} size={"small"} />
      <Skeleton variant={"text"} />
    </div>
  );
}

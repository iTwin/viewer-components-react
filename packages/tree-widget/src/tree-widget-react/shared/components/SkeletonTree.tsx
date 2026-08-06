/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./SkeletonTree.css";

import { Skeleton } from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import { useTranslation } from "./LocalizationContext.js";

/**
 * Represents the loaded tree content before it finishes loading.
 * @beta
 */
export function SkeletonTree() {
  const translate = useTranslation();
  return (
    <div className="tw-skeleton-container" role="status">
      {Array.from({ length: 20 }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
      <span id={"tw-progress-bar"} style={visuallyHidden}>
        {translate("loading.skeleton")}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="tw-skeleton-row">
      <Skeleton variant={"rounded"} width={20} height={20} />
      <Skeleton variant={"rounded"} style={{ flex: 1 }} />
    </div>
  );
}

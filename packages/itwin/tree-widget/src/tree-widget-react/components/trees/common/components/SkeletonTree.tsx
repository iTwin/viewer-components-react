/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./SkeletonTree.css";

import { Skeleton } from "@mui/material";

/**
 * Represents the loaded tree content before it finishes loading.
 * @beta
 */
export function SkeletonTree() {
  return (
    <div className="tw-skeleton-container" role="status">
      {Array.from({ length: 20 }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
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

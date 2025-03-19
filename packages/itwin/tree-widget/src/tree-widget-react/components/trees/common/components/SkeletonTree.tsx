/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./SkeletonTree.css";
import { Skeleton } from "@itwin/itwinui-react/bricks";

/** @internal */
export function SkeletonTree() {
  return (
    <>
      {Array.from({ length: 20 }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </>
  );
}

function SkeletonRow() {
  return (
    <div className="tw-skeleton-row">
      <Skeleton className={"tw-skeleton-icon"} variant={"text"} />
      <Skeleton className={"tw-skeleton-label"} variant={"text"} />
    </div>
  );
}

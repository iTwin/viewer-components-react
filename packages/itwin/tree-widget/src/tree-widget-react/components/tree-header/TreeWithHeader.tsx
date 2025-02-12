/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeWithHeader.scss";
import { TreeHeader } from "./TreeHeader.js";

import type { PropsWithChildren, ReactNode } from "react";

/** @beta */
interface TreeWithHeaderProps {
  buttons?: ReactNode;
}

/** @beta */
export function TreeWithHeader({ buttons, children }: PropsWithChildren<TreeWithHeaderProps>) {
  return (
    <div className={"tw-tree-with-header"}>
      <TreeHeader>{buttons}</TreeHeader>
      <div className="tw-tree-content">{children}</div>
    </div>
  );
}

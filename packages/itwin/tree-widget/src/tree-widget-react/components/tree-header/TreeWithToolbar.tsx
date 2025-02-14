/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeWithToolbar.css";
import { TreeToolbar } from "./TreeToolbar.js";

import type { PropsWithChildren, ReactNode } from "react";

/** @beta */
interface TreeWithHeaderProps {
  buttons?: ReactNode;
}

/** @beta */
export function TreeWithToolbar({ buttons, children }: PropsWithChildren<TreeWithHeaderProps>) {
  return (
    <div className={"tw-tree-with-toolbar"}>
      <TreeToolbar>{buttons}</TreeToolbar>
      <div className="tw-tree-content">{children}</div>
    </div>
  );
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeWithHeader.scss";
import classNames from "classnames";
import { TreeHeader } from "./TreeHeader";

import type { PropsWithChildren, ReactNode } from "react";
import type { TreeSearchProps } from "./TreeHeader";

/** @beta */
interface TreeWithHeaderProps {
  density?: "enlarged" | "default";
  searchProps?: TreeSearchProps;
  buttons?: ReactNode;
}

/** @beta */
export function TreeWithHeader({ searchProps, buttons, density, children }: PropsWithChildren<TreeWithHeaderProps>) {
  return (
    <div className={classNames("tw-tree-with-header", density === "enlarged" && "enlarge")}>
      <TreeHeader searchProps={searchProps} density={density}>
        {buttons}
      </TreeHeader>
      <div className="tw-tree-content">{children}</div>
    </div>
  );
}

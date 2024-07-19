/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeWithHeader.scss";
import classNames from "classnames";
import { TreeHeader } from "./TreeHeader";

import type { PropsWithChildren, ReactNode } from "react";
import type { TreeFilteringProps } from "./TreeHeader";

/** @beta */
interface TreeWithHeaderProps {
  density?: "enlarged" | "default";
  filteringProps?: TreeFilteringProps;
  buttons?: ReactNode;
}

/** @beta */
export function TreeWithHeader({ filteringProps, buttons, density, children }: PropsWithChildren<TreeWithHeaderProps>) {
  return (
    <div className={classNames("tw-tree-with-header", density === "enlarged" && "enlarge")}>
      <TreeHeader filteringProps={filteringProps} density={density}>
        {buttons}
      </TreeHeader>
      <div className="tw-tree-content">{children}</div>
    </div>
  );
}

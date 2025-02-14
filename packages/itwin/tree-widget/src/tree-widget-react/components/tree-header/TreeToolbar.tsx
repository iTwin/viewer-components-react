/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeToolbar.css";
import classnames from "classnames";
import { Divider } from "@itwin/itwinui-react/bricks";

import type { PropsWithChildren } from "react";
import type { Viewport } from "@itwin/core-frontend";
/** @public */
export interface TreeToolbarButtonProps {
  viewport: Viewport;
  onFeatureUsed?: (feature: string) => void;
}

interface TreeToolbarProps {
  className?: string;
}

export function TreeToolbar(props: PropsWithChildren<TreeToolbarProps>) {
  const { className, children } = props;

  return (
    <>
      <div className={classnames("tw-tree-toolbar", className)}>{children}</div>
      <Divider />
    </>
  );
}

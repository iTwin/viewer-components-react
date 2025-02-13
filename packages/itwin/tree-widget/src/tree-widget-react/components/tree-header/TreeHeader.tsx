/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./TreeHeader.scss";
import classnames from "classnames";
import { Divider } from "@itwin/itwinui-react/bricks";

import type { PropsWithChildren } from "react";
import type { Viewport } from "@itwin/core-frontend";
/** @public */
export interface TreeHeaderButtonProps {
  viewport: Viewport;
  onFeatureUsed?: (feature: string) => void;
}

interface TreeHeaderProps {
  className?: string;
}

export function TreeHeader(props: PropsWithChildren<TreeHeaderProps>) {
  const { className, children } = props;

  return (
    <>
      <div className={classnames("tw-tree-header", className)}>
        <HeaderButtons>{children}</HeaderButtons>
      </div>
      <Divider />
    </>
  );
}

function HeaderButtons(props: PropsWithChildren) {
  return <>{props.children}</>;
}

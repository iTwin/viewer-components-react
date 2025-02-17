/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./SelectableTree.css";
import { Divider } from "@itwin/itwinui-react/bricks";

import type { Viewport } from "@itwin/core-frontend";
import type { PropsWithChildren, ReactNode } from "react";

export interface TreeToolbarButtonProps {
  viewport: Viewport;
  onFeatureUsed?: (feature: string) => void;
}

/** @beta */
interface TreehHeaderProps {
  buttons?: ReactNode;
}

/** @beta */
export function SelectableTree({ buttons, children }: PropsWithChildren<TreehHeaderProps>) {
  return (
    <div className={"tw-tree-with-toolbar"}>
      {buttons ? <div className={"tw-tree-toolbar"}>{buttons}</div> : <></>}
      <Divider />
      <div className="tw-tree-content">{children}</div>
    </div>
  );
}

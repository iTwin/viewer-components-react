/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./SelectableTree.css";
import { ErrorBoundary } from "react-error-boundary";
import { Divider } from "@stratakit/bricks";
import { ErrorState } from "./ErrorState.js";

import type { PropsWithChildren, ReactNode } from "react";
import type { TreeWidgetViewport } from "../trees/common/TreeWidgetViewport.js";

/** @public */
export interface TreeToolbarButtonProps {
  viewport: TreeWidgetViewport;
  onFeatureUsed?: (feature: string) => void;
}

/** @beta */
interface TreeHeaderProps {
  buttons?: ReactNode;
}

/** @beta */
export function SelectableTree({ buttons, children }: PropsWithChildren<TreeHeaderProps>) {
  return (
    <div className={"tw-tree-with-toolbar"}>
      {buttons ? <div className={"tw-tree-toolbar"}>{buttons}</div> : <></>}
      <Divider />
      <ErrorBoundary FallbackComponent={ErrorState}>
        <div className="tw-tree-content">{children}</div>
      </ErrorBoundary>
    </div>
  );
}

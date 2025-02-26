/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./SelectableTree.css";
import { ErrorBoundary } from "react-error-boundary";
import { Divider } from "@itwin/itwinui-react/bricks";
import { ErrorState } from "./ErrorState.js";

import type { Viewport } from "@itwin/core-frontend";
import type { PropsWithChildren, ReactNode } from "react";

/** @public */
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
      <ErrorBoundary FallbackComponent={ErrorState}>
        <div className="tw-tree-content">{children}</div>
      </ErrorBoundary>
    </div>
  );
}

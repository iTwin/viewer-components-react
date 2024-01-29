/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useState } from "react";
import { ResizableContainerObserver } from "@itwin/core-react";

/** @internal */
export interface Size {
  width: number;
  height: number;
}

/** @internal */
export interface AutoSizerProps {
  children: (size: Size) => React.ReactNode;
}

// istanbul ignore next
/** @internal */
export function AutoSizer(props: AutoSizerProps) {
  const [{ height, width }, setSize] = useState<Size>({ height: 0, width: 0 });
  const handleResize = useCallback((w: number, h: number) => {
    setSize({ height: h, width: w });
  }, []);

  return <ResizableContainerObserver onResize={handleResize}>{props.children({ height, width })}</ResizableContainerObserver>;
}

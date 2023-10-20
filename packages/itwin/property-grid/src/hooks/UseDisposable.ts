/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { IDisposable } from "@itwin/core-bentley";
import { useEffect, useRef, useState } from "react";

// TODO: Remove when `useDisposable` from `@itwin/core-react` works fine with React 18 strict mode
/** @internal */
export function useDisposable<TDisposable extends IDisposable>(factory: () => TDisposable): TDisposable {
  const [value, setValue] = useState(() => factory());
  const initialValue = useRef(true);

  useEffect(() => {
    if (!initialValue.current) {
      setValue(factory());
    }
    initialValue.current = false;
    return () => {
      setValue((prev) => {
        prev.dispose();
        return prev;
      });
    };
  }, [factory]);

  return value;
}

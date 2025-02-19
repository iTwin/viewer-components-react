/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

/** Hook that create an interval and clears it when unloaded
 * Reference: https://github.com/gaearon/overreacted.io/blob/master/src/pages/making-setinterval-declarative-with-react-hooks/index.md
 * @internal
 * Copied from: https://github.com/iTwin/appui/blob/master/ui/core-react/src/core-react/utils/hooks/useInterval.tsx
 */
export function useInterval(
  callback: (...args: any[]) => void,
  delay: number | undefined
) {
  const savedCallback = React.useRef<(...args: any[]) => void>(callback);

  // Remember the latest function.
  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  React.useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== undefined) {
      const id = setInterval(tick, delay);
      return () => {
        clearInterval(id);
      };
    } else {
      return undefined;
    }
  }, [delay]);
}

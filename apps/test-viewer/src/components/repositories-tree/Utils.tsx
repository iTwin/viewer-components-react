/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./Utils.scss";
import type { PropsWithChildren } from "react";
import { useLayoutEffect, useState } from "react";
import { ProgressLinear } from "@itwin/itwinui-react";

export function Delayed({ show, children }: PropsWithChildren<{ show: boolean }>) {
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      setVisible(show);
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [show]);

  if (!visible) {
    return null;
  }

  return <>{children}</>;
}

export function ProgressOverlay() {
  return (
    <div className="tw-progress-overlay-container">
      <ProgressLinear indeterminate />
      <div className="tw-progress-overlay-backdrop" />
    </div>
  );
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useState } from "react";
import { Guid } from "@itwin/core-bentley";

/** @internal */
export function useGuid() {
  const [componentId] = useState(() => Guid.createValue());
  return componentId;
}

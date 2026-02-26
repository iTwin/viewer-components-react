/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SharedTreeContextProviderInternal } from "./internal/SharedTreeWidgetContextProviderInternal.js";

import type { PropsWithChildren } from "react";

/**
 * A React context provider for setting up shared tree context.
 * @beta
 */
export function SharedTreeContextProvider({ children }: PropsWithChildren<{}>) {
  return <SharedTreeContextProviderInternal>{children}</SharedTreeContextProviderInternal>;
}

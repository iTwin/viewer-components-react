/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";

import type { BaseMapLayerSettings } from "@itwin/core-common";
import type { MapLayerSource, ScreenViewport } from "@itwin/core-frontend";

/** @internal */
export interface SourceMapContextProps {
  readonly sources: MapLayerSource[];
  readonly loadingSources: boolean;
  readonly bases: BaseMapLayerSettings[];
  readonly activeViewport?: ScreenViewport;
}

/** @internal */
export const SourceMapContext = React.createContext<SourceMapContextProps>({
  sources: [],
  loadingSources: false,
  bases: [],
});

/** @internal */
export function useSourceMapContext(): SourceMapContextProps {
  return React.useContext(SourceMapContext);
}

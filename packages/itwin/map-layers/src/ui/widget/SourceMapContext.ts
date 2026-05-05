/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";

import type { BaseMapLayerSettings } from "@itwin/core-common";
import type { MapLayerSource, ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerOptions, StyleMapLayerSettings } from "../Interfaces";

/** @internal */
export interface SourceMapContextProps {
  readonly sources: MapLayerSource[];
  readonly loadingSources: boolean;
  readonly bases: BaseMapLayerSettings[];
  readonly refreshFromStyle: () => void;
  readonly activeViewport?: ScreenViewport;
  readonly backgroundLayers?: StyleMapLayerSettings[];
  readonly overlayLayers?: StyleMapLayerSettings[];
  readonly mapLayerOptions?: MapLayerOptions;
}

/** @internal */
export const SourceMapContext = React.createContext<SourceMapContextProps>({
  sources: [],
  loadingSources: false,
  bases: [],
  refreshFromStyle: () => {},
});

/** @internal */
export function useSourceMapContext(): SourceMapContextProps {
  return React.useContext(SourceMapContext);
}

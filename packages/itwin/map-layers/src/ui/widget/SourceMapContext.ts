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
  readonly selectAllLayers: (isOverlay: boolean) => void;
  readonly activeViewport?: ScreenViewport;
  readonly backgroundLayers?: StyleMapLayerSettings[];
  readonly overlayLayers?: StyleMapLayerSettings[];
  readonly mapLayerOptions?: MapLayerOptions;
}

/** @internal */
export interface SourceMapProviderProps {
  readonly children: React.ReactNode;
  readonly value: SourceMapContextProps;
}

/** @internal */
export const SourceMapContext = React.createContext<SourceMapContextProps>({
  sources: [],
  loadingSources: false,
  bases: [],
  refreshFromStyle: () => {},
  selectAllLayers: () => {},
});

/** @internal */
export function SourceMapProvider(props: SourceMapProviderProps): React.ReactElement {
  return React.createElement(SourceMapContext.Provider, { value: props.value }, props.children);
}

/** @internal */
export function useSourceMapContext(): SourceMapContextProps {
  return React.useContext(SourceMapContext);
}

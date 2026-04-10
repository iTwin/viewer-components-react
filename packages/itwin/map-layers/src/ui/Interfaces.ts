/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { BeEvent } from "@itwin/core-bentley";
import type { BaseMapLayerSettings, MapSubLayerProps } from "@itwin/core-common";
import type { HitDetail, MapLayerImageryProvider, MapTileTreeScaleRangeVisibility } from "@itwin/core-frontend";
import type { ToolbarOrientation } from "@itwin/appui-react";

export interface StyleMapLayerSettings {
  /** Name */
  name: string;
  /** source (i.URL for ImageMapLayerSettings or modelId for ModelMapLayerSettings)  */
  source: string;
  /** Controls visibility of layer */
  visible: boolean;
  treeVisibility: MapTileTreeScaleRangeVisibility;
  /** A transparency value from 0.0 (fully opaque) to 1.0 (fully transparent) to apply to map graphics when drawing, or false to indicate the transparency should not be overridden. Default value: false. */
  transparency: number;
  /** Transparent background */
  transparentBackground: boolean;
  /** set map as underlay or overlay */
  isOverlay: boolean;
  /** layer index in the viewport */
  layerIndex: number;
  /** Available map sub-layer */
  subLayers?: MapSubLayerProps[];
  /** sub-layer panel displayed. */
  showSubLayers: boolean;
  /** Some format can publish only a single layer at a time (i.e WMTS) */
  provider?: MapLayerImageryProvider;

  selected: boolean;
}

export interface MapTypesOptions {
  readonly supportTileUrl: boolean;
  readonly supportWmsAuthentication: boolean;
}

export interface MapLayerOptions {
  hideExternalMapLayers?: boolean;
  fetchPublicMapLayerSources?: boolean;
  mapTypeOptions?: MapTypesOptions;

  /** Optional list of base map-layers to display in the base map select control */
  baseMapLayers?: BaseMapLayerSettings[];

  /** Optionally show the user preferences storage options(i.e. iTwin vs iModel).  Defaults to false */
  showUserPreferencesStorageOptions?: boolean;

  /** Optionally hide the header label */
  hideHeaderLabel?: boolean;
}

export interface MapFeatureInfoPropertyGridOptions {
  isPropertySelectionEnabled?: boolean;
}

export type MapHitEvent = BeEvent<(hit: HitDetail) => void>;

export interface MapFeatureInfoOptions {
  disableDefaultFeatureInfoTool?: boolean;
  showLoadProgressAnimation?: boolean;
  propertyGridOptions?: MapFeatureInfoPropertyGridOptions;
  toolbarOrientation?: ToolbarOrientation;
  itemPriority?: number;
  /**
   * Optional flag to disable the default feature info widget.
   * When true, the default widget will not be created, allowing you to display
   * the feature info content in a custom widget.
   */
  disableDefaultFeatureInfoWidget?: boolean;
}

export interface CustomParamItem {
  name: string;
  key: string;
  value: string;
  secret: boolean;
}

export interface CustomParamsMappingItem {
  customParamNames: string[];
}

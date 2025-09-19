/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import "./MapUrlDialog.scss";
import "./SelectMapFormat.scss";
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { LabeledSelect } from "@itwin/itwinui-react";

import type { SelectOption } from "@itwin/itwinui-react";
import type { MapTypesOptions } from "../Interfaces";

// TODO:
// Remove this structure and iterate over the registry's active formats.
// Still need a proper way to exclude some format, like we currently do with
// 'TileUrl' without the need to hardcode any format Id.
export const MAP_TYPES = {
  wms: "WMS",
  arcGis: "ArcGIS",
  wmts: "WMTS",
  tileUrl: "TileURL",
  arcGisFeature: "ArcGISFeature",
};

interface SelectMapFormatProps {
  value?: string;
  disabled?: boolean;
  mapTypesOptions?: MapTypesOptions;
  onChange?: (mapType: string) => void;
  /**
   * Message below the select. Does not apply to 'inline' select.
   */
  message?: React.ReactNode;
  /**
   * Status of the select.
   * @default ''
   */
  status?: "positive" | "warning" | "negative";
}

export function SelectMapFormat(props: SelectMapFormatProps) {
  const [mapFormat, setMapFormat] = React.useState(props.value ?? MAP_TYPES.arcGis);

  const [mapFormats] = React.useState((): SelectOption<string>[] => {
    const formats: SelectOption<string>[] = [
      { value: MAP_TYPES.arcGis, label: MAP_TYPES.arcGis },
      { value: MAP_TYPES.wms, label: MAP_TYPES.wms },
      { value: MAP_TYPES.wmts, label: MAP_TYPES.wmts },
    ];
    if (props.mapTypesOptions?.supportTileUrl) {
      formats.push({ value: MAP_TYPES.tileUrl, label: MAP_TYPES.tileUrl });
    }

    if (IModelApp.mapLayerFormatRegistry.isRegistered(MAP_TYPES.arcGisFeature)) {
      formats.push({ value: MAP_TYPES.arcGisFeature, label: MAP_TYPES.arcGisFeature });
    }
    return formats;
  });

  const handleOnChange = React.useCallback(
    (value: string) => {
      setMapFormat(value);
      if (props.onChange) {
        props.onChange(value);
      }
    },
    [props],
  );

  return (
    <LabeledSelect
      className="map-layer-source-select"
      options={mapFormats}
      value={mapFormat}
      disabled={props.disabled}
      onChange={handleOnChange}
      size="small"
    />
  );
}

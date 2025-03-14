/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore droppable Sublayer Basemap

import "./MapManagerSettings.scss";
import * as React from "react";
import { PlanarClipMaskMode, PlanarClipMaskPriority, TerrainHeightOriginMode } from "@itwin/core-common";
import { QuantityType } from "@itwin/core-frontend";
import { QuantityNumberInput } from "@itwin/imodel-components-react";
import { Input, Select, Slider, Tab, Tabs, ToggleSwitch } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";
import { CustomParamsSettingsPanel } from "./CustomParamsSettings";
import { useSourceMapContext } from "./MapLayerManager";

import type { ViewState3d } from "@itwin/core-frontend";
import type { BackgroundMapProps, BackgroundMapSettings, TerrainProps } from "@itwin/core-common";
import type { SelectOption } from "@itwin/itwinui-react";

enum MapMaskingOption {
  None,
  AllModels,
}

interface MapManagerSettingsProps {
  onHandleOutsideClick?: (shouldHandle: boolean) => void;
}

function getMapMaskingFromBackgroundMapSetting(backgroundMapSettings: BackgroundMapSettings): MapMaskingOption {
  if (backgroundMapSettings.planarClipMask.mode === PlanarClipMaskMode.Priority && backgroundMapSettings.planarClipMask.priority) {
    if (backgroundMapSettings.planarClipMask.priority >= PlanarClipMaskPriority.BackgroundMap) {
      return MapMaskingOption.AllModels;
    }
  }
  return MapMaskingOption.None;
}

function getHeightOriginModeKey(mode: TerrainHeightOriginMode): string {
  if (TerrainHeightOriginMode.Geodetic === mode) {
    return "geodetic";
  }
  if (TerrainHeightOriginMode.Geoid === mode) {
    return "geoid";
  }
  return "ground";
}

function getHeightOriginModeFromKey(mode: string): TerrainHeightOriginMode {
  if ("geodetic" === mode) {
    return TerrainHeightOriginMode.Geodetic;
  }
  if ("geoid" === mode) {
    return TerrainHeightOriginMode.Geoid;
  }
  return TerrainHeightOriginMode.Ground;
}

export function MapManagerSettings({ onHandleOutsideClick }: MapManagerSettingsProps) {
  const { activeViewport } = useSourceMapContext();
  const backgroundMapSettings = (activeViewport!.view as ViewState3d).getDisplayStyle3d().settings.backgroundMap;

  const [transparency, setTransparency] = React.useState(() =>
    typeof backgroundMapSettings.transparency === "boolean" ? 0 : Math.round(backgroundMapSettings.transparency * 100) / 100,
  );

  const terrainSettings = backgroundMapSettings.terrainSettings;
  const [groundBias, setGroundBias] = React.useState(() => backgroundMapSettings.groundBias);

  const terrainHeightOptions = React.useRef<SelectOption<string>[]>([
    { value: "geodetic", label: MapLayersUI.localization.getLocalizedString("mapLayers:Settings.ElevationTypeGeodetic") },
    { value: "geoid", label: MapLayersUI.localization.getLocalizedString("mapLayers:Settings.ElevationTypeGeoid") },
    { value: "ground", label: MapLayersUI.localization.getLocalizedString("mapLayers:Settings.ElevationTypeGround") },
  ]);

  const updateTerrainSettings = React.useCallback(
    (props: TerrainProps) => {
      activeViewport!.changeBackgroundMapProps({ terrainSettings: props });
    },
    [activeViewport],
  );

  const updateBackgroundMap = React.useCallback(
    (props: BackgroundMapProps) => {
      activeViewport!.changeBackgroundMapProps(props);
    },
    [activeViewport],
  );

  const [heightOriginMode, setHeightOriginMode] = React.useState(() => getHeightOriginModeKey(terrainSettings.heightOriginMode));
  const handleElevationTypeSelected = React.useCallback(
    (newValue: string): void => {
      if (newValue) {
        const newHeightOriginMode = getHeightOriginModeFromKey(newValue);
        updateTerrainSettings({ heightOriginMode: newHeightOriginMode });
        setHeightOriginMode(newValue);
      }
    },
    [updateTerrainSettings],
  );

  const [maskTransparency, setMaskTransparency] = React.useState(() =>
    backgroundMapSettings.planarClipMask.transparency === undefined ? undefined : Math.round(backgroundMapSettings.planarClipMask.transparency * 100) / 100,
  );

  const getNormalizedMaskTransparency = React.useCallback(() => {
    return maskTransparency === undefined ? 0 : maskTransparency;
  }, [maskTransparency]);

  const updateMaskingSettings = React.useCallback(
    (option: MapMaskingOption) => {
      if (option === MapMaskingOption.AllModels) {
        activeViewport!.changeBackgroundMapProps({
          planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: maskTransparency },
        });
      }
      if (option === MapMaskingOption.None) {
        activeViewport!.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.None } });
      }
    },
    [activeViewport, maskTransparency],
  );

  const [masking, setMasking] = React.useState(() => getMapMaskingFromBackgroundMapSetting(backgroundMapSettings));

  const onMaskingToggle = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      const maskingOption = checked ? MapMaskingOption.AllModels : MapMaskingOption.None;
      updateMaskingSettings(maskingOption);
      setMasking(maskingOption);
    },
    [updateMaskingSettings],
  );

  const [overrideMaskTransparency, setOverrideMaskTransparency] = React.useState(() => backgroundMapSettings.planarClipMask.transparency !== undefined);

  const onOverrideMaskTransparencyToggle = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      const trans = checked ? getNormalizedMaskTransparency() : undefined;
      activeViewport!.changeBackgroundMapProps({
        planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: trans },
      });

      setOverrideMaskTransparency(checked);
    },
    [activeViewport, getNormalizedMaskTransparency],
  );

  const handleElevationChange = React.useCallback(
    (value: number) => {
      if (value !== undefined) {
        updateBackgroundMap({ groundBias: value });
        setGroundBias(value);
      }
    },
    [updateBackgroundMap],
  );

  const handleAlphaChange = React.useCallback(
    (values: readonly number[]) => {
      const newTransparency = values[0] / 100;
      activeViewport!.changeBackgroundMapProps({ transparency: newTransparency });
      setTransparency(newTransparency);
    },
    [activeViewport],
  );

  const handleMaskTransparencyChange = React.useCallback(
    (values: readonly number[]) => {
      const newTransparency = values[0] / 100;
      activeViewport!.changeBackgroundMapProps({
        planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency: newTransparency },
      });
      setMaskTransparency(newTransparency);
    },
    [activeViewport],
  );

  const [applyTerrain, setApplyTerrain] = React.useState(() => backgroundMapSettings.applyTerrain);

  const onToggleTerrain = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      updateBackgroundMap({ applyTerrain: checked });
      setApplyTerrain(checked);
    },
    [updateBackgroundMap],
  );

  const [exaggeration, setExaggeration] = React.useState(() => terrainSettings.exaggeration);

  const handleExaggerationChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const numValue = Number(e.target.value);
      if (isNaN(numValue) || numValue === undefined) {
        e.preventDefault();
        return;
      }
      updateTerrainSettings({ exaggeration: numValue });
      setExaggeration(numValue);
    },
    [updateTerrainSettings],
  );

  const [terrainOrigin, setTerrainOrigin] = React.useState(() => terrainSettings.heightOrigin);

  const handleHeightOriginChange = React.useCallback(
    (value: number) => {
      if (undefined !== value) {
        updateTerrainSettings({ heightOrigin: value });
        setTerrainOrigin(value);
      }
    },
    [updateTerrainSettings],
  );

  const [useDepthBuffer, setUseDepthBuffer] = React.useState(() => backgroundMapSettings.useDepthBuffer);
  const onToggleUseDepthBuffer = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      updateBackgroundMap({ useDepthBuffer: checked });
      setUseDepthBuffer(checked);
    },
    [updateBackgroundMap],
  );

  /** Disable commas and letters */
  const onKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    const isLetter = /^[a-zA-Z]$/.test(event.key);
    if (event.key === "," || isLetter) {
      event.preventDefault();
    }
  }, []);

  const [isLocatable, setIsLocatable] = React.useState(() => backgroundMapSettings.locatable);
  const onLocatableToggle = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      updateBackgroundMap({ nonLocatable: !checked });
      setIsLocatable(checked);
    },
    [updateBackgroundMap],
  );

  const [transparencyLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.Transparency"));
  const [terrainLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.Terrain"));
  const [enableLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.Enable"));
  const [elevationOffsetLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.ElevationOffset"));
  const [useDepthBufferLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.UseDepthBuffer"));
  const [modelHeightLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.ModelHeight"));
  const [heightOriginLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.HeightOrigin"));
  const [exaggerationLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.Exaggeration"));
  const [locatableLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.Locatable"));
  const [maskingLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.Mask"));
  const [overrideMaskTransparencyLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.OverrideMaskTransparency"));
  const [maskTransparencyLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Settings.MaskTransparency"));

  const [tabIndex, setTabIndex] = React.useState(0);

  return (
    <Tabs activeIndex={tabIndex} orientation="horizontal" labels={[<Tab key="general" label="General" />, <Tab key="advanced" label="Advanced" />]} onTabSelected={setTabIndex}>
      {tabIndex === 0 && (
        <>
          <div className="maplayers-settings-container">
            <span className="map-manager-settings-label">{transparencyLabel}</span>
            <Slider min={0} max={100} values={[transparency * 100]} onChange={handleAlphaChange} step={1} />

            <span className="map-manager-settings-label">{locatableLabel}</span>
            <ToggleSwitch data-testid="locatable" onChange={onLocatableToggle} checked={isLocatable} />

            <span className="map-manager-settings-label">{maskingLabel}</span>
            <ToggleSwitch data-testid="mask" onChange={onMaskingToggle} checked={masking !== MapMaskingOption.None} />

            <span className="map-manager-settings-label">{overrideMaskTransparencyLabel}</span>
            <ToggleSwitch data-testid="overrideMaskTransparency" disabled={masking === MapMaskingOption.None} onChange={onOverrideMaskTransparencyToggle} checked={overrideMaskTransparency} />

            <span className="map-manager-settings-label">{maskTransparencyLabel}</span>
            <Slider
              disabled={masking === MapMaskingOption.None || !overrideMaskTransparency}
              min={0}
              max={100}
              values={[getNormalizedMaskTransparency() * 100]}
              onChange={handleMaskTransparencyChange}
              step={1}
            />

            <>
              <span className="map-manager-settings-label">{elevationOffsetLabel}</span>
              <QuantityNumberInput
                data-testid="ground-bias"
                disabled={applyTerrain}
                persistenceValue={groundBias}
                step={1}
                snap
                quantityType={QuantityType.LengthEngineering}
                onChange={handleElevationChange}
                onKeyDown={onKeyDown}
              />

              <span className="map-manager-settings-label">{useDepthBufferLabel}</span>
              <ToggleSwitch data-testid="depthBuffer" disabled={applyTerrain} onChange={onToggleUseDepthBuffer} checked={useDepthBuffer} />
            </>
          </div>
          <div className="map-manager-settings-group">
            <fieldset>
              <legend>{terrainLabel}</legend>

              <div className="maplayers-settings-container">
                <span className="map-manager-settings-label">{enableLabel}</span>
                <ToggleSwitch data-testid="terrain" onChange={onToggleTerrain} checked={applyTerrain} />

                <span className="map-manager-settings-label">{modelHeightLabel}</span>
                <QuantityNumberInput
                  data-testid="terrain-origin"
                  disabled={!applyTerrain}
                  persistenceValue={terrainOrigin}
                  snap
                  quantityType={QuantityType.LengthEngineering}
                  onChange={handleHeightOriginChange}
                  onKeyDown={onKeyDown}
                />

                <span className="map-manager-settings-label">{heightOriginLabel}</span>
                <Select
                  data-testid="terrain-height-mode"
                  options={terrainHeightOptions.current}
                  disabled={!applyTerrain}
                  value={heightOriginMode}
                  onChange={handleElevationTypeSelected}
                  size="small"
                />

                <span className="map-manager-settings-label">{exaggerationLabel}</span>
                <Input
                  data-testid="exaggeration-input"
                  type="number"
                  value={exaggeration.toString()}
                  disabled={!applyTerrain}
                  onChange={handleExaggerationChange}
                  onKeyDown={onKeyDown}
                  size="small"
                />
              </div>
            </fieldset>
          </div>
        </>
      )}
      {tabIndex === 1 && <CustomParamsSettingsPanel onHandleOutsideClick={onHandleOutsideClick}></CustomParamsSettingsPanel>}
    </Tabs>
  );
}

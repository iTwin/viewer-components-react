import "./SettingsManager.scss";
/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  BackgroundMapProps,
  BackgroundMapSettings,
  TerrainHeightOriginMode,
  TerrainProps,
} from "@bentley/imodeljs-common";
import {
  AuthorizedFrontendRequestContext,
  IModelApp,
  NotifyMessageDetails,
  OutputMessagePriority,
  ScreenViewport,
  SpatialViewState,
} from "@bentley/imodeljs-frontend";
import { AlphaSlider as Slider } from "@bentley/ui-components";
import { Checkbox, NumericInput, Select, Toggle } from "@bentley/ui-core";
import { AppContext } from "../reality-data-react";
import { ModalDialogProps } from "./ModalDialog";
import RealityData from "../api/RealityData";

interface SettingsManagerProps {
  appContext: AppContext;
  ModalDialogComponent: React.ComponentType<ModalDialogProps>;
  opened: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
}

interface SettingsManagerState {
  opened: boolean;
  initialSettings?: BackgroundMapSettings;
}

const bingMapNamespace = "bingMapSettings";
const elevationSetting = "elevation";
const backgroundMapSetting = "backgroundMapSetting";

/** Manager of the settings menu, renders modal component and content into that */
export class SettingsManager extends React.Component<
  SettingsManagerProps,
  SettingsManagerState
> {
  constructor(props: SettingsManagerProps) {
    super(props);
    this.state = {
      opened: this.props.opened,
      initialSettings: this._getActiveMapSettings(),
    };
  }

  private _getActiveMapSettings(): BackgroundMapSettings | undefined {
    let bgMapSettings: BackgroundMapSettings | undefined;
    const vp = this.props.appContext.viewManager.selectedView as ScreenViewport;
    if (vp) {
      const view = vp.view as SpatialViewState;
      if (view) bgMapSettings = view.getDisplayStyle3d().settings.backgroundMap;
    }
    return bgMapSettings;
  }

  private async _saveSetting(): Promise<void> {
    const mapSettings = this._getActiveMapSettings();
    if (!mapSettings) return;

    if (
      this.props.appContext.features.bingElevationUseSettings ||
      this.props.appContext.features.useBingMapEnhancedSettings
    ) {
      const iModelId = this.props.appContext.iModelConnection.iModelId;
      if (!this.props.appContext.projectId || !iModelId) return;

      const requestContext = await AuthorizedFrontendRequestContext.create();
      if (this.props.appContext.features.useBingMapEnhancedSettings)
        /* tslint:disable:no-floating-promises */
        IModelApp.settings.saveSharedSetting(
          requestContext,
          mapSettings,
          bingMapNamespace,
          backgroundMapSetting,
          true,
          this.props.appContext.projectId,
          iModelId
        );
      else if (this.props.appContext.features.bingElevationUseSettings) {
        const elevation = mapSettings.groundBias;
        IModelApp.settings.saveSharedSetting(
          requestContext,
          elevation,
          bingMapNamespace,
          elevationSetting,
          true,
          this.props.appContext.projectId,
          iModelId
        );
        /* tslint:enable:no-floating-promises */
      }
    }
  }

  private updateBackgroundMap(props: BackgroundMapProps): void {
    const vp = this.props.appContext.viewManager.selectedView as ScreenViewport;
    vp.changeBackgroundMapProps(props);
  }

  public cancel = () => {
    if (this.state.initialSettings)
      this.updateBackgroundMap(this.state.initialSettings);
  };

  public confirm = () => {
    this._saveSetting(); // tslint:disable-line:no-floating-promises
    this.setState({ initialSettings: this._getActiveMapSettings() });
  };

  public render() {
    return (
      <this.props.ModalDialogComponent
        appContext={this.props.appContext}
        isOpen={this.props.opened}
        title={RealityData.translate("bingMapSettingsTitle")}
        onCancel={() => {
          this.cancel();
          if (this.props.onCancel) this.props.onCancel();
        }}
        onConfirm={() => {
          this.confirm();
          if (this.props.onConfirm) this.props.onConfirm();
        }}
      >
        <SettingsContent {...this.props} />
      </this.props.ModalDialogComponent>
    );
  }
}

interface SettingsContentProps {
  appContext: AppContext;
}

/** Manager of the settings menu, renders modal component and content into that */
export class SettingsContent extends React.Component<SettingsContentProps> {
  private static get _elevationOptions() {
    return {
      geodetic: RealityData.translate("elevationTypeGeodetic"),
      geoid: RealityData.translate("elevationTypeGeoid"),
      ground: RealityData.translate("elevationTypeGround"),
    };
  }

  private updateBackgroundMap(props: BackgroundMapProps): void {
    const vp = this.props.appContext.viewManager.selectedView as ScreenViewport;
    vp.changeBackgroundMapProps(props);
  }

  private updateTerrainSettings(props: TerrainProps) {
    const vp = this.props.appContext.viewManager.selectedView as ScreenViewport;
    vp.changeBackgroundMapProps({ terrainSettings: props });
  }

  private _onToggleTerrain = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.updateBackgroundMap({ applyTerrain: e.target.checked });
    this.forceUpdate();
  };

  private _onToggleUseDepthBuffer = (checked: boolean) => {
    this.updateBackgroundMap({ useDepthBuffer: checked });
    this.forceUpdate();
  };

  private _handleAlphaChange = (value: number) => {
    const newTransparency = 1 - value;
    this.updateBackgroundMap({ transparency: newTransparency });
    this.forceUpdate();
  };

  private _handleExaggerationChange = (
    value: number | null,
    _stringValue: string,
    _input: HTMLInputElement
  ) => {
    if (value) {
      this.updateTerrainSettings({ exaggeration: value });
      this.forceUpdate();
    }
  };

  private _handleHeightOriginChange = (
    value: number | null,
    _stringValue: string,
    _input: HTMLInputElement
  ) => {
    if (value) {
      this.updateTerrainSettings({ heightOrigin: value });
      this.forceUpdate();
    }
  };

  private getHeightOriginModeFromKey(mode: string): TerrainHeightOriginMode {
    const terrainHeightOriginModeMap: {
      [k: string]: TerrainHeightOriginMode;
    } = {
      geodetic: TerrainHeightOriginMode.Geodetic,
      geoid: TerrainHeightOriginMode.Geoid,
    };
    const result = terrainHeightOriginModeMap[mode];
    return result !== undefined ? result : TerrainHeightOriginMode.Ground;
  }

  private _handleElevationTypeSelected = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    if (event.target.value) {
      const heightOriginMode = this.getHeightOriginModeFromKey(
        event.target.value
      );

      this.updateTerrainSettings({ heightOriginMode });
      this.forceUpdate();
    }
  };

  private _handleElevationChange = (
    value: number | null,
    _stringValue: string,
    _input: HTMLInputElement
  ) => {
    if (value === null) {
      this.displayError();
    } else {
      if (value) {
        this.updateBackgroundMap({ groundBias: value });
        this.forceUpdate();
      }
    }
  };

  private displayError(): void {
    IModelApp.notifications.outputMessage(
      new NotifyMessageDetails(
        OutputMessagePriority.Error,
        RealityData.translate("invalidElevationError"),
        RealityData.translate("invalidElevationDetails")
      )
    );
  }

  private getHeightOriginModeKey(mode: TerrainHeightOriginMode): string {
    const terrainHeightOriginModeMapReverse: { [k: number]: string } = {
      [TerrainHeightOriginMode.Geodetic]: "geodetic",
      [TerrainHeightOriginMode.Geoid]: "geoid",
    };
    const result = terrainHeightOriginModeMapReverse[mode];
    return result !== undefined ? result : "ground";
  }

  public render(): JSX.Element {
    const vp = this.props.appContext.viewManager.selectedView as ScreenViewport;
    const view = vp.view as SpatialViewState;
    const backgroundMap = view.getDisplayStyle3d().settings.backgroundMap;
    const applyTerrain = backgroundMap.applyTerrain;
    const useDepthBuffer = backgroundMap.useDepthBuffer;
    const transparency =
      typeof backgroundMap.transparency === "boolean"
        ? 0
        : backgroundMap.transparency;
    const terrainSettings = backgroundMap.terrainSettings;
    const heightOriginMode = this.getHeightOriginModeKey(
      terrainSettings.heightOriginMode
    );
    const heightOrigin = terrainSettings.heightOrigin;
    const groundBias = backgroundMap.groundBias;
    const showEnhancedSettings = this.props.appContext.features
      .useBingMapEnhancedSettings;

    return (
      <div className="reality-data-settings-content">
        {showEnhancedSettings ? (
          <div className="enhanced">
            <label>
              <p>{RealityData.translate("terrain")}</p>
              <Checkbox
                className="reality-data-map-terrain-toggle"
                onChange={this._onToggleTerrain}
                checked={applyTerrain}
              />
            </label>
            {!applyTerrain ? (
              <>
                <label>
                  <p>{RealityData.translate("elevationOffset")}</p>
                  <NumericInput
                    strict={false}
                    value={groundBias}
                    onChange={this._handleElevationChange}
                    onKeyDown={this._onKeyDown}
                    className="reality-data-map-non-terrain-elevation"
                  />
                </label>
                <label>
                  <p>{RealityData.translate("useDepthBuffer")}</p>
                  <Toggle
                    onChange={this._onToggleUseDepthBuffer}
                    isOn={useDepthBuffer}
                    className="depth-toggle"
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  <p>{RealityData.translate("modelHeight")}</p>
                  <NumericInput
                    strict={false}
                    value={heightOrigin}
                    onChange={this._handleHeightOriginChange}
                    onKeyDown={this._onKeyDown}
                  />
                </label>
                <label>
                  <p>{RealityData.translate("elevationType")}</p>
                  <Select
                    options={SettingsContent._elevationOptions}
                    value={heightOriginMode}
                    onChange={this._handleElevationTypeSelected}
                  />
                </label>
                <label>
                  <p>{RealityData.translate("exaggeration")}</p>
                  <NumericInput
                    strict={false}
                    value={terrainSettings.exaggeration}
                    onChange={this._handleExaggerationChange}
                    onKeyDown={this._onKeyDown}
                  />
                </label>
              </>
            )}

            <label>
              <p>{RealityData.translate("transparency")}</p>
              <Slider
                isHorizontal
                alpha={1 - transparency}
                onAlphaChange={this._handleAlphaChange}
              />
            </label>
          </div>
        ) : (
          <div className="basic">
            <span>{RealityData.translate("elevationOffset")}</span>
            <NumericInput
              strict={false}
              value={groundBias}
              onChange={this._handleElevationChange}
              onKeyDown={this._onKeyDown}
              className="non-terrain-elevation"
            />
          </div>
        )}
      </div>
    );
  }

  /** Disable commas and letters */
  private _onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.keyCode === 188 || (event.keyCode >= 65 && event.keyCode <= 90))
      event.preventDefault();
  };
}

export default SettingsManager;

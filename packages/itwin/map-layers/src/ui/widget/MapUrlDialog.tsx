/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import "./MapUrlDialog.scss";
import * as React from "react";
import { SpecialKey } from "@itwin/appui-abstract";
import { BeEvent, Guid } from "@itwin/core-bentley";
import { IModelApp, MapLayerSource, MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { Dialog, useCrossOriginPopup } from "@itwin/core-react";
import { SvgStatusWarning, SvgTechnicalPreviewMini } from "@itwin/itwinui-icons-color-react";
import { Button, Icon, Input, LabeledInput, ProgressLinear } from "@itwin/itwinui-react";
import { CustomParamsMappingStorage } from "../../CustomParamsMappingStorage";
import { CustomParamsStorage } from "../../CustomParamsStorage";
import { CustomParamUtils } from "../../CustomParamUtils";
import { MapLayerPreferences } from "../../MapLayerPreferences";
import { MapLayersUI } from "../../mapLayers";
import { SelectCustomParam } from "./SelectCustomParam";
import { SelectMapFormat } from "./SelectMapFormat";
import { UserPreferencesStorageOptions } from "./UserPreferencesStorageOptions";

import type { ImageMapLayerSettings } from "@itwin/core-common";
import type { MapLayerAccessClient, MapLayerSourceValidation, ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerOptions } from "../Interfaces";
export const MAP_TYPES = {
  wms: "WMS",
  arcGis: "ArcGIS",
  wmts: "WMTS",
  tileUrl: "TileURL",
  arcGisFeature: "ArcGISFeature",
};
const URL_SCHEMES = {
  http: "http://",
  https: "https://",
};

export type LayerCreationMode = "single" | "multiple";
interface MapUrlDialogProps {
  activeViewport?: ScreenViewport;
  isOverlay: boolean;
  onOkResult: (result?: SourceState) => void;
  onCancelResult?: () => void;
  mapLayerOptions?: MapLayerOptions;

  // An optional layer definition can be provide to enable the edit mode
  signInModeArgs?: {
    layer: ImageMapLayerSettings;
    validation?: MapLayerSourceValidation;
    source?: MapLayerSource;
  };

  mapLayerSourceToEdit?: MapLayerSource;
}

export interface SourceState {
  source: MapLayerSource;
  validation: MapLayerSourceValidation;
  customParamIdx?: { [key: string]: string };
  privateCustomParamIdx?: { [key: string]: string };
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapUrlDialog(props: MapUrlDialogProps) {
  const { onOkResult, mapLayerOptions } = props;

  const getMapUrlFromProps = React.useCallback(() => {
    if (props.mapLayerSourceToEdit) {
      return props.mapLayerSourceToEdit.url;
    } else if (props.signInModeArgs) {
      return props.signInModeArgs.layer.url;
    }
    return "";
  }, [props.mapLayerSourceToEdit, props.signInModeArgs]);

  const getMapNameFromProps = React.useCallback(() => {
    if (props.mapLayerSourceToEdit) {
      return props.mapLayerSourceToEdit.name;
    } else if (props.signInModeArgs) {
      return props.signInModeArgs.layer.name;
    }
    return "";
  }, [props.mapLayerSourceToEdit, props.signInModeArgs]);

  const getFormatFromProps = React.useCallback(() => {
    if (props.mapLayerSourceToEdit) {
      return props.mapLayerSourceToEdit.formatId;
    } else if (props.signInModeArgs) {
      return props.signInModeArgs.layer.formatId;
    }
    return undefined;
  }, [props.mapLayerSourceToEdit, props.signInModeArgs]);

  const getCustomParamsMapping = React.useCallback((url: string): string[] => {
    const cpMappingStorage = new CustomParamsMappingStorage();
    const cpMapping = cpMappingStorage.get(url.toLowerCase());
    if (cpMapping && !Array.isArray(cpMapping)) {
      return cpMapping.customParamNames;
    }
    return [];
  }, []);

  const [dialogTitle] = React.useState(
    MapLayersUI.localization.getLocalizedString(
      props.signInModeArgs || props.mapLayerSourceToEdit ? "mapLayers:CustomAttach.EditCustomLayer" : "mapLayers:CustomAttach.AttachCustomLayer",
    ),
  );
  const [typeLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.Type"));
  const [nameLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.Name"));
  const [nameInputPlaceHolder] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.NameInputPlaceHolder"));
  const [urlLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.URL"));
  const [urlInputPlaceHolder] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.UrlInputPlaceHolder"));
  const [missingCredentialsLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.MissingCredentials"));
  const [invalidCredentialsLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.InvalidCredentials"));
  const [externalLoginTitle] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ExternalLogin"));
  const [externalLoginFailedMsg] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ExternalLoginFailed"));
  const [externalLoginSucceededMsg] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ExternalLoginSucceeded"));
  const [externalLoginWaitingMsg] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ExternalLoginWaiting"));
  const [externalLoginTryAgainLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ExternalLoginTryAgain"));
  const [serverRequireCredentials, setServerRequireCredentials] = React.useState(false);
  const [invalidCredentialsProvided, setInvalidCredentialsProvided] = React.useState(false);
  const [layerAttachPending, setLayerAttachPending] = React.useState(false);
  const [layerAuthPending, setLayerAuthPending] = React.useState(false);
  const [mapUrl, setMapUrl] = React.useState(getMapUrlFromProps());
  const [mapName, setMapName] = React.useState(getMapNameFromProps());
  const [userName, setUserName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [noSaveSettingsWarning] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.NoSaveSettingsWarning"));
  const [passwordLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:AuthenticationInputs.Password"));
  const [passwordRequiredLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:AuthenticationInputs.PasswordRequired"));
  const [userNameLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:AuthenticationInputs.Username"));
  const [userNameRequiredLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:AuthenticationInputs.UsernameRequired"));
  const [settingsStorage, setSettingsStorageRadio] = React.useState("iTwin");
  const [oauthProcessSucceeded, setOAuthProcessSucceeded] = React.useState<undefined | boolean>(undefined);
  const [showOauthPopup, setShowOauthPopup] = React.useState(false);
  const [externalLoginUrl, setExternalLoginUrl] = React.useState<string | undefined>();
  const [onOauthProcessEnd] = React.useState(new BeEvent());
  const [accessClient, setAccessClient] = React.useState<MapLayerAccessClient | undefined>();
  const [isAccessClientInitialized, setAccessClientInitialized] = React.useState(false);
  const [shouldAutoAttachSource, setShouldAutoAttachSource] = React.useState(true);
  const [incompatibleFormat, setIncompatibleFormat] = React.useState(false);

  const [mapType, setMapType] = React.useState(getFormatFromProps() ?? "ArcGIS");
  const [customParamNamesChangedByUser, SetCustomParamNamesChangedByUser] = React.useState<boolean>(false);
  const [customParamNames, setCustomParamNames] = React.useState<string[] | undefined>(() => {
    if (mapUrl) {
      return getCustomParamsMapping(mapUrl);
    }
    return undefined;
  });

  // 'isMounted' is used to prevent any async operation once the hook has been
  // unloaded.  Otherwise we get a 'Can't perform a React state update on an unmounted component.' warning in the console.
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [isSettingsStorageAvailable] = React.useState(MapLayersUI.iTwinConfig && props?.activeViewport?.iModel?.iTwinId);
  const [hasImodelContext] = React.useState(
    props?.activeViewport?.iModel?.iTwinId !== undefined &&
      props.activeViewport.iModel.iTwinId !== Guid.empty &&
      props?.activeViewport?.iModel?.iModelId !== undefined &&
      props?.activeViewport.iModel.iModelId !== Guid.empty,
  );

  const handleCancel = React.useCallback(() => {
    if (props.onCancelResult) {
      props.onCancelResult();
      return;
    }
  }, [props]);

  const onUsernameChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setUserName(event.target.value);
      if (invalidCredentialsProvided) {
        setInvalidCredentialsProvided(false);
      }
    },
    [setUserName, invalidCredentialsProvided, setInvalidCredentialsProvided],
  );

  const onPasswordChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(event.target.value);
      if (invalidCredentialsProvided) {
        setInvalidCredentialsProvided(false);
      }
    },
    [setPassword, invalidCredentialsProvided, setInvalidCredentialsProvided],
  );

  const handleArcGisLogin = React.useCallback(() => {
    setLayerAuthPending(true);
    setShowOauthPopup(true);
    if (oauthProcessSucceeded === false) {
      setOAuthProcessSucceeded(undefined);
    }
  }, [oauthProcessSucceeded]);

  // return true if authorization is needed
  const updateAuthState = React.useCallback(
    async (source: MapLayerSource, sourceValidation: MapLayerSourceValidation) => {
      const sourceRequireAuth = sourceValidation.status === MapLayerSourceStatus.RequireAuth;
      let invalidCredentials = sourceValidation.status === MapLayerSourceStatus.InvalidCredentials;
      if (sourceRequireAuth) {
        let hasTokenEndPoint = false;
        const settings = source.toLayerSettings();

        if (accessClient !== undefined && accessClient.getTokenServiceEndPoint !== undefined && settings !== undefined) {
          try {
            const tokenEndpoint = await accessClient.getTokenServiceEndPoint(settings.url);
            if (tokenEndpoint !== undefined) {
              const loginUrl = tokenEndpoint.getLoginUrl();
              setExternalLoginUrl(loginUrl);
              hasTokenEndPoint = true;
            }
          } catch (_error) {}
        } else if (userName.length > 0 || password.length > 0) {
          // This is a patch until @itwin\core-frontend return the expected 'InvalidCredentials' status.
          invalidCredentials = true;
        }

        if (!hasTokenEndPoint && (userName.length > 0 || password.length > 0)) {
          // This is a patch until @itwin\core-frontend return the expected 'InvalidCredentials' status.
          invalidCredentials = true;
        }
      }
      setServerRequireCredentials(sourceRequireAuth || invalidCredentials);
      if (invalidCredentials) {
        setInvalidCredentialsProvided(true);
      } else if (invalidCredentialsProvided) {
        setInvalidCredentialsProvided(false); // flag reset
      }

      return sourceRequireAuth || invalidCredentials;
    },
    [accessClient, invalidCredentialsProvided, password.length, userName.length],
  );

  const onNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMapName(event.target.value);
  }, []);

  const onRadioChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSettingsStorageRadio(event.target.value);
    },
    [setSettingsStorageRadio],
  );

  const onUrlChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setMapUrl(value);

      if (!customParamNamesChangedByUser) {
        if (value === "") {
          setCustomParamNames(undefined);
        } else {
          const paramNames = getCustomParamsMapping(value);
          setCustomParamNames(paramNames);
        }
      }
    },
    [getCustomParamsMapping, customParamNamesChangedByUser],
  );

  const createSource = React.useCallback(
    (url: string) => {
      let source: MapLayerSource | undefined;
      if (url && mapName) {
        source = MapLayerSource.fromJSON({ url, name: mapName, formatId: mapType });

        // Set credentials separately since they are not part of JSON
        if (source) {
          source.userName = userName || undefined; // When there is no value, empty string is always returned, in this case force it to undefined,
          source.password = password || undefined;

          if (customParamNames) {
            CustomParamUtils.setSourceCustomParams(source, customParamNames);
          }
        }
      }
      return source;
    },
    [customParamNames, mapName, mapType, password, userName],
  );

  const handleOk = React.useCallback(() => {
    const mapUrlLow = mapUrl.toLowerCase();
    // Append 'https://' if url is missing scheme
    let url = mapUrl;
    if (!mapUrlLow.startsWith(URL_SCHEMES.http) && !mapUrlLow.startsWith(URL_SCHEMES.https)) {
      url = `${URL_SCHEMES.https}${mapUrl}`;
      setMapUrl(url);
    }

    const source = createSource(url);
    if (source === undefined || props.mapLayerSourceToEdit) {
      onOkResult();

      if (source === undefined) {
        // Close the dialog and inform end user something went wrong.
        const msgError = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerLayerSourceCreationFailed");
        const msg = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachError", { error: msgError, sourceName: mapName });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        return;
      }

      // Store custom params mapping
      if (customParamNames) {
        const cpmStorage = new CustomParamsMappingStorage();
        cpmStorage.save(url.toLowerCase(), { customParamNames });
      }

      // Simply change the source definition in the setting service
      if (props.mapLayerSourceToEdit !== undefined) {
        // Apply changes to original source object
        props.mapLayerSourceToEdit.savedQueryParams = { ...source.savedQueryParams };
        props.mapLayerSourceToEdit.unsavedQueryParams = { ...source.unsavedQueryParams };

        const vp = props.activeViewport;
        void (async () => {
          if (isSettingsStorageAvailable && vp?.iModel?.iTwinId) {
            try {
              await MapLayerPreferences.replaceSource(props.mapLayerSourceToEdit!, source, vp.iModel.iTwinId, vp?.iModel.iModelId);
            } catch (err: any) {
              const errorMessage = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayerEditError", {
                layerName: props.mapLayerSourceToEdit?.name,
              });
              IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, errorMessage));
              return;
            }
          }
        })();
        return;
      }
    }

    // Attach source asynchronously.
    void (async () => {
      try {
        setLayerAttachPending(true);
        const validation = await source.validateSource(true);

        if (isMounted.current) {
          setLayerAttachPending(false);
        }

        if (validation.status === MapLayerSourceStatus.Valid) {
          // Update service settings if storage is available and we are not prompting user for credentials
          if (isSettingsStorageAvailable && !props.signInModeArgs) {
            const storeOnIModel = hasImodelContext ? "Model" === settingsStorage : undefined;
            const vp = props.activeViewport;
            if (vp?.iModel.iTwinId && !(await MapLayerPreferences.storeSource(source, vp.iModel.iTwinId, vp.iModel.iModelId, storeOnIModel))) {
              const msgError = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerPreferencesStoreFailed");
              IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msgError));
            }
          }

          // Link an API key to this map-layer URL
          const customParamIdx: { [key: string]: string } = {};
          const privateCustomParamIdx: { [key: string]: string } = {};
          if (customParamNames && customParamNames.length > 0) {
            // Link the map-layers URL custom params.
            const cpmStorage = new CustomParamsMappingStorage();
            cpmStorage.save(url.toLowerCase(), { customParamNames });

            const cpStorage = new CustomParamsStorage();
            customParamNames.forEach((customParamName) => {
              const items = cpStorage.get(customParamName);
              if (items && !Array.isArray(items)) {
                (items.secret ? privateCustomParamIdx : customParamIdx)[items.key] = items.value;
              }
            });
          }

          onOkResult({ source, validation, customParamIdx, privateCustomParamIdx });
        } else if (validation.status === MapLayerSourceStatus.InvalidCoordinateSystem) {
          const msg = MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.InvalidCoordinateSystem");
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
          onOkResult({ source, validation });
        } else if (validation.status === MapLayerSourceStatus.IncompatibleFormat) {
          setIncompatibleFormat(true);
        } else {
          const authNeeded = await updateAuthState(source, validation);
          if (!authNeeded) {
            const msg = MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.ValidationError");
            IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `${msg} ${source.url}`));
            onOkResult({ source, validation });
          }
        }
      } catch (error) {
        const msg = MapLayersUI.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachError", { error, sourceName: source.name });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
        onOkResult();
      }
    })();
  }, [
    mapUrl,
    createSource,
    props.mapLayerSourceToEdit,
    props.activeViewport,
    props.signInModeArgs,
    onOkResult,
    customParamNames,
    mapName,
    isSettingsStorageAvailable,
    hasImodelContext,
    settingsStorage,
    updateAuthState,
  ]);

  React.useEffect(() => {
    const handleOAuthProcessEnd = (success: boolean, _state: any) => {
      onOauthProcessEnd.raiseEvent(success, _state);
    };

    const ac = IModelApp.mapLayerFormatRegistry.getAccessClient(mapType);
    if (ac?.onOAuthProcessEnd) {
      setAccessClient(ac); // cache it, so we don't need to make another lookup;
      ac.onOAuthProcessEnd.addListener(handleOAuthProcessEnd);
    }
    setAccessClientInitialized(true);
    return () => {
      if (ac?.onOAuthProcessEnd) {
        ac.onOAuthProcessEnd.removeListener(handleOAuthProcessEnd);
      }

      setAccessClient(undefined);
      setAccessClientInitialized(false);
    };
  }, [mapType, onOauthProcessEnd, setAccessClient]);

  const resetSignInState = React.useCallback(() => {
    setServerRequireCredentials(false);
    setInvalidCredentialsProvided(false);
    setShowOauthPopup(false);
    setOAuthProcessSucceeded(undefined);
    setExternalLoginUrl(undefined);
  }, []);

  // After a map type chang(or setting a new custom query Parameter), make sure the different Oauth states are reset.
  React.useEffect(() => {
    resetSignInState();
  }, [mapType, resetSignInState]);

  // After a map type change, make sure the different Oauth states are reset.
  React.useEffect(() => {
    setIncompatibleFormat(false);
  }, [mapType, mapUrl]);

  // The first time the dialog is loaded and we already know the layer requires auth. (i.e ImageryProvider already made an attempt)
  // makes a request to discover the authentification types and adjust UI accordingly (i.e. username/password fields, Oauth popup)
  // Without this effect, user would have to manually click the 'OK' button in order to trigger the layer connection.
  React.useEffect(() => {
    // Attach source asynchronously.
    void (async () => {
      if (isAccessClientInitialized && shouldAutoAttachSource && props.signInModeArgs !== undefined) {
        try {
          let source = props.signInModeArgs.source;
          let validation = props.signInModeArgs.validation;
          if (!source || !validation) {
            // In some cases we don't know why the layer failed to attach, so we need to go through validation process
            source = MapLayerSource.fromJSON({
              url: props.signInModeArgs.layer.url,
              name: props.signInModeArgs.layer.name,
              formatId: props.signInModeArgs.layer.formatId,
            });

            if (source !== undefined) {
              if (props.signInModeArgs.layer.savedQueryParams) {
                source.savedQueryParams = { ...props.signInModeArgs.layer.savedQueryParams };
              }
              if (props.signInModeArgs.layer.unsavedQueryParams) {
                source.unsavedQueryParams = { ...props.signInModeArgs.layer.unsavedQueryParams };
              }

              setLayerAttachPending(true);

              validation = await source.validateSource(true);
              if (isMounted.current) {
                setLayerAttachPending(false);
              }
            }
          }
          if (source && validation) {
            setShouldAutoAttachSource(false);
            await updateAuthState(source, validation);
          }
        } catch (_error) {}
      }
    })();
  }, [isAccessClientInitialized, props.signInModeArgs, shouldAutoAttachSource, updateAuthState]);

  const dialogContainer = React.useRef<HTMLDivElement>(null);

  const readyToSave = React.useCallback(() => {
    const credentialsSet = !!userName && !!password;
    const ready =
      !!mapUrl &&
      !!mapName &&
      !layerAttachPending &&
      (!serverRequireCredentials || credentialsSet) &&
      !invalidCredentialsProvided &&
      !incompatibleFormat &&
      (externalLoginUrl === undefined || (externalLoginUrl !== undefined && oauthProcessSucceeded));
    return ready;
  }, [
    userName,
    password,
    mapUrl,
    mapName,
    layerAttachPending,
    serverRequireCredentials,
    invalidCredentialsProvided,
    incompatibleFormat,
    externalLoginUrl,
    oauthProcessSucceeded,
  ]);

  const handleOnKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // eslint-disable-next-line deprecation/deprecation
      if (event.key === SpecialKey.Enter) {
        if (readyToSave()) {
          handleOk();
        }
      }
    },
    [handleOk, readyToSave],
  );

  // onOauthProcessEnd events handler
  React.useEffect(() => {
    const handleOauthProcess = (success: boolean, _state: any) => {
      setLayerAuthPending(false);
      if (success) {
        setOAuthProcessSucceeded(true);
        setShowOauthPopup(false);
        setLayerAttachPending(false);
        handleOk(); // Add the layer the same way the user would do by clicking 'ok'
      } else {
        setShowOauthPopup(false);
        setLayerAttachPending(false);
        setOAuthProcessSucceeded(false);
      }
    };

    onOauthProcessEnd.addListener(handleOauthProcess);
    return () => {
      onOauthProcessEnd.removeListener(handleOauthProcess);
    };
  }, [handleOk, onOauthProcessEnd]);

  //
  // Monitors authentication method changes
  React.useEffect(() => {
    if (serverRequireCredentials && oauthProcessSucceeded === undefined && externalLoginUrl !== undefined) {
      handleArcGisLogin();
    }
  }, [oauthProcessSucceeded, externalLoginUrl, handleArcGisLogin, serverRequireCredentials]);

  // Monitors Oauth2 popup was closed
  const handleOAuthPopupClose = React.useCallback(() => {
    setShowOauthPopup(false);
    setLayerAuthPending(false);
    if (oauthProcessSucceeded === undefined) {
      setOAuthProcessSucceeded(false);
    } // indicates there was a failed attempt
  }, [oauthProcessSucceeded]);

  // Utility function to get warning message section
  function renderWarningMessage(): React.ReactNode {
    let warningMessage: string | undefined;

    // Get the proper warning message
    if (showOauthPopup) {
      warningMessage = externalLoginWaitingMsg;
    } else if (oauthProcessSucceeded === false) {
      warningMessage = externalLoginFailedMsg;
    } else if (oauthProcessSucceeded === true) {
      warningMessage = externalLoginSucceededMsg;
    } else if (invalidCredentialsProvided) {
      warningMessage = invalidCredentialsLabel;
    } else if (serverRequireCredentials && (!userName || !password)) {
      warningMessage = missingCredentialsLabel;
    }

    // Sometimes we want to add an extra node, such as a button
    let extraNode: React.ReactNode;
    if (oauthProcessSucceeded === false) {
      extraNode = (
        <div>
          <Button onClick={handleArcGisLogin}>{externalLoginTryAgainLabel}</Button>
        </div>
      );
    }

    if (warningMessage !== undefined) {
      return (
        <div className="map-layer-source-warnMessage">
          <Icon size="small">
            <SvgStatusWarning></SvgStatusWarning>
          </Icon>
          <span className="map-layer-source-warnMessage-label">{warningMessage}</span>
          {extraNode}
        </div>
      );
    } else {
      return <span className="map-layer-source-placeholder">&nbsp;</span>;
    }
  }

  // Use a hook to display the popup.
  // The display of the popup is controlled by the 'showOauthPopup' state variable.
  useCrossOriginPopup(showOauthPopup, externalLoginUrl, externalLoginTitle, 450, 450, handleOAuthPopupClose);

  function getFooter() {
    return (
      <div className="map-layer-source-footer">
        <div className="map-layer-source-footer-status" />
        <div>
          <Button className="map-layer-features-footer-button" styleType="high-visibility" onClick={handleOk} disabled={!readyToSave()}>
            {props?.mapLayerSourceToEdit ? MapLayersUI.translate("Dialog.Edit") : MapLayersUI.translate("Dialog.Add")}
          </Button>
          <Button className="map-layer-source-footer-button" styleType="default" onClick={handleCancel}>
            {MapLayersUI.translate("Dialog.Cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={dialogContainer}>
      <Dialog
        className="map-layer-url-dialog"
        title={dialogTitle}
        opened={true}
        resizable={true}
        movable={true}
        modal={true}
        footer={getFooter()}
        onClose={handleCancel}
        onEscape={handleCancel}
        minHeight={120}
        maxWidth={600}
        titleStyle={{ paddingLeft: "10px" }}
        footerStyle={{ paddingBottom: "10px", paddingRight: "10px" }}
        trapFocus={false}
      >
        <div className="map-layer-url-dialog-content">
          <div className="map-layer-source-url">
            <span className="map-layer-source-label">{typeLabel}</span>
            <SelectMapFormat
              value={mapType}
              disabled={props.signInModeArgs !== undefined || props.mapLayerSourceToEdit !== undefined || layerAttachPending || layerAuthPending}
              onChange={setMapType}
              mapTypesOptions={mapLayerOptions?.mapTypeOptions}
              status={incompatibleFormat ? "warning" : undefined}
              message={incompatibleFormat ? MapLayersUI.translate("CustomAttach.InvalidType") : undefined}
            />
            <span className="map-layer-source-label">{nameLabel}</span>
            <Input
              className="map-layer-source-input"
              placeholder={nameInputPlaceHolder}
              onChange={onNameChange}
              value={mapName}
              disabled={!!props.signInModeArgs || layerAttachPending || layerAuthPending}
            />
            <span className="map-layer-source-label">{urlLabel}</span>
            <Input
              className="map-layer-source-input"
              placeholder={urlInputPlaceHolder}
              onKeyPress={handleOnKeyDown}
              onChange={onUrlChange}
              disabled={!!props.signInModeArgs || props.mapLayerSourceToEdit !== undefined || layerAttachPending || layerAuthPending}
              value={mapUrl}
            />
            <span className="map-layer-source-label">
              {MapLayersUI.translate("CustomAttach.CustomParamsLabel")}
              <div title={MapLayersUI.translate("Labels.TechPreviewBadgeTooltip")} className="map-layer-source-previewBadge-icon">
                <Icon size="small">
                  <SvgTechnicalPreviewMini />
                </Icon>
              </div>
            </span>
            <SelectCustomParam
              value={customParamNames}
              disabled={layerAttachPending || layerAuthPending}
              onChange={(paramNames) => {
                setCustomParamNames(paramNames);
                SetCustomParamNamesChangedByUser(true);
                resetSignInState();
              }}
            />

            {serverRequireCredentials &&
              externalLoginUrl === undefined && // external login is handled in popup
              props.mapLayerSourceToEdit === undefined && (
                <>
                  <span className="map-layer-source-label">{userNameLabel}</span>
                  <LabeledInput
                    className="map-layer-source-input"
                    displayStyle="inline"
                    placeholder={serverRequireCredentials ? userNameRequiredLabel : userNameLabel}
                    status={(!userName && serverRequireCredentials) || invalidCredentialsProvided ? "warning" : undefined}
                    disabled={layerAttachPending || layerAuthPending}
                    onChange={onUsernameChange}
                    value={userName}
                    size="small"
                  />

                  <span className="map-layer-source-label">{passwordLabel}</span>
                  <LabeledInput
                    className="map-layer-source-input"
                    displayStyle="inline"
                    type="password"
                    placeholder={serverRequireCredentials ? passwordRequiredLabel : passwordLabel}
                    status={(!password && serverRequireCredentials) || invalidCredentialsProvided ? "warning" : undefined}
                    disabled={layerAttachPending || layerAuthPending}
                    onChange={onPasswordChange}
                    onKeyPress={handleOnKeyDown}
                    value={password}
                    size="small"
                  />
                </>
              )}

            {/* Store settings options, not shown when editing a layer */}
            {!props.signInModeArgs && !props.mapLayerSourceToEdit && (
              <div title={!isSettingsStorageAvailable ? noSaveSettingsWarning : ""}>
                {hasImodelContext && mapLayerOptions?.showUserPreferencesStorageOptions && (
                  <UserPreferencesStorageOptions
                    disabled={!isSettingsStorageAvailable}
                    itwinChecked={settingsStorage === "iTwin"}
                    modelChecked={settingsStorage === "Model"}
                    onChange={onRadioChange}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Warning message */}
        {renderWarningMessage()}

        {/* Progress bar */}
        {(layerAttachPending || layerAuthPending) && (
          <div className="map-layer-source-progressBar">
            <ProgressLinear indeterminate />
          </div>
        )}
      </Dialog>
    </div>
  );
}

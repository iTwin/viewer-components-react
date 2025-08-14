/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { SchemaFormatsProvider, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { FrontendDevTools } from "@itwin/frontend-devtools";
import { ArcGisAccessClient } from "@itwin/map-layers-auth";
import { Viewer as WebViewer } from "@itwin/web-viewer-react";
import { unifiedSelectionStorage } from "../SelectionStorage";
import { getUiProvidersConfig } from "../UiProvidersConfig";
import { ApiKeys } from "./ApiKeys";
import { useAuthorizationContext } from "./Authorization";
import { statusBarActionsProvider, ViewerOptionsProvider } from "./ViewerOptions";

import type { UiProvidersConfig } from "../UiProvidersConfig";

export function Viewer() {
  return (
    <ViewerOptionsProvider>
      <ViewerWithOptions />
    </ViewerOptionsProvider>
  );
}

function ViewerWithOptions() {
  const { client: authClient } = useAuthorizationContext();
  const { iTwinId, iModelId } = useIModelInfo();
  const [uiConfig, setUiConfig] = useState<UiProvidersConfig | undefined>();

  const onIModelAppInit = useCallback(async () => {
    const providersConfig = getUiProvidersConfig();
    await providersConfig.initialize();
    await FrontendDevTools.initialize();
    // ArcGIS Oauth setup
    const accessClient = new ArcGisAccessClient();
    accessClient.initialize({
      redirectUri: "http://localhost:3000/esri-oauth2-callback",
      clientIds: {
        arcgisOnlineClientId: import.meta.env.IMJS_AUTH_ARCGIS_CLIENT_ID,
        enterpriseClientIds: [{ serviceBaseUrl: "", clientId: "Bentley_TestApp" }],
      },
    });

    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", accessClient);
    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGISFeature", accessClient);
    setUiConfig(providersConfig);
  }, []);

  if (!iTwinId || !iModelId) {
    return null;
  }

  return (
    <WebViewer
      iTwinId={iTwinId}
      iModelId={iModelId}
      authClient={authClient}
      enablePerformanceMonitors={false}
      onIModelAppInit={onIModelAppInit}
      // Only set providers once IModelAppInit has fired, otherwise map-layers objects will fail to initialize
      uiProviders={uiConfig ? [...uiConfig.getUiItemsProviders(), statusBarActionsProvider] : []}
      defaultUiConfig={{
        hideNavigationAid: false,
        hideStatusBar: false,
        hideToolSettings: false,
      }}
      mapLayerOptions={{
        BingMaps: { key: "key", value: ApiKeys.BingMapsKey },
        GoogleMaps: { key: "key", value: ApiKeys.GoogleMapsKey },
      }}
      tileAdmin={{ cesiumIonKey: ApiKeys.CesiumKey }}
      backendConfiguration={{
        defaultBackend: {
          rpcInterfaces: [ECSchemaRpcInterface],
        },
      }}
      onIModelConnected={onIModelConnected}
      presentationProps={{
        selection: {
          selectionStorage: unifiedSelectionStorage,
        },
      }}
    />
  );
}

function onIModelConnected(imodel: IModelConnection) {
  const setupFormatsProvider = async () => {
    try {
      // const schema = await imodel.schemaContext.getSchema(new SchemaKey("AecUnits", SchemaMatchType.Latest));
      // if (!schema) {
      //   throw new Error("AecUnits schema not found in iModel");
      // }

      const schemaFormatsProvider = new SchemaFormatsProvider(imodel.schemaContext, IModelApp.quantityFormatter.activeUnitSystem);
      const removeListener = IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.addListener((args) => {
        schemaFormatsProvider.unitSystem = args.system;
      });

      const schemaUnitsProvider = new SchemaUnitProvider(imodel.schemaContext);
      IModelApp.quantityFormatter.unitsProvider = schemaUnitsProvider;
      IModelApp.formatsProvider = schemaFormatsProvider;
      console.log("Registered SchemaFormatsProvider, SchemaUnitProvider");

      IModelConnection.onClose.addOnce(() => {
        removeListener();
        IModelApp.resetFormatsProvider();
        void IModelApp.quantityFormatter.resetToUseInternalUnitsProvider();
        console.log("Unregistered SchemaFormatsProvider, SchemaUnitProvider");
      });
    } catch (err) {
      console.error("Error while setting up formats provider:", err);
    }
  };

  // Only load a schema formats provider if the iModel has the AecUnits schema
  void setupFormatsProvider();
}

function useIModelInfo() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.has("iTwinId") && searchParams.has("iModelId")) {
      return;
    }

    if (!import.meta.env.IMJS_ITWIN_ID || !import.meta.env.IMJS_IMODEL_ID) {
      throw new Error(
        "Please add a valid iTwin ID and iModel ID in the .env file and restart the application or add it to the `iTwinId`/`iModelId` query parameter in the url and refresh the page. See the README for more information.",
      );
    }

    navigate(`/?iTwinId=${import.meta.env.IMJS_ITWIN_ID}&iModelId=${import.meta.env.IMJS_IMODEL_ID}`);
  }, [searchParams, navigate]);

  return {
    iTwinId: searchParams.get("iTwinId"),
    iModelId: searchParams.get("iModelId"),
  };
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { FrontendDevTools } from "@itwin/frontend-devtools";
import { ArcGisAccessClient } from "@itwin/map-layers-auth";
import { Viewer as WebViewer } from "@itwin/web-viewer-react";
import { unifiedSelectionStorage } from "../SelectionStorage";
import { getUiProvidersConfig } from "../UiProvidersConfig";
import { ApiKeys } from "./ApiKeys";
import { useAuthorizationContext } from "./Authorization";
import { statusBarActionsProvider, ViewerOptionsProvider } from "./ViewerOptions";

const uiConfig = getUiProvidersConfig();

async function onIModelAppInit() {
  await uiConfig.initialize();
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
}

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
      uiProviders={[...uiConfig.uiItemsProviders, statusBarActionsProvider]}
      defaultUiConfig={{
        hideNavigationAid: true,
        hideStatusBar: false,
        hideToolSettings: false,
      }}
      mapLayerOptions={{ BingMaps: { key: "key", value: ApiKeys.BingMapsKey } }}
      tileAdmin={{ cesiumIonKey: ApiKeys.CesiumKey }}
      theme="light"
      backendConfiguration={{
        defaultBackend: {
          config: {
            info: { title: "imodel/rpc", version: "v5" },
          },
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
  // need this temporarily for e2e tests, until a fix for https://github.com/iTwin/itwinjs-core/issues/7496 is consumed
  setTimeout(() => {
    IModelConnection.onOpen.raiseEvent(imodel);
  }, 1000);
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

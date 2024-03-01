/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { FrontendDevTools } from "@itwin/frontend-devtools";
import { ArcGisAccessClient } from "@itwin/map-layers-auth";
import { Viewer as WebViewer } from "@itwin/web-viewer-react";
import { history } from "../history";
import { getUiProvidersConfig } from "../UiProvidersConfig";
import { ApiKeys } from "./ApiKeys";
import { useAuthorizationContext } from "./Authorization";
import { ViewerOptionsProvider, ViewerOptionsUiItemsProvider, useViewerOptionsContext } from "./ViewerOptions";

const uiConfig = getUiProvidersConfig();

async function onIModelAppInit() {
  await uiConfig.initialize();
  await FrontendDevTools.initialize();
  // ArcGIS Oauth setup
  const accessClient = new ArcGisAccessClient();
  accessClient.initialize({
    redirectUri: "http://localhost:3000/esri-oauth2-callback",
    clientIds: {
      arcgisOnlineClientId: process.env.IMJS_AUTH_ARCGIS_CLIENT_ID,
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
  const optionsContext = useViewerOptionsContext();
  const optionsItemsProvider = new ViewerOptionsUiItemsProvider(optionsContext.setDensity);

  return (
    <WebViewer
      iTwinId={iTwinId ?? ""}
      iModelId={iModelId ?? ""}
      authClient={authClient}
      enablePerformanceMonitors={false}
      onIModelAppInit={onIModelAppInit}
      uiProviders={[...uiConfig.uiItemsProviders, optionsItemsProvider]}
      defaultUiConfig={{
        hideNavigationAid: true,
        hideStatusBar: false,
        hideToolSettings: true,
      }}
      mapLayerOptions={{ BingMaps: { key: "key", value: ApiKeys.BingMapsKey } }}
      tileAdmin={{ cesiumIonKey: ApiKeys.CesiumKey }}
      theme="os"
    />
  );
}

function useIModelInfo() {
  const [iModelId, setIModelId] = useState(process.env.IMJS_IMODEL_ID);
  const [iTwinId, setITwinId] = useState(process.env.IMJS_ITWIN_ID);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("iTwinId")) {
      setITwinId(urlParams.get("iTwinId") as string);
    } else {
      if (!process.env.IMJS_ITWIN_ID) {
        throw new Error(
          "Please add a valid iTwin ID in the .env file and restart the application or add it to the iTwinId query parameter in the url and refresh the page. See the README for more information.",
        );
      }
    }

    if (urlParams.has("iModelId")) {
      setIModelId(urlParams.get("iModelId") as string);
    }
  }, []);

  useEffect(() => {
    if (iTwinId) {
      let queryString = `?iTwinId=${iTwinId}`;
      if (iModelId) {
        queryString += `&iModelId=${iModelId}`;
      }

      history.push(queryString);
    }
  }, [iTwinId, iModelId]);

  return {
    iTwinId,
    iModelId,
  };
}

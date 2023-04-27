/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { FitViewTool, IModelApp, ScreenViewport, StandardViewId } from "@itwin/core-frontend";
import { Viewer as WebViewer, ViewerPerformance } from "@itwin/web-viewer-react";
import { history } from "../history";
import { getUiProvidersConfig } from "../UiProvidersConfig";
import { useAuthorizationContext } from "./Authorization";
import { ApiKeys } from "./ApiKeys";
import { FrontendDevTools } from "@itwin/frontend-devtools";
import { MapLayersFormats } from "@itwin/map-layers-formats";

const uiConfig = getUiProvidersConfig();

async function onIModelAppInit() {
  await uiConfig.initialize();
}

export function Viewer() {
  const { client: authClient } = useAuthorizationContext();
  const viewCreatorOptions = useViewCreatorOptions();
  const { iTwinId, iModelId } = useIModelInfo();

  return (
    <WebViewer
      iTwinId={iTwinId ?? ""}
      iModelId={iModelId ?? ""}
      authClient={authClient}
      viewCreatorOptions={viewCreatorOptions}
      enablePerformanceMonitors={false}
      onIModelAppInit={onIModelAppInit}
      uiProviders={[
        ...uiConfig.uiItemsProviders
      ]}
      defaultUiConfig={{
        hideNavigationAid: true,
        hideStatusBar: true,
        hideToolSettings: true
      }}
      mapLayerOptions={{ BingMaps: { key: "key", value: ApiKeys.BingMapsKey } }}
      tileAdmin={{ cesiumIonKey: ApiKeys.CesiumKey }}

    />
  );
}

function useViewCreatorOptions() {
  /** NOTE: This function will execute the "Fit View" tool after the iModel is loaded into the Viewer.
   * This will provide an "optimal" view of the model. However, it will override any default views that are
   * stored in the iModel. Delete this function and the prop that it is passed to if you prefer
   * to honor default views when they are present instead (the Viewer will still apply a similar function to iModels that do not have a default view).
   */
  const viewConfiguration = useCallback((viewPort: ScreenViewport) => {
    // default execute the fitview tool and use the iso standard view after tile trees are loaded
    const tileTreesLoaded = () => {
      return new Promise((resolve, reject) => {
        const start = new Date();
        const intvl = setInterval(() => {
          if (viewPort.areAllTileTreesLoaded) {
            ViewerPerformance.addMark("TilesLoaded");
            ViewerPerformance.addMeasure(
              "TileTreesLoaded",
              "ViewerStarting",
              "TilesLoaded"
            );
            clearInterval(intvl);
            resolve(true);
          }
          const now = new Date();
          // after 20 seconds, stop waiting and fit the view
          if (now.getTime() - start.getTime() > 20000) {
            reject();
          }
        }, 100);
      });
    };

    tileTreesLoaded().finally(() => {
      void IModelApp.tools.run(FitViewTool.toolId, viewPort, true, false);
      viewPort.view.setStandardRotation(StandardViewId.Iso);
    });
  }, []);

  return useMemo(
    () => ({ viewportConfigurer: viewConfiguration }),
    [viewConfiguration]
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
          "Please add a valid iTwin ID in the .env file and restart the application or add it to the iTwinId query parameter in the url and refresh the page. See the README for more information."
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

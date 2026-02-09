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
import { QuantityFormatting } from "@itwin/quantity-formatting-react";
import { ViewerStatusbarItemsProvider, Viewer as WebViewer } from "@itwin/web-viewer-react";
import { unifiedSelectionStorage } from "../SelectionStorage";
import { getUiProvidersConfig } from "../UiProvidersConfig";
import { ApiKeys } from "./ApiKeys";
import { useAuthorizationContext } from "./Authorization";
import { FormatManager } from "./quantity-formatting/FormatManager";
import { statusBarActionsProvider, ViewerOptionsProvider } from "./ViewerOptions";

import type { ComponentPropsWithoutRef } from "react";
import type { FormatSet } from "@itwin/ecschema-metadata";
import type { UiProvidersConfig } from "../UiProvidersConfig";

// Test format sets for development - added once at startup
const testFormatSets: FormatSet[] = [
  {
    name: "TestFormatSet1",
    label: "Arizona Highway Project (Civil)",
    unitSystem: "imperial",
    description:
      "This format set contains all the formatting standards used by civil engineers on the Arizona Highway Project. Includes units for measurements, coordinates, and construction materials.",
    formats: {},
  },
  {
    name: "TestFormatSet2",
    label: "Arizona Highway Project (Project Manager)",
    unitSystem: "imperial",
    description: "This format set contains all the formatting standards used by project managers on the Arizona Highway Project.",
    formats: {},
  },
  {
    name: "TestFormatSet3",
    label: "My personal format set",
    unitSystem: "metric",
    description: "Custom formatting preferences for individual use. Combines metric and imperial units based on personal workflow requirements.",
    formats: {},
  },
];

export function Viewer() {
  return (
    <ViewerOptionsProvider>
      <ViewerWithOptions />
    </ViewerOptionsProvider>
  );
}

function ViewerWithOptions() {
  const { client: authClient } = useAuthorizationContext();
  const { iTwinId, iModelId, changesetId } = useIModelInfo();
  const [uiConfig, setUiConfig] = useState<UiProvidersConfig | undefined>();

  const onIModelAppInit = useCallback(async () => {
    const providersConfig = getUiProvidersConfig();
    await providersConfig.initialize();
    await FrontendDevTools.initialize();
    await QuantityFormatting.startup();
    // Initialize FormatManager with test format sets
    await FormatManager.initialize(testFormatSets);
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
      changeSetId={changesetId}
      authClient={authClient}
      enablePerformanceMonitors={false}
      onIModelAppInit={onIModelAppInit}
      // Only set providers once IModelAppInit has fired, otherwise map-layers objects will fail to initialize
      uiProviders={
        uiConfig
          ? [...uiConfig.getUiItemsProviders(), new ViewerStatusbarItemsProvider({ selectionScope: true, selectionInfo: true }), statusBarActionsProvider]
          : []
      }
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
      selectionStorage={unifiedSelectionStorage}
      selectionScopes={selectionScopes}
    />
  );
}

const selectionScopes: ComponentPropsWithoutRef<typeof WebViewer>["selectionScopes"] = {
  available: {
    element: {
      def: { id: "element" },
      label: "Element",
    },
    assembly: {
      def: { id: "element", ancestorLevel: 1 },
      label: "Assembly",
    },
    "top-assembly": {
      def: { id: "element", ancestorLevel: 2 },
      label: "Top assembly",
    },
    model: {
      def: { id: "model" },
      label: "Model",
    },
    category: {
      def: { id: "category" },
      label: "Category",
    },
  },
  active: "element",
};

function onIModelConnected(imodel: IModelConnection) {
  const setupFormatsProvider = async () => {
    try {
      let removeListener: () => void | undefined;
      const schemaUnitsProvider = new SchemaUnitProvider(imodel.schemaContext);
      IModelApp.quantityFormatter.unitsProvider = schemaUnitsProvider;
      // FormatManager will handle assigning a FormatsProvider to IModelApp.formatsProvider, if not used then init a SchemaFormatsProvider here
      if (FormatManager.instance) {
        await FormatManager.instance?.onIModelOpen(imodel);
      } else {
        const schemaFormatsProvider = new SchemaFormatsProvider(imodel.schemaContext, IModelApp.quantityFormatter.activeUnitSystem);
        removeListener = IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.addListener((args) => {
          schemaFormatsProvider.unitSystem = args.system;
        });
        IModelApp.formatsProvider = schemaFormatsProvider;
      }
      IModelConnection.onClose.addOnce(() => {
        IModelApp.resetFormatsProvider();
        removeListener?.();
        void IModelApp.quantityFormatter.resetToUseInternalUnitsProvider();
        if (FormatManager.instance) void FormatManager.instance.onIModelClose();
        console.log("Unregistered SchemaFormatsProvider, SchemaUnitProvider");
      });
    } catch (err) {
      console.error("Error while setting up formats provider:", err);
    }
  };

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

    void navigate(
      `/?iTwinId=${import.meta.env.IMJS_ITWIN_ID}&iModelId=${import.meta.env.IMJS_IMODEL_ID}${import.meta.env.IMJS_IMODEL_CHANGESET_ID ? `&changesetId=${import.meta.env.IMJS_IMODEL_CHANGESET_ID}` : ""}`,
    );
  }, [searchParams, navigate]);

  return {
    iTwinId: searchParams.get("iTwinId"),
    iModelId: searchParams.get("iModelId"),
    changesetId: searchParams.get("changesetId") ?? undefined,
  };
}

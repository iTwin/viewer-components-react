/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UiItemsProvider } from "@itwin/appui-react";
import { TreeWidget, TreeWidgetUiItemsProvider } from "@itwin/tree-widget-react";
import { PropertyGridManager, PropertyGridUiItemsProvider } from "@itwin/property-grid-react";
import { MeasureTools, MeasureToolsUiItemsProvider, MeasurementActionToolbar } from "@itwin/measure-tools-react";
import { BreakdownTrees } from "@itwin/breakdown-trees-react";
import { SampleSpatialTree } from "./components/SampleSpatialTree";
import { MapLayersUI, MapLayersUiItemsProvider } from "@itwin/map-layers";
import { GeoTools, GeoToolsAddressSearchProvider } from "@itwin/geo-tools-react";

export interface UiProvidersConfig {
  initialize: () => Promise<void>;
  uiItemsProviders: UiItemsProvider[];
}

export function getUiProvidersConfig(): UiProvidersConfig {
  const enabledWidgets = process.env.IMJS_ENABLED_WIDGETS ?? "";
  const matchingItems = collectSupportedItems(enabledWidgets.split(" "));

  return {
    initialize: async () => {
      const promises = matchingItems.map((item) => item.initialize());
      await Promise.all(promises);
    },
    uiItemsProviders: matchingItems.map((item) => item.createUiItemsProvider()),
  };
}

function collectSupportedItems(ids: string[]) {
  const items: UiItem[] = [];
  for (const id of ids) {
    const configuredItem = configuredUiItems.get(id);
    if (!configuredItem) {
      console.warn(`Configuration not found for widget - '${id}'`);
      continue;
    }

    items.push(configuredItem);
  }
  return items;
}

interface UiItem {
  initialize: () => Promise<void>;
  createUiItemsProvider: () => UiItemsProvider;
}

const configuredUiItems = new Map<string, UiItem>([
  [
    "tree-widget",
    {
      initialize: async () => {
        await BreakdownTrees.initialize();
        await TreeWidget.initialize();
      },
      createUiItemsProvider: () => new TreeWidgetUiItemsProvider({
        additionalTrees: [{
          id: "spatial-containment-tree",
          label: "Spatial Containment",
          render: () => (
            <SampleSpatialTree />
          ),
        }]
      }),
    }
  ],
  [
    "property-grid",
    {
      initialize: async () => PropertyGridManager.initialize(),
      createUiItemsProvider: () => new PropertyGridUiItemsProvider(),
    }
  ],
  [
    "measure-tools",
    {
      initialize: async () => {
        await MeasureTools.startup();
        MeasurementActionToolbar.setDefaultActionProvider();
      },
      createUiItemsProvider: () => new MeasureToolsUiItemsProvider(),
    }
  ],
  [
    "map-layers",
    {
      initialize: async () => MapLayersUI.initialize(),
      createUiItemsProvider: () => new MapLayersUiItemsProvider(),
    }
  ],
  [
    "geo-tools",
    {
      initialize: async () => GeoTools.initialize(),
      createUiItemsProvider: () => new GeoToolsAddressSearchProvider(),
    }
  ]
])
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UiItemsProvider } from "@itwin/appui-react";
import { TreeWidget, TreeWidgetUiItemsProvider } from "@itwin/tree-widget-react";
import { PropertyGridManager, PropertyGridUiItemsProvider, createAddFavoritePropertyItemProvider, createCopyPropertyTextItemProvider, createRemoveFavoritePropertyItemProvider } from "@itwin/property-grid-react";
import { MeasureTools, MeasureToolsUiItemsProvider, MeasurementActionToolbar } from "@itwin/measure-tools-react";
import { BreakdownTrees } from "@itwin/breakdown-trees-react";
import { SampleSpatialTree } from "./components/SampleSpatialTree";
import { DefaultMapFeatureInfoTool, FeatureInfoUiItemsProvider, MapLayersUI, MapLayersUiItemsProvider } from "@itwin/map-layers";
import { GeoTools, GeoToolsAddressSearchProvider } from "@itwin/geo-tools-react";
import { MapLayersFormats } from "@itwin/map-layers-formats";

export interface UiProvidersConfig {
  initialize: () => Promise<void>;
  uiItemsProviders: UiItemsProvider[];
}

export function getUiProvidersConfig(): UiProvidersConfig {
  const enabledWidgets = process.env.IMJS_ENABLED_WIDGETS ?? "";
  const matchingItems = collectSupportedItems(enabledWidgets.split(" "));

  const uiItemsProviders = matchingItems.map((item) => item.createUiItemsProviders());

  return {
    initialize: async () => {
      const promises = matchingItems.map((item) => item.initialize());
      await Promise.all(promises);
    },
    uiItemsProviders: uiItemsProviders.flat(),
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
  createUiItemsProviders: () => UiItemsProvider[];
}

const configuredUiItems = new Map<string, UiItem>([
  [
    "tree-widget",
    {
      initialize: async () => {
        await BreakdownTrees.initialize();
        await TreeWidget.initialize();
      },
      createUiItemsProviders: () => [new TreeWidgetUiItemsProvider({
        additionalTrees: [{
          id: "spatial-containment-tree",
          label: "Spatial Containment",
          render: () => (
            <SampleSpatialTree />
          ),
        }]
      })],
    }
  ],
  [
    "property-grid",
    {
      initialize: async () => PropertyGridManager.initialize(),
      createUiItemsProviders: () => [new PropertyGridUiItemsProvider({
        propertyGridProps: {
          enableAncestorNavigation: true,
          autoExpandChildCategories: true,
          contextMenuItemProviders: [
            createAddFavoritePropertyItemProvider(),
            createRemoveFavoritePropertyItemProvider(),
            createCopyPropertyTextItemProvider(),
          ],
        }
      })],
    }
  ],
  [
    "measure-tools",
    {
      initialize: async () => {
        await MeasureTools.startup();
        MeasurementActionToolbar.setDefaultActionProvider();
      },
      createUiItemsProviders: () => [new MeasureToolsUiItemsProvider()],
    }
  ],
  [
    "map-layers",
    {
      initialize: async () => {
        await MapLayersFormats.initialize();
        await MapLayersUI.initialize();
      },
      createUiItemsProviders: () => [
        new MapLayersUiItemsProvider(),
        new FeatureInfoUiItemsProvider({ onMapHit: DefaultMapFeatureInfoTool.onMapHit })
      ]
    }
  ],
  [
    "geo-tools",
    {
      initialize: async () => { GeoTools.initialize() },
      createUiItemsProviders: () => [new GeoToolsAddressSearchProvider()],
    }
  ]
])
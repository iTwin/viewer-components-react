/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { UiItemsProvider } from "@itwin/appui-react";
import {
  CategoriesTreeComponent,
  ExternalSourcesTreeComponent,
  IModelContentTreeComponent,
  ModelsTreeComponent,
  TreeWidget,
  TreeWidgetUiItemsProvider,
} from "@itwin/tree-widget-react";
import {
  AddFavoritePropertyContextMenuItem,
  AncestorsNavigationControls,
  CopyPropertyTextContextMenuItem,
  PropertyGridManager,
  PropertyGridUiItemsProvider,
  RemoveFavoritePropertyContextMenuItem,
  ShowHideNullValuesSettingsMenuItem,
} from "@itwin/property-grid-react";
import { MeasureTools, MeasureToolsUiItemsProvider, MeasurementActionToolbar } from "@itwin/measure-tools-react";
import { BreakdownTrees } from "@itwin/breakdown-trees-react";
import { SampleSpatialTree } from "./components/SampleSpatialTree";
import { FeatureInfoUiItemsProvider, MapLayersPrefBrowserStorage, MapLayersUI, MapLayersUiItemsProvider } from "@itwin/map-layers";
import { GeoTools, GeoToolsAddressSearchProvider } from "@itwin/geo-tools-react";
import { MapLayersFormats } from "@itwin/map-layers-formats";
import { SelectionMode } from "@itwin/components-react";

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
      createUiItemsProviders: () => [
        new TreeWidgetUiItemsProvider({
          trees: [
            {
              id: ModelsTreeComponent.id,
              getLabel: ModelsTreeComponent.getLabel,
              render: () => <ModelsTreeComponent selectionPredicate={() => true} selectionMode={SelectionMode.Multiple} />,
            },
            {
              id: CategoriesTreeComponent.id,
              getLabel: CategoriesTreeComponent.getLabel,
              render: () => <CategoriesTreeComponent />,
            },
            {
              id: IModelContentTreeComponent.id,
              getLabel: IModelContentTreeComponent.getLabel,
              render: () => <IModelContentTreeComponent />,
            },
            {
              id: ExternalSourcesTreeComponent.id,
              getLabel: ExternalSourcesTreeComponent.getLabel,
              render: () => <ExternalSourcesTreeComponent />,
            },
            {
              id: "spatial-containment-tree",
              getLabel: () => "Spatial Containment",
              render: () => <SampleSpatialTree />,
            },
          ],
        }),
      ],
    },
  ],
  [
    "property-grid",
    {
      initialize: async () => PropertyGridManager.initialize(),
      createUiItemsProviders: () => [
        new PropertyGridUiItemsProvider({
          propertyGridProps: {
            autoExpandChildCategories: true,
            ancestorsNavigationControls: (props) => <AncestorsNavigationControls {...props} />,
            contextMenuItems: [
              (props) => <AddFavoritePropertyContextMenuItem {...props} />,
              (props) => <RemoveFavoritePropertyContextMenuItem {...props} />,
              (props) => <CopyPropertyTextContextMenuItem {...props} />,
            ],
            settingsMenuItems: [(props) => <ShowHideNullValuesSettingsMenuItem {...props} persist={true} />],
          },
        }),
      ],
    },
  ],
  [
    "measure-tools",
    {
      initialize: async () => {
        await MeasureTools.startup();
        MeasurementActionToolbar.setDefaultActionProvider();
      },
      createUiItemsProviders: () => [new MeasureToolsUiItemsProvider()],
    },
  ],
  [
    "map-layers",
    {
      initialize: async () => {
        await MapLayersFormats.initialize();
        await MapLayersUI.initialize({ iTwinConfig: new MapLayersPrefBrowserStorage() });
      },
      createUiItemsProviders: () => [new MapLayersUiItemsProvider(), new FeatureInfoUiItemsProvider({})],
    },
  ],
  [
    "geo-tools",
    {
      initialize: async () => {
        GeoTools.initialize();
      },
      createUiItemsProviders: () => [new GeoToolsAddressSearchProvider()],
    },
  ],
]);

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { UiItemsProvider } from "@itwin/appui-react";
import { BreakdownTrees } from "@itwin/breakdown-trees-react";
import { SelectionMode } from "@itwin/components-react";
import { EC3Provider } from "@itwin/ec3-widget-react";
import { GeoTools, GeoToolsAddressSearchProvider } from "@itwin/geo-tools-react";
import { ClientPrefix, GroupingMappingProvider } from "@itwin/grouping-mapping-widget";
import { FeatureInfoUiItemsProvider, MapLayersPrefBrowserStorage, MapLayersUI, MapLayersUiItemsProvider } from "@itwin/map-layers";
import { MapLayersFormats } from "@itwin/map-layers-formats";
import { MeasurementActionToolbar, MeasureTools, MeasureToolsUiItemsProvider } from "@itwin/measure-tools-react";
import { OneClickLCAProvider } from "@itwin/one-click-lca-react";
import {
  AddFavoritePropertyContextMenuItem, AncestorsNavigationControls, CopyPropertyTextContextMenuItem, PropertyGridManager, PropertyGridUiItemsProvider,
  RemoveFavoritePropertyContextMenuItem, ShowHideNullValuesSettingsMenuItem,
} from "@itwin/property-grid-react";
import { REPORTS_CONFIG_BASE_URL, ReportsConfigProvider, ReportsConfigWidget } from "@itwin/reports-config-widget-react";
import {
  CategoriesTreeComponent, ExternalSourcesTreeComponent, IModelContentTreeComponent, ModelsTreeComponent, TreeWidget, TreeWidgetOptions,
} from "@itwin/tree-widget-react";
import { SampleSpatialTree } from "./components/SampleSpatialTree";
import { TreeWidgetWithOptionsUiItemsProvider } from "./components/TreeWidgetWithOptionsUiItemsProvider";

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

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}api.bentley.com`);
  }
  return baseUrl;
};

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
        new TreeWidgetWithOptionsUiItemsProvider({
          trees: [
            {
              id: ModelsTreeComponent.id,
              getLabel: ModelsTreeComponent.getLabel,
              render: (density: "enlarged" | "default") => (
                <ModelsTreeComponent
                  selectionPredicate={() => true}
                  selectionMode={SelectionMode.Multiple}
                  hierarchyLevelConfig={{ isFilteringEnabled: true }}
                  density={density}
                />
              ),
            },
            {
              id: CategoriesTreeComponent.id,
              getLabel: CategoriesTreeComponent.getLabel,
              render: (density: "enlarged" | "default") => <CategoriesTreeComponent hierarchyLevelConfig={{ isFilteringEnabled: true }} density={density} />,
            },
            {
              id: IModelContentTreeComponent.id,
              getLabel: IModelContentTreeComponent.getLabel,
              render: (density: "enlarged" | "default") => <IModelContentTreeComponent hierarchyLevelConfig={{ isFilteringEnabled: true }} density={density} />,
            },
            {
              id: ExternalSourcesTreeComponent.id,
              getLabel: ExternalSourcesTreeComponent.getLabel,
              render: (density: "enlarged" | "default") => <ExternalSourcesTreeComponent hierarchyLevelConfig={{ isFilteringEnabled: true }} density={density} />,
            },
            {
              id: "spatial-containment-tree",
              getLabel: () => "Spatial Containment",
              render: () => <SampleSpatialTree />,
            },
          ],
        } as TreeWidgetOptions),
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
  [
    "grouping-mapping-widget",
    {
      initialize: async () => Promise.resolve(),
      createUiItemsProviders: () => [new GroupingMappingProvider({ prefix: `${process.env.IMJS_URL_PREFIX}`.slice(0, -1) as ClientPrefix })],
    },
  ],
  [
    "reports-config-widget",
    {
      initialize: async () => { await ReportsConfigWidget.initialize() },
      createUiItemsProviders: () => [new ReportsConfigProvider(
        undefined,
        prefixUrl(REPORTS_CONFIG_BASE_URL, process.env.IMJS_URL_PREFIX)
      )],
    },
  ],
  [
    "ec3-widget",
    {
      initialize: async () => Promise.resolve(),
      createUiItemsProviders: () => [new EC3Provider({
        clientId: process.env.IMJS_EC3_PORTAL_AUTH_CLIENT_ID ?? "",
        redirectUri:
          process.env.IMJS_EC3_PORTAL_AUTH_CLIENT_REDIRECT_URI ?? "",
        reportingBasePath: prefixUrl(REPORTS_CONFIG_BASE_URL, process.env.IMJS_URL_PREFIX),
        carbonCalculationBasePath: prefixUrl(REPORTS_CONFIG_BASE_URL, process.env.IMJS_URL_PREFIX),
      })],
    },
  ],
  [
    "one-click-lca-widget",
    {
      initialize: async () => Promise.resolve(),
      createUiItemsProviders: () => [new OneClickLCAProvider()],
    },
  ],
]);

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { StagePanelLocation, StagePanelSection } from "@itwin/appui-react";
import { EC3Provider, EC3Widget } from "@itwin/ec3-widget-react";
import { GeoTools, GeoToolsAddressSearchProvider } from "@itwin/geo-tools-react";
import { GroupingMappingProvider } from "@itwin/grouping-mapping-widget";
import { SvgHierarchyTree } from "@itwin/itwinui-icons-react";
import { FeatureInfoUiItemsProvider, MapLayersPrefBrowserStorage, MapLayersUI, MapLayersUiItemsProvider } from "@itwin/map-layers";
import { MapLayersFormats } from "@itwin/map-layers-formats";
import { MeasurementActionToolbar, MeasureTools, MeasureToolsUiItemsProvider } from "@itwin/measure-tools-react";
import { OneClickLCAProvider } from "@itwin/one-click-lca-react";
import {
  AddFavoritePropertyContextMenuItem,
  AncestorsNavigationControls,
  CopyPropertyTextContextMenuItem,
  createPropertyGrid,
  PropertyGridManager,
  RemoveFavoritePropertyContextMenuItem,
  ShowHideNullValuesSettingsMenuItem,
} from "@itwin/property-grid-react";
import { REPORTS_CONFIG_BASE_URL, ReportsConfigProvider, ReportsConfigWidget } from "@itwin/reports-config-widget-react";
import {
  CategoriesTreeComponent,
  ExternalSourcesTreeComponent,
  IModelContentTreeComponent,
  ModelsTreeComponent,
  TreeWidget,
  TreeWidgetComponent,
} from "@itwin/tree-widget-react";
import { createLayersUiProvider, initializeLayers } from "./components/LayersWidget";
import { RepositoriesTreeComponent } from "./components/repositories-tree/RepositoriesTree";
import { useViewerOptionsContext } from "./components/ViewerOptions";
import { getSchemaContext } from "./SchemaContext";
import { unifiedSelectionStorage } from "./SelectionStorage";

import type { ComponentProps } from "react";
import type { TreeDefinition } from "@itwin/tree-widget-react";
import type { ClientPrefix } from "@itwin/grouping-mapping-widget";
import type { UiItemsProvider } from "@itwin/appui-react";
export interface UiProvidersConfig {
  initialize: () => Promise<void>;
  uiItemsProviders: UiItemsProvider[];
}

export function getUiProvidersConfig(): UiProvidersConfig {
  const enabledWidgets = new URLSearchParams(document.location.href).get("widgets") ?? import.meta.env.IMJS_ENABLED_WIDGETS ?? undefined;
  const matchingItems = enabledWidgets ? collectSupportedItems(enabledWidgets.split(/[\s;]/)) : [...configuredUiItems.values()];
  return {
    initialize: async () => {
      const promises = matchingItems.map(async (item) => item.initialize());
      await Promise.all(promises);
    },
    uiItemsProviders: matchingItems.flatMap((item) => item.createUiItemsProviders()),
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
        await TreeWidget.initialize();
      },
      createUiItemsProviders: () => [
        {
          id: "TreeWidgetUIProvider",
          getWidgets: () => {
            const trees: TreeDefinition[] = [
              {
                id: ModelsTreeComponent.id,
                getLabel: () => ModelsTreeComponent.getLabel(),
                isSearchable: true,
                render: (props) => (
                  <ModelsTreeWithOptions
                    getSchemaContext={getSchemaContext}
                    hierarchyConfig={{
                      hideRootSubject: true,
                    }}
                    filter={props.filter}
                    selectionStorage={unifiedSelectionStorage}
                    selectionMode={"extended"}
                    onPerformanceMeasured={props.onPerformanceMeasured}
                    onFeatureUsed={props.onFeatureUsed}
                  />
                ),
              },
              {
                id: CategoriesTreeComponent.id,
                getLabel: () => CategoriesTreeComponent.getLabel(),
                isSearchable: true,
                render: (props) => (
                  <CategoriesTreeComponent
                    filter={props.filter}
                    getSchemaContext={getSchemaContext}
                    selectionStorage={unifiedSelectionStorage}
                    onPerformanceMeasured={props.onPerformanceMeasured}
                    onFeatureUsed={props.onFeatureUsed}
                  />
                ),
              },
              {
                id: IModelContentTreeComponent.id,
                getLabel: () => IModelContentTreeComponent.getLabel(),
                isSearchable: true,
                render: (props) => (
                  <IModelContentTreeComponent
                    getSchemaContext={getSchemaContext}
                    hierarchyConfig={{
                      hideRootSubject: true,
                    }}
                    selectionStorage={unifiedSelectionStorage}
                    onPerformanceMeasured={props.onPerformanceMeasured}
                    onFeatureUsed={props.onFeatureUsed}
                  />
                ),
              },
              {
                id: ExternalSourcesTreeComponent.id,
                getLabel: () => ExternalSourcesTreeComponent.getLabel(),
                isSearchable: true,
                render: (props) => (
                  <ExternalSourcesTreeComponent
                    getSchemaContext={getSchemaContext}
                    selectionStorage={unifiedSelectionStorage}
                    onPerformanceMeasured={props.onPerformanceMeasured}
                    onFeatureUsed={props.onFeatureUsed}
                  />
                ),
              },
              {
                id: "RepositoriesTree",
                getLabel: () => "Repositories tree",
                isSearchable: true,
                render: () => <RepositoriesTreeComponent baseUrl={`https://${globalThis.IMJS_URL_PREFIX ?? ""}api.bentley.com`} />,
              },
            ];
            return [
              {
                id: "tree-widget",
                label: TreeWidget.translate("widget.label"),
                icon: <SvgHierarchyTree />,
                layouts: {
                  standard: {
                    section: StagePanelSection.Start,
                    location: StagePanelLocation.Right,
                  },
                },
                content: <TreeWidgetWithOptions trees={trees} />,
              },
            ];
          },
        },
      ],
    },
  ],
  [
    "property-grid",
    {
      initialize: async () => PropertyGridManager.initialize(),
      createUiItemsProviders: () => [
        {
          id: "PropertyGridUIProvider",
          getWidgets: () => {
            return [
              createPropertyGrid({
                autoExpandChildCategories: true,
                ancestorsNavigationControls: (props) => <AncestorsNavigationControls {...props} />,
                contextMenuItems: [
                  (props) => <AddFavoritePropertyContextMenuItem {...props} />,
                  (props) => <RemoveFavoritePropertyContextMenuItem {...props} />,
                  (props) => <CopyPropertyTextContextMenuItem {...props} />,
                ],
                settingsMenuItems: [(props) => <ShowHideNullValuesSettingsMenuItem {...props} persist={true} />],
                onPerformanceMeasured: (feature, elapsedTime) => {
                  console.log(`PropertyGrid [${feature}] took ${elapsedTime} ms`);
                },
                onFeatureUsed: (feature) => {
                  console.log(`PropertyGrid [${feature}] used`);
                },
                selectionStorage: unifiedSelectionStorage,
              }),
            ];
          },
        },
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
        await GeoTools.initialize();
      },
      createUiItemsProviders: () => [new GeoToolsAddressSearchProvider()],
    },
  ],
  [
    "grouping-mapping-widget",
    {
      initialize: async () => Promise.resolve(),
      createUiItemsProviders: () => [
        new GroupingMappingProvider({
          prefix: import.meta.env.IMJS_URL_PREFIX ? (`${import.meta.env.IMJS_URL_PREFIX}`.slice(0, -1) as ClientPrefix) : undefined,
        }),
      ],
    },
  ],
  [
    "reports-config-widget",
    {
      initialize: async () => {
        await ReportsConfigWidget.initialize();
      },
      createUiItemsProviders: () => [new ReportsConfigProvider({ baseUrl: prefixUrl(REPORTS_CONFIG_BASE_URL, import.meta.env.IMJS_URL_PREFIX) })],
    },
  ],
  [
    "ec3-widget",
    {
      initialize: async () => EC3Widget.initialize(),
      createUiItemsProviders: () => [
        new EC3Provider({
          clientId: import.meta.env.IMJS_EC3_PORTAL_AUTH_CLIENT_ID ?? "",
          iTwinId: import.meta.env.IMJS_ITWIN_ID ?? "",
          redirectUri: import.meta.env.IMJS_EC3_PORTAL_AUTH_CLIENT_REDIRECT_URI ?? "",
          reportingBasePath: prefixUrl(REPORTS_CONFIG_BASE_URL, import.meta.env.IMJS_URL_PREFIX),
          carbonCalculationBasePath: prefixUrl(REPORTS_CONFIG_BASE_URL, import.meta.env.IMJS_URL_PREFIX),
        }),
      ],
    },
  ],
  [
    "one-click-lca-widget",
    {
      initialize: async () => Promise.resolve(),
      createUiItemsProviders: () => [new OneClickLCAProvider()],
    },
  ],
  [
    "layers-widget",
    {
      initialize: async () => {
        await initializeLayers();
      },
      createUiItemsProviders: () => [createLayersUiProvider()],
    },
  ],
]);

function ModelsTreeWithOptions(props: ComponentProps<typeof ModelsTreeComponent>) {
  const { disableNodesSelection } = useViewerOptionsContext();
  return <ModelsTreeComponent {...props} selectionPredicate={disableNodesSelection ? disabledSelectionPredicate : undefined} />;
}

function TreeWidgetWithOptions(props: { trees: TreeDefinition[] }) {
  return (
    <TreeWidgetComponent
      trees={props.trees}
      onPerformanceMeasured={(feature: string, elapsedTime: number) => {
        console.log(`TreeWidget [${feature}] took ${elapsedTime} ms`);
      }}
      onFeatureUsed={(feature: string) => {
        console.log(`TreeWidget [${feature}] used`);
      }}
    />
  );
}

function disabledSelectionPredicate() {
  return false;
}

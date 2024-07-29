/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { StagePanelLocation, StagePanelSection, UiItemsProvider } from "@itwin/appui-react";
import { IModelConnection } from "@itwin/core-frontend";
import { EC3Provider, EC3Widget } from "@itwin/ec3-widget-react";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { GeoTools, GeoToolsAddressSearchProvider } from "@itwin/geo-tools-react";
import { ClientPrefix, GroupingMappingProvider } from "@itwin/grouping-mapping-widget";
import { SvgHierarchyTree, SvgTechnicalPreviewMiniBw } from "@itwin/itwinui-icons-react";
import { FeatureInfoUiItemsProvider, MapLayersPrefBrowserStorage, MapLayersUI, MapLayersUiItemsProvider } from "@itwin/map-layers";
import { MapLayersFormats } from "@itwin/map-layers-formats";
import { MeasurementActionToolbar, MeasureTools, MeasureToolsUiItemsProvider } from "@itwin/measure-tools-react";
import { OneClickLCAProvider } from "@itwin/one-click-lca-react";
import {
  AddFavoritePropertyContextMenuItem,
  AncestorsNavigationControls,
  CopyPropertyTextContextMenuItem,
  PropertyGridManager,
  PropertyGridUiItemsProvider,
  RemoveFavoritePropertyContextMenuItem,
  ShowHideNullValuesSettingsMenuItem,
} from "@itwin/property-grid-react";
import { REPORTS_CONFIG_BASE_URL, ReportsConfigProvider, ReportsConfigWidget } from "@itwin/reports-config-widget-react";
import {
  CategoriesTreeComponent,
  ExternalSourcesTreeComponent,
  IModelContentTreeComponent,
  ModelsTreeComponent,
  TreeDefinition,
  TreeWidget,
  TreeWidgetComponent,
} from "@itwin/tree-widget-react";
import { useViewerOptionsContext } from "./components/ViewerOptions";
import { unifiedSelectionStorage } from "./SelectionStorage";

export interface UiProvidersConfig {
  initialize: () => Promise<void>;
  uiItemsProviders: UiItemsProvider[];
}

export function getUiProvidersConfig(): UiProvidersConfig {
  const enabledWidgets = import.meta.env.IMJS_ENABLED_WIDGETS ?? "";
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

const schemaContextCache = new Map<string, SchemaContext>();
function getSchemaContext(imodel: IModelConnection) {
  const key = imodel.getRpcProps().key;
  let schemaContext = schemaContextCache.get(key);
  if (!schemaContext) {
    const schemaLocater = new ECSchemaRpcLocater(imodel.getRpcProps());
    schemaContext = new SchemaContext();
    schemaContext.addLocater(schemaLocater);
    schemaContextCache.set(key, schemaContext);
    imodel.onClose.addOnce(() => schemaContextCache.delete(key));
  }
  return schemaContext;
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
                render: (props) => (
                  <ModelsTreeComponent
                    getSchemaContext={getSchemaContext}
                    density={props.density}
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
                render: (props) => (
                  <CategoriesTreeComponent
                    getSchemaContext={getSchemaContext}
                    density={props.density}
                    selectionStorage={unifiedSelectionStorage}
                    onPerformanceMeasured={props.onPerformanceMeasured}
                    onFeatureUsed={props.onFeatureUsed}
                  />
                ),
              },
              {
                id: IModelContentTreeComponent.id,
                getLabel: () => IModelContentTreeComponent.getLabel(),
                render: (props) => (
                  <IModelContentTreeComponent
                    getSchemaContext={getSchemaContext}
                    density={props.density}
                    selectionStorage={unifiedSelectionStorage}
                    onPerformanceMeasured={props.onPerformanceMeasured}
                    onFeatureUsed={props.onFeatureUsed}
                  />
                ),
              },
              {
                id: ExternalSourcesTreeComponent.id,
                startIcon: <SvgTechnicalPreviewMiniBw />,
                getLabel: () => ExternalSourcesTreeComponent.getLabel(),
                render: (props) => (
                  <ExternalSourcesTreeComponent
                    getSchemaContext={getSchemaContext}
                    density={props.density}
                    selectionStorage={unifiedSelectionStorage}
                    onPerformanceMeasured={props.onPerformanceMeasured}
                    onFeatureUsed={props.onFeatureUsed}
                  />
                ),
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
            onPerformanceMeasured: (feature, elapsedTime) => {
              console.log(`PropertyGrid [${feature}] took ${elapsedTime} ms`);
            },
            onFeatureUsed: (feature) => {
              console.log(`PropertyGrid [${feature}] used`);
            },
          },
        }),
      ],
    },
  ],
  [
    "measure-tools",
    {
      initialize: async () => {
        await MeasureTools.startup({ featureFlags: { showWidthTool: true, showHeightTool: true } });
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
]);

function TreeWidgetWithOptions(props: { trees: TreeDefinition[] }) {
  const { density } = useViewerOptionsContext();
  return (
    <TreeWidgetComponent
      trees={props.trees}
      density={density}
      onPerformanceMeasured={(feature: string, elapsedTime: number) => {
        console.log(`TreeWidget [${feature}] took ${elapsedTime} ms`);
      }}
      onFeatureUsed={(feature: string) => {
        console.log(`TreeWidget [${feature}] used`);
      }}
    />
  );
}

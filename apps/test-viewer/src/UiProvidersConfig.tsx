/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { StagePanelLocation, StagePanelSection } from "@itwin/appui-react";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { GeoTools, GeoToolsAddressSearchProvider } from "@itwin/geo-tools-react";
import { SvgHierarchyTree, SvgTechnicalPreviewMiniBw } from "@itwin/itwinui-icons-react";
import {
  createDefaultGoogleMapsBaseMaps,
  FeatureInfoUiItemsProvider,
  MapLayersPrefBrowserStorage,
  MapLayersUI,
  MapLayersUiItemsProvider,
} from "@itwin/map-layers";
import { MapLayersFormats } from "@itwin/map-layers-formats";
import { MeasurementActionToolbar, MeasureTools, MeasureToolsUiItemsProvider } from "@itwin/measure-tools-react";
import {
  AddFavoritePropertyContextMenuItem,
  AncestorsNavigationControls,
  CopyPropertyTextContextMenuItem,
  createPropertyGrid,
  PropertyGridManager,
  RemoveFavoritePropertyContextMenuItem,
  ShowHideEmptyValuesSettingsMenuItem,
} from "@itwin/property-grid-react";
import {
  CategoriesTreeComponent,
  ExternalSourcesTreeComponent,
  IModelContentTreeComponent,
  ModelsTreeComponent,
  TreeWidget,
  TreeWidgetComponent,
} from "@itwin/tree-widget-react";
import { CustomizeFormatPropertyContextMenuItem } from "./components/quantity-formatting/FormatPropertyContextMenuItem";
import { RepositoriesTreeComponent } from "./components/repositories-tree/RepositoriesTree";
import { useViewerOptionsContext } from "./components/ViewerOptions";
import { unifiedSelectionStorage } from "./SelectionStorage";

import type { ComponentPropsWithRef } from "react";
import type { UiItemsProvider } from "@itwin/appui-react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { SelectableTreeDefinition } from "@itwin/tree-widget-react";

export interface UiProvidersConfig {
  initialize: () => Promise<void>;
  getUiItemsProviders: () => UiItemsProvider[];
}

export function getUiProvidersConfig(): UiProvidersConfig {
  const enabledWidgets = new URLSearchParams(document.location.href).get("widgets") ?? import.meta.env.IMJS_ENABLED_WIDGETS ?? undefined;
  const matchingItems = enabledWidgets ? collectSupportedItems(enabledWidgets.split(/[\s;]/)) : [...configuredUiItems.values()];
  return {
    initialize: async () => {
      const promises = matchingItems.map(async (item) => item.initialize());
      await Promise.all(promises);
    },
    getUiItemsProviders() {
      return matchingItems.flatMap((item) => item.createUiItemsProviders());
    },
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
            const trees: SelectableTreeDefinition[] = [
              {
                id: ModelsTreeComponent.id,
                getLabel: () => ModelsTreeComponent.getLabel(),
                render: (props) => {
                  return (
                    <ModelsTreeWithOption
                      getSchemaContext={getSchemaContext}
                      hierarchyConfig={{
                        hideRootSubject: true,
                      }}
                      density={props.density}
                      selectionStorage={unifiedSelectionStorage}
                      selectionMode={"extended"}
                      onPerformanceMeasured={props.onPerformanceMeasured}
                      onFeatureUsed={props.onFeatureUsed}
                    />
                  );
                },
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
                    hierarchyConfig={{
                      hideRootSubject: true,
                    }}
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
              {
                id: "RepositoriesTree",
                getLabel: () => "Repositories tree",
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
                  (props) => <CustomizeFormatPropertyContextMenuItem {...props} />,
                ],
                settingsMenuItems: [(props) => <ShowHideEmptyValuesSettingsMenuItem {...props} persist={true} />],
                onPerformanceMeasured: (feature, elapsedTime) => {
                  console.log(`PropertyGrid [${feature}] took ${elapsedTime} ms`);
                },
                onFeatureUsed: (feature) => {
                  console.log(`PropertyGrid [${feature}] used`);
                },
                selectionStorage: unifiedSelectionStorage,
                isPropertyEditingEnabled: true,
                onPropertyUpdated: async ({ newValue }) => {
                  console.log(`Updated new value`, newValue);
                  return true;
                },
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
      createUiItemsProviders: () => [
        new MeasureToolsUiItemsProvider({
          measurementFormattingProps: {
            distance: {
              bearing: {
                koqName: "Nonexistent.BEARING", // Intentionally non existent KoQ to fallback to default bearing formatting by the tool
                persistenceUnitName: "Units.RAD",
              },
            },
          },
        }),
      ],
    },
  ],
  [
    "map-layers",
    {
      initialize: async () => {
        await MapLayersFormats.initialize();
        await MapLayersUI.initialize({ iTwinConfig: new MapLayersPrefBrowserStorage() });
      },
      createUiItemsProviders: () => {
        return [new MapLayersUiItemsProvider({ baseMapLayers: createDefaultGoogleMapsBaseMaps() }), new FeatureInfoUiItemsProvider({})];
      },
    },
  ],
  [
    "geo-tools",
    {
      initialize: async () => {
        await GeoTools.initialize();
      },
      // TODO: Use next line to use Google API
      // createUiItemsProviders: () => [new GeoToolsAddressSearchProvider(new GoogleAddressProvider)],
      createUiItemsProviders: () => [new GeoToolsAddressSearchProvider()],
    },
  ],
]);

function ModelsTreeWithOption(props: ComponentPropsWithRef<typeof ModelsTreeComponent>) {
  const { disableNodesSelection } = useViewerOptionsContext();
  return <ModelsTreeComponent {...props} selectionPredicate={disableNodesSelection ? disabledSelectionPredicate : undefined} />;
}

function TreeWidgetWithOptions(props: { trees: SelectableTreeDefinition[] }) {
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

function disabledSelectionPredicate() {
  return false;
}

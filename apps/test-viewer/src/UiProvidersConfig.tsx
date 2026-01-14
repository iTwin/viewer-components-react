/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import { StagePanelLocation, StagePanelSection, useActiveViewport } from "@itwin/appui-react";
import { EC3Provider, EC3Widget } from "@itwin/ec3-widget-react";
import { GeoTools, GeoToolsAddressSearchProvider } from "@itwin/geo-tools-react";
import { GroupingMappingProvider } from "@itwin/grouping-mapping-widget";
import { SvgHierarchyTree } from "@itwin/itwinui-icons-react";
import {
  createDefaultGoogleMapsBaseMaps,
  FeatureInfoUiItemsProvider,
  MapLayersPrefBrowserStorage,
  MapLayersUI,
  MapLayersUiItemsProvider,
} from "@itwin/map-layers";
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
  ClassificationsTreeComponent,
  ClassificationsTreeNode,
  createTreeWidgetViewport,
  ExternalSourcesTreeComponent,
  IModelContentTreeComponent,
  ModelsTreeComponent,
  RenameAction,
  TreeWidget,
  TreeWidgetComponent,
  useClassificationsTree,
  VisibilityTree,
  VisibilityTreeRenderer,
} from "@itwin/tree-widget-react";
import { CustomClassificationsTree } from "./components/custom-classifications-tree/CustomClassificationsTree";
import { createLayersUiProvider, initializeLayers } from "./components/LayersWidget";
import { CustomizeFormatPropertyContextMenuItem } from "./components/quantity-formatting/FormatPropertyContextMenuItem";
import { useViewerOptionsContext } from "./components/ViewerOptions";
import { unifiedSelectionStorage } from "./SelectionStorage";

import type { ComponentProps } from "react";
import type { UiItemsProvider } from "@itwin/appui-react";
import type { Id64Array } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { ClientPrefix } from "@itwin/grouping-mapping-widget";
import type { TreeDefinition } from "@itwin/tree-widget-react";

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
                    hierarchyConfig={{
                      hideRootSubject: true,
                    }}
                    searchText={props.searchText}
                    selectionStorage={unifiedSelectionStorage}
                    selectionMode={"extended"}
                    onPerformanceMeasured={props.onPerformanceMeasured}
                    onFeatureUsed={props.onFeatureUsed}
                    treeLabel={props.treeLabel}
                  />
                ),
              },
              {
                id: CategoriesTreeComponent.id,
                getLabel: () => CategoriesTreeComponent.getLabel(),
                isSearchable: true,
                render: (props) => (
                  <CategoriesTreeComponent
                    searchText={props.searchText}
                    selectionStorage={unifiedSelectionStorage}
                    onPerformanceMeasured={props.onPerformanceMeasured}
                    onFeatureUsed={props.onFeatureUsed}
                    treeLabel={props.treeLabel}
                  />
                ),
              },
              {
                id: IModelContentTreeComponent.id,
                getLabel: () => IModelContentTreeComponent.getLabel(),
                render: (props) => (
                  <IModelContentTreeComponent
                    hierarchyConfig={{
                      hideRootSubject: true,
                    }}
                    selectionStorage={unifiedSelectionStorage}
                    onPerformanceMeasured={props.onPerformanceMeasured}
                    onFeatureUsed={props.onFeatureUsed}
                    treeLabel={props.treeLabel}
                  />
                ),
              },
              {
                id: ExternalSourcesTreeComponent.id,
                getLabel: () => ExternalSourcesTreeComponent.getLabel(),
                render: (props) => (
                  <ExternalSourcesTreeComponent
                    selectionStorage={unifiedSelectionStorage}
                    onPerformanceMeasured={props.onPerformanceMeasured}
                    onFeatureUsed={props.onFeatureUsed}
                    treeLabel={props.treeLabel}
                  />
                ),
              },
              {
                id: ClassificationsTreeComponent.id,
                getLabel: () => "Classifications tree",
                isSearchable: true,
                render: (props) => (
                  <MyClassificationsTree
                    searchText={props.searchText}
                    selectionStorage={unifiedSelectionStorage}
                    hierarchyConfig={{ rootClassificationSystemCode: "OpenSite+ Hierarchy" }}
                    getMenuActions={() => [<RenameAction key={"renameAction"} />]}
                    getEditingProps={(node) => ({
                      onLabelChanged: (newLabel: string) => {
                        console.log("node label changed", node, newLabel);
                      },
                    })}
                    treeLabel={props.treeLabel}
                  />
                ),
                shouldShow: async (imodel) => ClassificationsTreeComponent.isSupportedByIModel(imodel),
              },
              {
                id: "CustomClassificationsTree",
                getLabel: () => "Custom Classifications tree",
                isSearchable: true,
                render: (props) => <CustomClassificationsTree searchText={props.searchText} />,
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
                settingsMenuItems: [(props) => <ShowHideNullValuesSettingsMenuItem {...props} persist={true} />],
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
                koqName: "RoadRailUnits.BEARING",
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

type MyClassificationsTreeProps = Omit<ComponentProps<typeof ClassificationsTreeComponent>, "viewport">;
function MyClassificationsTree(props: MyClassificationsTreeProps) {
  const viewport = useActiveViewport();
  if (!viewport) {
    return null;
  }
  return <MyClassificationsTreeImpl {...props} viewport={viewport} />;
}

function MyClassificationsTreeImpl({
  treeLabel,
  selectionMode,
  selectionStorage,
  viewport,
  hierarchyConfig,
  hierarchyLevelConfig,
  searchText,
  emptyTreeContent,
}: MyClassificationsTreeProps & { viewport: Viewport }) {
  const classificationsTree = useClassificationsTree({
    activeView: useMemo(() => createTreeWidgetViewport(viewport), [viewport]),
    hierarchyConfig,
    searchText,
    emptyTreeContent,
    getTreeItemProps: (node, treeRendererProps) => ({
      label: (
        <>
          {treeRendererProps.getTreeItemProps?.(node).label ?? node.label}
          {ClassificationsTreeNode.isClassificationNode(node.nodeData) || ClassificationsTreeNode.isClassificationTableNode(node.nodeData) ? (
            <ClassificationElementsCount classificationOrTableIds={node.nodeData.key.instanceKeys.map((key) => key.id)} />
          ) : null}
        </>
      ),
    }),
  });
  return (
    <VisibilityTree
      {...classificationsTree.treeProps}
      imodel={viewport.iModel}
      selectionStorage={selectionStorage}
      hierarchyLevelSizeLimit={hierarchyLevelConfig?.sizeLimit}
      selectionMode={selectionMode ?? "none"}
      treeRenderer={(treeRendererProps) => (
        <VisibilityTreeRenderer
          {...treeRendererProps}
          treeLabel={treeLabel}
          getTreeItemProps={(node) => classificationsTree.getTreeItemProps(node, treeRendererProps)}
        />
      )}
    />
  );
}

// just a sample implementation...
function ClassificationElementsCount(_props: { classificationOrTableIds: Id64Array }) {
  const [count, setCount] = useState<number | undefined>();
  useEffect(() => {
    const t = setTimeout(() => setCount(Math.random() * 100), Math.random() * 2000);
    return () => clearTimeout(t);
  }, []);
  return <span style={{ marginLeft: "8px", color: "gray" }}>({count ? `${count.toFixed(0)} elements` : "..."})</span>;
}

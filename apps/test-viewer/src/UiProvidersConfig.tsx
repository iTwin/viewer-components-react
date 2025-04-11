/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */

import React, { useCallback, useState } from "react";
import { StagePanelLocation, StagePanelSection, useActiveIModelConnection, useActiveViewport, WidgetState } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { EC3Provider, EC3Widget } from "@itwin/ec3-widget-react";
import { GeoTools, GeoToolsAddressSearchProvider } from "@itwin/geo-tools-react";
import { GroupingMappingProvider } from "@itwin/grouping-mapping-widget";
import { SvgHierarchyTree, SvgUpgrade, SvgWindow } from "@itwin/itwinui-icons-react";
import { ExpandableBlock } from "@itwin/itwinui-react";
import { Icon, IconButton } from "@itwin/itwinui-react-v5/bricks";
import { FeatureInfoUiItemsProvider, MapLayersPrefBrowserStorage, MapLayersUI, MapLayersUiItemsProvider, MapLayersWidget } from "@itwin/map-layers";
import { MapLayersFormats } from "@itwin/map-layers-formats";
import { MeasurementActionToolbar, MeasureTools, MeasureToolsUiItemsProvider } from "@itwin/measure-tools-react";
import { OneClickLCAProvider } from "@itwin/one-click-lca-react";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createIModelHierarchyProvider, createLimitingECSqlQueryExecutor, HierarchyNode, mergeProviders } from "@itwin/presentation-hierarchies";
import { isPresentationHierarchyNode, TreeRenderer, useIModelUnifiedSelectionTree, useTree } from "@itwin/presentation-hierarchies-react-v2";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
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
  CategoriesTreeIcon,
  ExternalSourcesTreeComponent,
  IModelContentTreeComponent,
  ModelsTreeComponent,
  ModelsTreeIcon,
  TreeWidget,
  TreeWidgetComponent,
  useCategoriesTree,
  useModelsTree,
  VisibilityTree,
  VisibilityTreeRenderer,
} from "@itwin/tree-widget-react";
import { createLayersUiProvider, initializeLayers } from "./components/LayersWidget";
import { RepositoriesTreeComponent } from "./components/repositories-tree/RepositoriesTree";
import { useViewerOptionsContext } from "./components/ViewerOptions";
import { getSchemaContext } from "./SchemaContext";
import { unifiedSelectionStorage } from "./SelectionStorage";

import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import type { Tree, TreeDefinition } from "@itwin/tree-widget-react";
import type { ClientPrefix } from "@itwin/grouping-mapping-widget";
import type { UiItemsProvider } from "@itwin/appui-react";
import type { HierarchyProvider, PresentationHierarchyNode, PresentationTreeNode } from "@itwin/presentation-hierarchies-react";

const mapIcon = new URL("@itwin/itwinui-icons/map.svg", import.meta.url).href;
const element3dIcon = new URL("@itwin/itwinui-icons/3d.svg", import.meta.url).href;
const svgLayers = new URL("@itwin/itwinui-icons/layers.svg", import.meta.url).href;
const svgBentley = new URL("@itwin/itwinui-icons/bentley-systems.svg", import.meta.url).href;
const svgITwin = new URL("@itwin/itwinui-icons/itwin.svg", import.meta.url).href;
const svgIModel = new URL("@itwin/itwinui-icons/imodel.svg", import.meta.url).href;

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
    "demo",
    {
      initialize: async () =>
        Promise.all([
          MapLayersFormats.initialize(),
          MapLayersUI.initialize({ iTwinConfig: new MapLayersPrefBrowserStorage() }),
          TreeWidget.initialize(IModelApp.localization),
        ]).then(),
      createUiItemsProviders: () => [
        {
          id: "EmptyWidgetProvider",
          getWidgets: () => {
            return [
              {
                id: "empty-widget",
                label: "Empty widget",
                icon: <SvgWindow />,
                layouts: {
                  standard: {
                    location: StagePanelLocation.Left,
                    section: StagePanelSection.Start,
                  },
                },
                content: <BentleyLogo />,
              },
            ];
          },
        },
        {
          id: "CustomTreeWidgetProvider",
          getWidgets: () => {
            const trees: TreeDefinition[] = [
              {
                id: ModelsTreeComponent.id,
                getLabel: () => "Models tree",
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
                id: "ConfiguredModelsTree",
                getLabel: () => "Configured models tree",
                render: (props) => (
                  <ConfiguredModelsTree
                    getSchemaContext={getSchemaContext}
                    selectionStorage={unifiedSelectionStorage}
                    selectionMode={"extended"}
                    filter={props.filter}
                  />
                ),
              },
              {
                id: "CustomizedModelsTree",
                getLabel: () => "Customized models tree",
                render: (props) => <CustomizedModelsTree filter={props.filter} />,
              },
              {
                id: "KiwiTreeWithCustomHierarchy",
                getLabel: () => "Kiwi tree with custom hierarchy",
                render: () => <KiwiTreeWithCustomHierarchy />,
              },
              {
                id: "MyCustomComponent",
                getLabel: () => "Custom component",
                render: () => <BentleyLogo />,
              },
            ];
            return [
              {
                id: "tree-widget-customization",
                label: "Tree widget customization",
                icon: <SvgUpgrade />,
                layouts: {
                  standard: {
                    location: StagePanelLocation.Left,
                    section: StagePanelSection.Start,
                  },
                },
                content: <TreeWidgetWithOptions trees={trees} />,
              },
            ];
          },
        },
        {
          id: "layers-widget-provider",
          getWidgets: () => {
            const layerBlocks: LayersBlockDefinition[] = [
              {
                icon: <Icon href={element3dIcon} />,
                label: "Elements",
                content: <ElementComponent getSchemaContext={getSchemaContext} selectionStorage={unifiedSelectionStorage} />,
              },
              {
                icon: <Icon href={mapIcon} />,
                label: "Map layers",
                content: <MapLayersWidget />,
              },
              {
                icon: <Icon href={svgBentley} />,
                label: "Custom",
                content: <BentleyLogo />,
              },
            ];
            return [
              {
                id: "layers-widget",
                label: "Layers",
                iconNode: <Icon href={svgLayers} />,
                content: <Layers blocks={layerBlocks} />,
                defaultState: WidgetState.Open,
                layouts: {
                  standard: {
                    location: StagePanelLocation.Left,
                    section: StagePanelSection.Start,
                  },
                },
              },
            ];
          },
        },
        {
          id: "BrowseIModel",
          getWidgets: () => {
            return [
              {
                id: "browse-imodel-widget",
                label: "iModel Browser",
                icon: <Icon href={svgIModel} />,
                layouts: {
                  standard: {
                    location: StagePanelLocation.Left,
                    section: StagePanelSection.Start,
                  },
                },
                content: <IModelBrowser />,
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

const svgAiSparkle = new URL("@itwin/itwinui-icons/ai-sparkle.svg", import.meta.url).href;
const svgChartLine = new URL("@itwin/itwinui-icons/chart-line.svg", import.meta.url).href;

function ConfiguredModelsTree(props: ComponentProps<typeof ModelsTreeComponent>) {
  return (
    <ModelsTreeComponent
      {...props}
      headerButtons={[
        React.useCallback(
          () => (
            <IconButton
              variant={"ghost"}
              label="Custom toolbar button"
              onClick={() => {
                window.alert(`Custom toolbar action!`);
              }}
              icon={svgChartLine}
            />
          ),
          [],
        ),
      ]}
      getDecorations={React.useCallback(
        (node: PresentationHierarchyNode) => [<ModelsTreeIcon key="icon" node={node} />, <Swatch key="swatch" node={node} />],
        [],
      )}
      actions={[
        React.useCallback(
          (node: PresentationHierarchyNode) => ({
            icon: svgAiSparkle,
            label: "Custom action",
            action: () => {
              window.alert(`Custom action for ${node.label}`);
            },
          }),
          [],
        ),
      ]}
    />
  );
}

function CustomizedModelsTree(props: { filter?: string }) {
  const imodel = useActiveIModelConnection();
  const viewport = useActiveViewport();
  if (!imodel || !viewport) {
    return null;
  }
  return <CustomizedModelsTreeImpl {...props} viewport={viewport} />;
}
function CustomizedModelsTreeImpl({ viewport, filter }: { viewport: Viewport; filter?: string }) {
  const { modelsTreeProps } = useModelsTree({
    activeView: viewport,
    filter,
  });
  const imodelAccess = React.useMemo(() => createIModelAccess({ imodel: viewport.iModel }), [viewport.iModel]);
  const { expandNode, rootNodes } = useIModelUnifiedSelectionTree({
    imodelAccess,
    getHierarchyDefinition: modelsTreeProps.getHierarchyDefinition,
    getFilteredPaths: modelsTreeProps.getFilteredPaths,
    sourceName: "CustomizedModelsTree",
  });
  if (!rootNodes) {
    return "Loading...";
  }
  return (
    <ul style={{ marginLeft: "40px" }}>
      {rootNodes.map((node) => (
        <SimpleTreeNode key={node.id} node={node} expandNode={expandNode} />
      ))}
    </ul>
  );
}
function SimpleTreeNode(
  props: Pick<ReturnType<typeof useIModelUnifiedSelectionTree>, "expandNode"> & {
    node: PresentationTreeNode;
    level?: number;
  },
) {
  const { node, expandNode } = props;
  const level = props.level ?? 1;
  let content: React.ReactNode = null;
  if (isPresentationHierarchyNode(node)) {
    content = (
      <>
        <div onClick={() => expandNode(node.id, !node.isExpanded)}>{node.label}</div>
        {node.isExpanded && Array.isArray(node.children) && (
          <ul style={{ marginLeft: `20px` }}>
            {node.children.map((child) => (
              <SimpleTreeNode key={child.id} node={child} expandNode={expandNode} level={level + 1} />
            ))}
          </ul>
        )}
      </>
    );
  } else {
    content = JSON.stringify(node);
  }
  return <li>{content}</li>;
}

const hierarchy = (function () {
  const h = new Map<string | undefined, HierarchyNode[]>();
  h.set(undefined, [
    { key: { type: "generic", id: "0" }, label: "_First root", children: false, parentKeys: [] },
    { key: { type: "generic", id: "1" }, label: "Root 1", children: true, parentKeys: [] },
    { key: { type: "generic", id: "2" }, label: "Root 2", children: true, parentKeys: [] },
  ]);
  h.set("1", [
    { key: { type: "generic", id: "a" }, label: "Child A", children: false, parentKeys: [{ type: "generic", id: "1" }] },
    { key: { type: "generic", id: "b" }, label: "Child B", children: false, parentKeys: [{ type: "generic", id: "1" }] },
  ]);
  h.set("2", [
    { key: { type: "generic", id: "c" }, label: "Child C", children: true, parentKeys: [{ type: "generic", id: "2" }] },
    { key: { type: "generic", id: "d" }, label: "Child D", children: false, parentKeys: [{ type: "generic", id: "2" }] },
  ]);
  h.set("c", [
    {
      key: { type: "generic", id: "e" },
      label: "Child E",
      children: false,
      parentKeys: [
        { type: "generic", id: "2" },
        { type: "generic", id: "c" },
      ],
    },
  ]);
  return h;
})();
const customHierarchyProvider: HierarchyProvider = {
  async *getNodeInstanceKeys() {},
  async *getNodes({ parentNode }) {
    if (!parentNode) {
      yield* hierarchy.get(undefined)!;
      return;
    }
    if (HierarchyNode.isGeneric(parentNode)) {
      yield* hierarchy.get(parentNode.key.id) ?? [];
      return;
    }
  },
  setFormatter() {},
  setHierarchyFilter() {},
  hierarchyChanged: new BeEvent(),
};
function KiwiTreeWithCustomHierarchy() {
  const { rootNodes, ...state } = useTree({
    getHierarchyProvider: React.useCallback(() => customHierarchyProvider, []),
  });
  if (!rootNodes) {
    return "Loading...";
  }
  // eslint-disable-next-line @itwin/no-internal
  return <TreeRenderer {...state} rootNodes={rootNodes} />;
}

function BentleyLogo() {
  return (
    <svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1543 1504" style={{ margin: "12px" }}>
      <title>Bentley</title>
      <g id="uuid-4900b7dd-3ef6-4140-ac1f-a7d42a554808">
        <path
          id="Layer"
          style={{ fill: "#1a1a1a", fillRule: "evenodd" }}
          d="m1542.4 1080.2c0 243.5-184.2 423.6-472.8 423.6h-886.2v-633.5h-182.8v-253.7h182.8v-616.5h816.7c276.3 0 464.5 147.1 464.5 374.3 0 200.4-130.9 335.5-229.3 358 147.5 8.1 307.1 130.9 307.1 347.8zm-1084.7-462.2h526.1c126.9 0 204.7-71.7 204.7-180.1 0-108.3-96.3-186.1-249.8-186.1h-481zm808.4 417.3c0-100.1-98.1-165.6-255.8-165.6h-552.6v382.5h548.4c159.7 0 260-90 260-216.9z"
        />
      </g>
    </svg>
  );
}

function Swatch({ node }: { node: PresentationHierarchyNode }) {
  const [color] = React.useState(`hsl(${Math.random() * 360}, 100%, 50%)`);
  if (node.nodeData.extendedData?.isCategory) {
    return (
      <div
        style={{
          inlineSize: "var(--iui-size-m)",
          blockSize: "var(--iui-size-m)",
          backgroundColor: color,
          borderRadius: "var(--iui-size-2xs)",
          border: "1px solid var(--iui-color-border)",
        }}
      />
    );
  }
  return null;
}

function createIModelAccess({ imodel }: { imodel: IModelConnection }) {
  const schemas = getSchemaContext(imodel);
  const schemaProvider = createECSchemaProvider(schemas);
  return {
    imodelKey: imodel.key,
    ...schemaProvider,
    ...createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 100 }),
    ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
  };
}

interface LayersBlockDefinition {
  icon: ReactNode;
  label: string;
  content: ReactNode;
}

function Layers({ blocks }: { blocks: LayersBlockDefinition[] }) {
  const [activeBlock, setActiveBlock] = useState<number | undefined>(0);

  const handleBlockToggle = (index: number) => {
    setActiveBlock(index === activeBlock ? undefined : index);
  };

  return (
    <div
      style={{
        padding: "var(--iui-size-2xs)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--iui-size-2xs)",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {blocks.map((block, index) => (
        <LayerBlock key={index} label={block.label} icon={block.icon} expanded={index === activeBlock} onExpanded={() => handleBlockToggle(index)}>
          {block.content}
        </LayerBlock>
      ))}
    </div>
  );
}

function LayerBlock({
  label,
  icon,
  expanded,
  onExpanded,
  children,
}: PropsWithChildren<{ label: string; icon: ReactNode; expanded: boolean; onExpanded: () => void }>) {
  return (
    <ExpandableBlock.Wrapper
      style={{ ...(expanded ? { overflow: "hidden" } : undefined) }}
      size="small"
      styleType="borderless"
      isExpanded={expanded}
      onToggle={onExpanded}
    >
      <ExpandableBlock.Trigger>
        <ExpandableBlock.ExpandIcon />
        <ExpandableBlock.LabelArea style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "var(--iui-size-2xs)" }}>
          {icon}
          <ExpandableBlock.Title>{label}</ExpandableBlock.Title>
        </ExpandableBlock.LabelArea>
      </ExpandableBlock.Trigger>
      <ExpandableBlock.Content innerProps={{ style: { height: "100%" } }}>{children}</ExpandableBlock.Content>
    </ExpandableBlock.Wrapper>
  );
}

function ElementComponent(props: Pick<ElementsProps, "getSchemaContext" | "selectionStorage">) {
  const view = useActiveViewport();
  if (!view) {
    return null;
  }

  return <Elements {...props} view={view} />;
}

type ElementsProps = Pick<ComponentProps<typeof Tree>, "getSchemaContext" | "selectionStorage"> & { view: Viewport };

function Elements({ view, ...rest }: ElementsProps) {
  const { categoriesTreeProps, rendererProps } = useCategoriesTree({ activeView: view, hierarchyConfig: { hideSubCategories: true, showElements: true } });
  return (
    <VisibilityTree
      {...rest}
      {...categoriesTreeProps}
      imodel={view.iModel}
      treeRenderer={(treeProps) => (
        <VisibilityTreeRenderer
          {...treeProps}
          {...rendererProps}
          getSublabel={undefined}
          getDecorations={(node) => (
            <>
              <Swatch node={node} />
              <CategoriesTreeIcon node={node} />
            </>
          )}
        />
      )}
    />
  );
}

function IModelBrowser() {
  const viewport = useActiveViewport();
  if (!viewport) {
    return null;
  }
  return <IModelBrowserImpl viewport={viewport} />;
}
function IModelBrowserImpl(props: { viewport: Viewport }) {
  const viewport = props.viewport;
  const imodel = viewport.iModel;
  const { categoriesTreeProps } = useCategoriesTree({ activeView: viewport, hierarchyConfig: { hideSubCategories: true, showElements: true } });
  const categoriesDefinitionFactory = categoriesTreeProps.getHierarchyDefinition;
  const getHierarchyProvider = useCallback(() => {
    const imodelAccess = createIModelAccess({ imodel });
    const categoriesProvider = createIModelHierarchyProvider({
      imodelAccess,
      hierarchyDefinition: categoriesDefinitionFactory({ imodelAccess }),
    });
    const categoriesRootProvider: HierarchyProvider = {
      async *getNodeInstanceKeys(x) {
        yield* categoriesProvider.getNodeInstanceKeys(x);
      },
      async *getNodes(x) {
        let { parentNode } = x;
        if (!parentNode) {
          yield {
            key: { type: "generic", id: "ROOT_ELEMENTS_NODE" },
            label: "Elements",
            children: true,
            parentKeys: [],
          } satisfies HierarchyNode;
          return;
        }
        const parentKey = parentNode.key;
        if (HierarchyNode.isGeneric(parentNode) && parentNode.key.id === "ROOT_ELEMENTS_NODE") {
          parentNode = undefined;
        }
        for await (const node of categoriesProvider.getNodes({ ...x, parentNode })) {
          yield {
            ...node,
            parentKeys: [parentKey, ...node.parentKeys],
          } satisfies HierarchyNode;
        }
      },
      setFormatter() {},
      setHierarchyFilter() {},
      hierarchyChanged: new BeEvent(),
    };
    const mergedProvider = mergeProviders({ providers: [categoriesRootProvider, customHierarchyProvider] });
    return mergedProvider;
  }, [categoriesDefinitionFactory, imodel]);

  const { rootNodes, ...state } = useTree({ getHierarchyProvider });
  if (!rootNodes) {
    return "Loading...";
  }
  // eslint-disable-next-line @itwin/no-internal
  return <TreeRenderer {...state} rootNodes={rootNodes} selectionMode="extended" />;
}

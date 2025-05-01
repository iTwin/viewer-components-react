/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { FeatureInfoUiItemsProvider, MapLayersPrefBrowserStorage, MapLayersUI, MapLayersUiItemsProvider } from "@itwin/map-layers";
import { MapLayersFormats } from "@itwin/map-layers-formats";


import type { IModelConnection } from "@itwin/core-frontend";
// import type { ClientPrefix } from "@itwin/grouping-mapping-widget";
// import type { SelectableTreeDefinition } from "@itwin/tree-widget-react";
import type { UiItemsProvider } from "@itwin/appui-react";

export interface UiProvidersConfig {
  initialize: () => Promise<void>;
  uiItemsProviders: UiItemsProvider[];
}

export function getUiProvidersConfig(): UiProvidersConfig {
  const enabledWidgets = new URLSearchParams(document.location.href).get("widgets") ?? import.meta.env.IMJS_ENABLED_WIDGETS ?? undefined;
  const matchingItems = enabledWidgets ? collectSupportedItems(enabledWidgets.split(/[\s;]/)) : [...configuredUiItems.values()];
  const uiItemsProviders = matchingItems.map((item) => item.createUiItemsProviders());
  return {
    initialize: async () => {
      const promises = matchingItems.map(async (item) => item.initialize());
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
    "map-layers",
    {
      initialize: async () => {
        await MapLayersFormats.initialize();
        await MapLayersUI.initialize({ iTwinConfig: new MapLayersPrefBrowserStorage() });
      },
      createUiItemsProviders: () => [new MapLayersUiItemsProvider(), new FeatureInfoUiItemsProvider({})],
    },
  ],
  // [
  //   "geo-tools",
  //   {
  //     initialize: async () => {
  //       await GeoTools.initialize();
  //     },
  //     createUiItemsProviders: () => [new GeoToolsAddressSearchProvider()],
  //   },
  // ],
  // [
  //   "one-click-lca-widget",
  //   {
  //     initialize: async () => Promise.resolve(),
  //     createUiItemsProviders: () => [new OneClickLCAProvider()],
  //   },
  // ],
]);

// function ModelsTreeWithOption(props: ComponentPropsWithRef<typeof ModelsTreeComponent>) {
//   const { disableNodesSelection } = useViewerOptionsContext();
//   return <ModelsTreeComponent {...props} selectionPredicate={disableNodesSelection ? disabledSelectionPredicate : undefined} />;
// }

// function TreeWidgetWithOptions(props: { trees: SelectableTreeDefinition[] }) {
//   const { density } = useViewerOptionsContext();
//   return (
//     <TreeWidgetComponent
//       trees={props.trees}
//       density={density}
//       onPerformanceMeasured={(feature: string, elapsedTime: number) => {
//         console.log(`TreeWidget [${feature}] took ${elapsedTime} ms`);
//       }}
//       onFeatureUsed={(feature: string) => {
//         console.log(`TreeWidget [${feature}] used`);
//       }}
//     />
//   );
// }

function disabledSelectionPredicate() {
  return false;
}

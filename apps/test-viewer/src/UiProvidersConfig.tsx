/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UiItemsProvider, useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget, TreeWidgetUiItemsProvider } from "@itwin/tree-widget-react";
import { PropertyGridManager, PropertyGridUiItemsProvider } from "@itwin/property-grid-react";
import { MeasureTools, MeasureToolsUiItemsProvider } from "@itwin/measure-tools-react";
import { BreakdownTrees, SpatialContainmentTree, SpatialContainmentTreeProps } from "@itwin/breakdown-trees-react";
import React from "react";
import { SelectableContentDefinition } from "@itwin/components-react";

import { ITwinLocalization } from "@itwin/core-i18n";

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


const SampleSpatialTree: React.FC = () => {
  const iModel = useActiveIModelConnection();
  return <>
    {iModel && <SpatialContainmentTree
      iModel={iModel}
      groupByType={true}
      setGroupByType={() => { return "group-by-type" }}
      groupByDiscipline={true}
      setGroupByDiscipline={() => { return "group-by-discipline" }}
      displayGuids={true}
      setIsDisplayGuids={() => { return "discard-guid-from-labe" }}
      enableVisibility={true}
      clipHeight={1.2}
      clipAtSpaces={true}
    />}
  </>
}
const getSpatialTree = (): SelectableContentDefinition => {
  return {
    id: "spatial-containment-tree",
    label: "containment",
    render: () => (
      <SampleSpatialTree />
    ),
  };
};

const configuredUiItems = new Map<string, UiItem>([
  [
    "tree-widget",
    {
      initialize: async () => TreeWidget.initialize(),
      createUiItemsProvider: () => new TreeWidgetUiItemsProvider({
        additionalTrees: [getSpatialTree()]
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
      initialize: async () => MeasureTools.startup(),
      createUiItemsProvider: () => new MeasureToolsUiItemsProvider(),
    }
  ]
])
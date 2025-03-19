/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useState } from "react";
import { RealityData, RealityDataWidget } from "@bentley/reality-data";
import { StagePanelLocation, StagePanelSection, useActiveViewport, WidgetState } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { ExpandableBlock } from "@itwin/itwinui-react";
import { Icon } from "@itwin/itwinui-react-v5/bricks";
import { MapLayersPrefBrowserStorage, MapLayersUI, MapLayersWidget } from "@itwin/map-layers";
import { MapLayersFormats } from "@itwin/map-layers-formats";
import { RealityDataAccessClient } from "@itwin/reality-data-client";
import { Tree, TreeRenderer, useCategoriesTree } from "@itwin/tree-widget-react";
import { getSchemaContext } from "./SchemaContext";
import { unifiedSelectionStorage } from "./SelectionStorage";

import type {
  UiItemsProvider} from "@itwin/appui-react";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { AuthorizationClient } from "@itwin/core-common";

const realityIcon = new URL("@itwin/itwinui-icons/reality-mesh.svg", import.meta.url).href;
const mapIcon = new URL("@itwin/itwinui-icons/map.svg", import.meta.url).href;
const element3dIcon = new URL("@itwin/itwinui-icons/3d.svg", import.meta.url).href;

export async function initializeLayers(auth: AuthorizationClient) {
  await MapLayersFormats.initialize();
  await MapLayersUI.initialize({ iTwinConfig: new MapLayersPrefBrowserStorage() });

  const realityDataAccess = new RealityDataAccessClient({
    baseUrl: "https://qa-api.bentley.com/reality-management/reality-data",
  });

  await RealityData.initialize({
    authorizationClient: auth,
    i18n: IModelApp.localization,
    store: undefined,
    realityDataAccess,
  });
}

export function createLayersUiProvider(): UiItemsProvider {
  return {
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
          icon: <Icon href={realityIcon} />,
          label: "Reality data",
          content: <RealityDataWidget appContext={{}} />,
        },
      ];

      return [
        {
          id: "layers-widget",
          label: "Layers",
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
  };
}

interface LayersBlockDefinition {
  icon: ReactNode;
  label: string;
  content: ReactNode;
}

function Layers({ blocks }: { blocks: LayersBlockDefinition[] }) {
  const [activeBlock, setActiveBlock] = useState<number | undefined>(undefined);

  const handleBlockToggle = (index: number) => {
    setActiveBlock(index === activeBlock ? undefined : index);
  };

  return (
    <div style={{ padding: "var(--iui-size-2xs)", display: "flex", flexDirection: "column", gap: "var(--iui-size-2xs)" }}>
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
    <ExpandableBlock.Wrapper size="small" styleType="borderless" isExpanded={expanded} onToggle={onExpanded}>
      <ExpandableBlock.Trigger>
        <ExpandableBlock.ExpandIcon />
        <ExpandableBlock.LabelArea style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "var(--iui-size-2xs)" }}>
          {icon}
          <ExpandableBlock.Title>{label}</ExpandableBlock.Title>
        </ExpandableBlock.LabelArea>
      </ExpandableBlock.Trigger>
      <ExpandableBlock.Content>{children}</ExpandableBlock.Content>
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
  const { categoriesTreeProps, rendererProps } = useCategoriesTree({ activeView: view });
  return <Tree {...rest} {...categoriesTreeProps} imodel={view.iModel} treeRenderer={(treeProps) => <TreeRenderer {...treeProps} {...rendererProps} />} />;
}

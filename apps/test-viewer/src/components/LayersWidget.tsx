/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useState } from "react";
import { StagePanelLocation, StagePanelSection, useActiveViewport, WidgetState } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { ExpandableBlock } from "@itwin/itwinui-react";
import { Chip, Icon } from "@itwin/itwinui-react-v5/bricks";
import { MapLayersPrefBrowserStorage, MapLayersUI, MapLayersWidget } from "@itwin/map-layers";
import { MapLayersFormats } from "@itwin/map-layers-formats";
import { CategoriesTreeIcon, Tree, TreeRenderer, TreeWidget, useCategoriesTree } from "@itwin/tree-widget-react";
import { getSchemaContext } from "../SchemaContext";
import { unifiedSelectionStorage } from "../SelectionStorage";

import type { UiItemsProvider } from "@itwin/appui-react";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import type { Viewport } from "@itwin/core-frontend";
const mapIcon = new URL("@itwin/itwinui-icons/map.svg", import.meta.url).href;
const element3dIcon = new URL("@itwin/itwinui-icons/3d.svg", import.meta.url).href;

export async function initializeLayers() {
  await MapLayersFormats.initialize();
  await MapLayersUI.initialize({ iTwinConfig: new MapLayersPrefBrowserStorage() });
  await TreeWidget.initialize(IModelApp.localization);
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
      style={expanded ? { overflow: "hidden" } : undefined}
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
  const { categoriesTreeProps, rendererProps } = useCategoriesTree({ activeView: view });
  return (
    <Tree
      {...rest}
      {...categoriesTreeProps}
      imodel={view.iModel}
      treeRenderer={(treeProps) => (
        <TreeRenderer
          {...treeProps}
          {...rendererProps}
          getSublabel={undefined}
          getDecorations={(node) => (
            <>
              <Chip label={node.label.substring(0, 1)} variant="outline"/>
              <CategoriesTreeIcon node={node} />
            </>
          )}
        />
      )}
    />
  );
}

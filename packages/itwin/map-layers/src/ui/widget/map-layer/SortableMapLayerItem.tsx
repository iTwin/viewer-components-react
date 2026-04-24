/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type React from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import type { StyleMapLayerSettings } from "../../Interfaces";
import type { backgroundMapLayersId, overlayMapLayersId } from "./MapLayerDragDrop";
import { assert } from "@itwin/core-bentley";

interface SortableMapLayerItemProps {
  layer: StyleMapLayerSettings;
  droppableId: typeof overlayMapLayersId | typeof backgroundMapLayersId;
  index: number;
  renderItem: (sortable: ReturnType<typeof useSortable>) => React.ReactNode;
  disabled?: boolean;
}

export function SortableMapLayerItem(props: SortableMapLayerItemProps) {
  assert(props.layer !== undefined);

  const sortable = useSortable({
    id: props.layer.id,
    index: props.index,
    disabled: props.disabled,
    type: "item",
    accept: "item",
    group: props.droppableId,
  });

  return props.renderItem(sortable);
}

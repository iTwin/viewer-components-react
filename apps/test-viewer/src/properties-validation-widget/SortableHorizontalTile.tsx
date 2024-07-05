/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SvgDragHandleVertical } from "@itwin/itwinui-icons-react";
import { Icon } from "@itwin/itwinui-react";
import type { GroupPropertyListItemProps } from "./GroupPropertyListItem";
import { GroupPropertyListItem } from "./GroupPropertyListItem";

interface SortableHorizontalTileProps extends GroupPropertyListItemProps {
  id: string;
}

export const SortableHorizontalTile = ({ id, ...props }: SortableHorizontalTileProps) => {
  const { attributes, listeners, isDragging, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = "";
    };
  }, [isDragging]);

  return (
    <div ref={setNodeRef} {...attributes} style={{ ...style, visibility: isDragging ? "hidden" : "visible" }}>
      <GroupPropertyListItem
        dragHandle={
          <Icon className="gmw-drag-icon" size="large" style={{ cursor: "grab" }} title="Drag & Drop" {...listeners}>
            <SvgDragHandleVertical />
          </Icon>
        }
        {...props}
      />
    </div>
  );
};

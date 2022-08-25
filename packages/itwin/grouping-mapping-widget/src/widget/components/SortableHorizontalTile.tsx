import React, { useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import type { HorizontalTileProps } from "./HorizontalTile";
import { HorizontalTile } from "./HorizontalTile";
import { CSS } from "@dnd-kit/utilities";
import { SvgDragHandleVertical } from "@itwin/itwinui-icons-react";

interface SortableHorizontalTileProps extends HorizontalTileProps {
  id: string;
}

const SortableHorizontalTile = ({id, ...props}: SortableHorizontalTileProps) => {
  const {
    attributes,
    listeners,
    isDragging,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id});

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
    <div
      ref={setNodeRef}
      {...attributes}
      style={{ ...style, visibility: isDragging ? "hidden" : "visible" }}
    >
      <HorizontalTile
        dragHandle={
          <div className="gmw-drag-icon" style={{cursor:"grab"}} title="Drag & Drop" {...listeners}>
            <SvgDragHandleVertical />
          </div>
        }
        {...props}
      />
    </div>
  );
};

export default SortableHorizontalTile;

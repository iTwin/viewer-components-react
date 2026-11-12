/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./ElementList.scss";

import classnames from "classnames";
import * as React from "react";
import { List, ListItem, Text } from "@itwin/itwinui-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useInstanceLabels } from "../hooks/UseInstanceLabels.js";
import { PropertyGridManager } from "../PropertyGridManager.js";
import { Header } from "./Header.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";

// Initial row height estimate (px). Actual height is theme-dependent, so each row is measured after mount.
const INITIAL_ROW_HEIGHT = 29;

/**
 * Props for `ElementList` component.
 * @internal
 */
export interface ElementListProps {
  imodel: IModelConnection;
  instanceKeys: InstanceKey[];
  onBack: () => void;
  onSelect: (instanceKey: InstanceKey) => void;
  className?: string;
}

/**
 * Shows a list of elements to inspect properties for.
 * @internal
 */
export function ElementList({ imodel, instanceKeys, onBack, onSelect, className }: ElementListProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const { rows, loadMore } = useInstanceLabels({ imodel, instanceKeys });
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    loadMore();
  }, [imodel, instanceKeys, loadMore]);

  const title = `${PropertyGridManager.translate("element-list.title")} (${instanceKeys.length})`;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => INITIAL_ROW_HEIGHT,
    overscan: 10,
  });
  const virtualRows = virtualizer.getVirtualItems();

  // request the next page when the user scrolls close to the end of the list; re-runs when rows change, so the
  // following page is requested if the user is still at the end once the current one settles
  const lastVisibleIndex = virtualRows.at(-1)?.index;
  React.useEffect(() => {
    if (lastVisibleIndex !== undefined && lastVisibleIndex >= rows.length - 1) {
      loadMore();
    }
  }, [lastVisibleIndex, rows, loadMore]);

  return (
    <div className={classnames("property-grid-react-element-list", className)}>
      <Header
        onBackButtonClick={onBack}
        title={
          <Text className="property-grid-react-element-list-title" variant="leading">
            {title}
          </Text>
        }
      />
      <List ref={scrollContainerRef} className="property-grid-react-element-list-container">
        <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative", contain: "layout" }}>
          {virtualRows.map((virtualRow) => {
            const dataItem = rows[virtualRow.index];
            return (
              <ListItem
                key={virtualRow.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="property-grid-react-element-list-item"
                actionable={!!dataItem}
                aria-busy={dataItem ? undefined : true}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => {
                  if (dataItem) {
                    onSelect(dataItem.instanceKey);
                  }
                }}
              >
                {dataItem ? dataItem.label : <Text isSkeleton>{PropertyGridManager.translate("element-list.loading")}</Text>}
              </ListItem>
            );
          })}
        </div>
      </List>
    </div>
  );
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./ElementList.scss";

import classnames from "classnames";
import * as React from "react";
import { List, ListItem, Text } from "@itwin/itwinui-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { InstanceLabelsProvider } from "../common/InstanceLabelsProvider.js";
import { trackTime } from "../common/TimeTracker.js";
import { useTelemetryContext } from "../hooks/UseTelemetryContext.js";
import { PropertyGridManager } from "../PropertyGridManager.js";
import { Header } from "./Header.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { LabeledInstanceKey } from "../common/InstanceLabelsProvider.js";

// Initial row height estimate (px). Actual height is theme-dependent, so each row is measured after mount.
const INITIAL_ROW_HEIGHT = 29;
const PAGE_SIZE = 100;

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
 * State for the loaded pages of selected elements.
 * @internal
 */
interface ElementListData {
  items: LabeledInstanceKey[];
  hasMore: boolean;
  loading: boolean;
  error: boolean;
}

/**
 * Shows a list of elements to inspect properties for.
 * @internal
 */
export function ElementList({ imodel, instanceKeys, onBack, onSelect, className }: ElementListProps) {
  const [data, setData] = React.useState<ElementListData>({ items: [], hasMore: false, loading: false, error: false });
  const labelsProvider = React.useMemo(() => new InstanceLabelsProvider({ imodel }), [imodel]);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const loadNextPage = React.useRef<(() => Promise<void>) | undefined>(undefined);

  const { onPerformanceMeasured } = useTelemetryContext();

  React.useEffect(() => {
    let disposed = false;
    let loading = false;
    let items: LabeledInstanceKey[] = [];
    let hasMore = true;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    const { finish, dispose: disposeTimeTracker } = trackTime(instanceKeys.length > 0, (elapsedTime) => {
      onPerformanceMeasured("elements-list-load", elapsedTime);
    });

    const loadPage = async () => {
      if (disposed || loading || !hasMore) {
        return;
      }
      loading = true;
      setData({ items, hasMore, loading: true, error: false });
      try {
        const page = await labelsProvider.getLabelsPage(instanceKeys, { offset: items.length, limit: PAGE_SIZE });
        if (disposed) {
          return;
        }
        if (items.length === 0) {
          finish();
        }
        items = [...items, ...page.items];
        hasMore = page.hasMore;
        setData({ items, hasMore, loading: false, error: false });
      } catch {
        if (!disposed) {
          setData({ items, hasMore, loading: false, error: true });
        }
      } finally {
        loading = false;
      }
    };
    loadNextPage.current = loadPage;
    void loadPage();

    return () => {
      disposed = true;
      loadNextPage.current = undefined;
      disposeTimeTracker();
    };
  }, [labelsProvider, instanceKeys, onPerformanceMeasured]);

  const title = `${PropertyGridManager.translate("element-list.title")} (${instanceKeys.length})`;

  const virtualizer = useVirtualizer({
    count: data.items.length + (data.hasMore ? 1 : 0),
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => INITIAL_ROW_HEIGHT,
    overscan: 10,
  });
  const virtualRows = virtualizer.getVirtualItems();

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
            const dataItem = data.items[virtualRow.index];
            return (
              <ListItem
                key={virtualRow.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="property-grid-react-element-list-item"
                actionable={!!dataItem || !data.loading}
                aria-busy={!dataItem && data.loading ? true : undefined}
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
                  } else {
                    void loadNextPage.current?.();
                  }
                }}
              >
                {dataItem
                  ? dataItem.label
                  : PropertyGridManager.translate(data.error ? "retry" : data.loading ? "element-list.loading" : "element-list.load-more")}
              </ListItem>
            );
          })}
        </div>
      </List>
    </div>
  );
}

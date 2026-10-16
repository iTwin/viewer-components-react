/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./ElementList.scss";

import classnames from "classnames";
import * as React from "react";
import { List, ListItem, Text } from "@itwin/itwinui-react";
import { PresentationLabelsProvider } from "@itwin/presentation-components";
import { useVirtualizer } from "@tanstack/react-virtual";
import { trackTime } from "../common/TimeTracker.js";
import { useTelemetryContext } from "../hooks/UseTelemetryContext.js";
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
 * Props for data that is needed for displaying an element in a list.
 * @internal
 */
interface RowElementData {
  label: string;
  instanceKey: InstanceKey;
}

/**
 * Shows a list of elements to inspect properties for.
 * @internal
 */
export function ElementList({ imodel, instanceKeys, onBack, onSelect, className }: ElementListProps) {
  const [data, setData] = React.useState<RowElementData[]>();
  const labelsProvider: PresentationLabelsProvider = React.useMemo(() => new PresentationLabelsProvider({ imodel }), [imodel]);

  const { onPerformanceMeasured } = useTelemetryContext();

  React.useEffect(() => {
    let disposed = false;
    const { finish, dispose: disposeTimeTracker } = trackTime(instanceKeys.length > 0, (elapsedTime) => {
      onPerformanceMeasured("elements-list-load", elapsedTime);
    });

    void (async () => {
      const sortedRowElementData = await getSortedLabelInstanceKeyPairs(labelsProvider, instanceKeys);
      // ignore results from an outdated load (keys changed or component unmounted)
      if (disposed) {
        return;
      }
      finish();
      setData(sortedRowElementData);
    })();

    return () => {
      disposed = true;
      disposeTimeTracker();
    };
  }, [labelsProvider, instanceKeys, onPerformanceMeasured]);

  const title = `${PropertyGridManager.translate("element-list.title")} (${instanceKeys.length})`;

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: data?.length ?? 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => INITIAL_ROW_HEIGHT,
    overscan: 10,
  });

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
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const dataItem = data?.[virtualRow.index];
            if (!dataItem) {
              return null;
            }
            return (
              <ListItem
                key={virtualRow.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="property-grid-react-element-list-item"
                actionable
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => {
                  onSelect(dataItem.instanceKey);
                }}
              >
                {dataItem.label}
              </ListItem>
            );
          })}
        </div>
      </List>
    </div>
  );
}

/** Queries labels and orders Label-InstanceKey pairs in ascending order */
async function getSortedLabelInstanceKeyPairs(labelsProvider: PresentationLabelsProvider, instanceKeys: InstanceKey[]): Promise<RowElementData[]> {
  const labels = await getLabels(labelsProvider, instanceKeys);
  return labels.map((label, index) => ({ label, instanceKey: instanceKeys[index] })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Gets labels from presentation layer, chunks up requests if necessary */
async function getLabels(labelsProvider: PresentationLabelsProvider, instanceKeys: InstanceKey[]): Promise<string[]> {
  const chunkSize = 1000;
  if (instanceKeys.length < chunkSize) {
    return labelsProvider.getLabels(instanceKeys.map(normalizeInstanceKey));
  } else {
    const labels: string[] = [];
    for (let i = 0; i < instanceKeys.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, instanceKeys.length);
      const chunk = instanceKeys.slice(i, end).map(normalizeInstanceKey);
      const currentLabels = await labelsProvider.getLabels(chunk);
      labels.push(...currentLabels);
    }
    return labels;
  }
}

function normalizeInstanceKey(instanceKey: InstanceKey) {
  // Presentation content APIs expect `:` instead of `.` in full class names...
  return { className: instanceKey.className.replace(".", ":"), id: instanceKey.id };
}

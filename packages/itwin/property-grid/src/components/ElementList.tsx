/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./ElementList.scss";
import classnames from "classnames";
import * as React from "react";
import { MenuItem, Text } from "@itwin/itwinui-react";
import { PresentationLabelsProvider } from "@itwin/presentation-components";
import { PropertyGridManager } from "../PropertyGridManager";
import { Header } from "./Header";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";

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

  React.useEffect(() => {
    const createRowElementData = async () => {
      const sortedRowElementData = await getSortedLabelInstanceKeyPairs(labelsProvider, instanceKeys);
      setData(sortedRowElementData);
    };

    void createRowElementData();
  }, [labelsProvider, instanceKeys]);

  const title = `${PropertyGridManager.translate("element-list.title")} (${instanceKeys.length})`;

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
      <div className="property-grid-react-element-list-container" role="list">
        {data?.map((dataItem, index) => (
          <MenuItem
            key={index}
            role="listitem"
            onClick={() => {
              onSelect(dataItem.instanceKey);
            }}
          >
            {dataItem.label}
          </MenuItem>
        ))}
      </div>
    </div>
  );
}

/** Queries labels and orders Label-InstanceKey pairs in ascending order */
async function getSortedLabelInstanceKeyPairs(labelsProvider: PresentationLabelsProvider, instanceKeys: InstanceKey[]): Promise<RowElementData[]> {
  const labels = await getLabels(labelsProvider, instanceKeys);
  const labelKeyPairs: RowElementData[] = [];

  labels.forEach((label, index) => {
    labelKeyPairs.push({ label, instanceKey: instanceKeys[index] });
  });

  return labels.map((label, index) => ({ label, instanceKey: instanceKeys[index] })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Gets labels from presentation layer, chunks up requests if necessary */
async function getLabels(labelsProvider: PresentationLabelsProvider, instanceKeys: InstanceKey[]): Promise<string[]> {
  const chunkSize = 1000;
  if (instanceKeys.length < chunkSize) {
    return labelsProvider.getLabels(instanceKeys);
  } else {
    const labels: string[] = [];
    for (let i = 0; i < instanceKeys.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, instanceKeys.length);
      const chunk = instanceKeys.slice(i, end);
      const currentLabels = await labelsProvider.getLabels(chunk);
      labels.push(...currentLabels);
    }
    return labels;
  }
}

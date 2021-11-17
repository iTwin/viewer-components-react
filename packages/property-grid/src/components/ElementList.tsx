/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./ElementList.scss";

import { IModelConnection } from "@itwin/core-frontend";
import { InstanceKey } from "@itwin/presentation-common";
import { PresentationLabelsProvider } from "@itwin/presentation-components";
import {
  PropertyDescription,
  PropertyEditorInfo,
  PropertyRecord,
  PropertyValue,
  PropertyValueFormat,
} from "@itwin/appui-abstract";
import {
  ColumnDescription,
  RowItem,
  SelectionMode,
  SimpleTableDataProvider,
  Table,
} from "@itwin/components-react";
import { Icon } from "@itwin/core-react";
import classnames from "classnames";
import * as React from "react";

import { PropertyGridManager } from "../PropertyGridManager";
import { Logger } from "@itwin/core-bentley";

export interface ElementListProps {
  iModelConnection: IModelConnection;
  instanceKeys: InstanceKey[];
  onBack: () => void;
  /** should be memoized to prevent unnecessary updates */
  onSelect: (instanceKey: InstanceKey) => void;
  rootClassName?: string;
}

/** Create simple property record */
export const createPropertyRecord = (
  name: string,
  displayLabel: string,
  value: number | string,
  displayValue: string,
  editor?: PropertyEditorInfo,
  description?: PropertyDescription
): PropertyRecord => {
  const propValue: PropertyValue = {
    valueFormat: PropertyValueFormat.Primitive,
    displayValue,
    value,
  };
  const propDescription: PropertyDescription = description ?? {
    displayLabel,
    name,
    typename: "string",
  };
  propDescription.editor = editor;

  const record = new PropertyRecord(propValue, propDescription);
  record.isDisabled = false;
  record.isReadonly = !editor;
  return record;
};

/** Map element ids and requests labels */
export const instanceKeysToRowItems = (
  instanceKeys: InstanceKey[],
  labels: string[]
) => {
  const rows = new Array<RowItem>();
  for (let i = 0; i < instanceKeys.length; ++i) {
    const instanceKey = instanceKeys[i];
    const label = labels[i];
    const row: RowItem = { key: instanceKey.id, cells: [] };
    row.cells.push({
      key: "srl-result",
      record: createPropertyRecord("srl-result", label, label, label),
    });
    row.extendedData = {
      key: instanceKey,
    };
    rows.push(row);
  }
  return rows;
};

/** Gets labels from presentation layer, chunks up requests if necessary */
export const getLabels = async (
  labelsProvider: PresentationLabelsProvider,
  instanceKeys: InstanceKey[]
): Promise<string[]> => {
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
};

/** Creates a data provider with the labels */
export const createDataProvider = async (
  labelsProvider: PresentationLabelsProvider,
  instanceKeys: InstanceKey[]
) => {
  const columns: ColumnDescription[] = [
    {
      key: "srl-result",
      label: "",
    },
  ];
  const labels = await getLabels(labelsProvider, instanceKeys);
  const rows = instanceKeysToRowItems(instanceKeys, labels);
  const dataProvider = new SimpleTableDataProvider(columns);
  dataProvider.setItems(rows);
  return dataProvider;
};

/** Shows a list of elements to inspect properties for */
export const ElementList = ({
  iModelConnection,
  instanceKeys,
  onBack,
  onSelect,
  rootClassName,
}: ElementListProps) => {
  const [dataProvider, setDataProvider] =
    React.useState<SimpleTableDataProvider>();

  const labelsProvider: PresentationLabelsProvider = React.useMemo(() => {
    return new PresentationLabelsProvider({
      imodel: iModelConnection,
    });
  }, [iModelConnection]);

  React.useEffect(() => {
    const createAndSetDp = async () => {
      const dp = await createDataProvider(labelsProvider, instanceKeys);
      setDataProvider(dp);
    };

    createAndSetDp().catch(() => {
      Logger.logError(
        "VCR:PropertyGridReact",
        "ElementList: Failed to create Data Provider"
      );
    });
  }, [labelsProvider, instanceKeys]);

  /** On element selected in table, call the onSelect prop */
  const onRowsSelected = React.useCallback(
    async (rowIterator: AsyncIterableIterator<RowItem>, _replace: boolean) => {
      for await (const row of rowIterator) {
        if (row.extendedData?.key) {
          onSelect(row.extendedData.key);
          return false;
        }
      }
      return false;
    },
    [onSelect]
  );

  return (
    <div
      className={classnames("property-grid-react-element-list", rootClassName)}
    >
      <div className="property-grid-react-element-list-header">
        <div
          className="property-grid-react-element-list-back-btn"
          onClick={onBack}
        >
          <Icon
            className="property-grid-react-element-list-icon"
            iconSpec="icon-progress-backward"
          />
        </div>
        <div className="property-grid-react-element-list-title">
          {PropertyGridManager.translate("element-list.title")}
        </div>
      </div>
      <div className="property-grid-react-element-list-container">
        {dataProvider && (
          <Table
            dataProvider={dataProvider}
            onRowsSelected={onRowsSelected}
            selectionMode={SelectionMode.Single}
            hideHeader={true}
          />
        )}
      </div>
      <div className="property-grid-react-element-list-results-label">
        {`${instanceKeys.length} ${PropertyGridManager.translate(
          "element-list.results"
        )}`}
      </div>
    </div>
  );
};

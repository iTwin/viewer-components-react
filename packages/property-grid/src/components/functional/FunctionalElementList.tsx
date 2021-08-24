/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "../ElementList.scss";

import { PresentationLabelsProvider } from "@bentley/presentation-components";
import {
  RowItem,
  SelectionMode,
  SimpleTableDataProvider,
  Table,
} from "@bentley/ui-components";
import { Icon } from "@bentley/ui-core";
import classnames from "classnames";
import * as React from "react";

import { PropertyGridManager } from "../../PropertyGridManager";
import { createDataProvider, ElementListProps } from "../ElementList";

export const FunctionalElementList = ({
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
    const onMount = async () => {
      const dp = await createDataProvider(labelsProvider, instanceKeys);
      setDataProvider(dp);
    };

    onMount().catch(console.log);
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

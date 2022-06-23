/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./ElementList.scss";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import { PresentationLabelsProvider } from "@itwin/presentation-components";
import { MenuItem } from "@itwin/itwinui-react";
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

/** Shows a list of elements to inspect properties for */
export const ElementList = ({
  iModelConnection,
  instanceKeys,
  onBack,
  onSelect,
  rootClassName,
}: ElementListProps) => {
  const [data, setData] = React.useState<string[]>();

  const labelsProvider: PresentationLabelsProvider = React.useMemo(() => {
    return new PresentationLabelsProvider({
      imodel: iModelConnection,
    });
  }, [iModelConnection]);

  React.useEffect(() => {
    const createLabels = async () => {
      const labels = await getLabels(labelsProvider, instanceKeys);
      setData(labels);
    };

    createLabels().catch(() => {
      Logger.logError(
        "VCR:PropertyGridReact",
        "ElementList: Failed to create labels"
      );
    });
  }, [labelsProvider, instanceKeys]);

  const title = `${PropertyGridManager.translate("element-list.title")} (${instanceKeys.length})`;

  return (
    <div
      className={classnames("property-grid-react-element-list", rootClassName)}
    >
      <div className="property-grid-react-element-list-header">
        <div
          className="property-grid-react-element-list-back-btn"
          onClick={onBack}
          onKeyDown={onBack}
          role="button"
          tabIndex={0}
        >
          <Icon
            className="property-grid-react-element-list-icon"
            iconSpec="icon-progress-backward"
          />
        </div>
        <div className="property-grid-react-element-list-title">
          {title}
        </div>
      </div>
      <div className="property-grid-react-element-list-container" role="list">
        {data?.map((label, index) => (
          <MenuItem
            key={index}
            role="listitem"
            onClick={() => {
              onSelect(instanceKeys[index]);
            }}
          >
            {label}
          </MenuItem>
        ))}
      </div>
    </div>
  );
};

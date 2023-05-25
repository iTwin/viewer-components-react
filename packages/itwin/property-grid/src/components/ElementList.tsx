/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./ElementList.scss";
import classnames from "classnames";
import * as React from "react";
import { SvgProgressBackwardCircular } from "@itwin/itwinui-icons-react";
import { IconButton, MenuItem } from "@itwin/itwinui-react";
import { PresentationLabelsProvider } from "@itwin/presentation-components";
import { PropertyGridManager } from "../PropertyGridManager";

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
  rootClassName?: string;
}

/**
 * Shows a list of elements to inspect properties for.
 * @internal
 */
export function ElementList({
  imodel,
  instanceKeys,
  onBack,
  onSelect,
  rootClassName,
}: ElementListProps) {
  const [data, setData] = React.useState<string[]>();

  const labelsProvider: PresentationLabelsProvider = React.useMemo(() => new PresentationLabelsProvider({ imodel }), [imodel]);

  React.useEffect(() => {
    const createLabels = async () => {
      const labels = await getLabels(labelsProvider, instanceKeys);
      setData(labels);
    };

    void createLabels();
  }, [labelsProvider, instanceKeys]);

  const title = `${PropertyGridManager.translate("element-list.title")} (${instanceKeys.length})`;

  return (
    <div
      className={classnames("property-grid-react-element-list", rootClassName)}
    >
      <div className="property-grid-react-element-list-header">
        <IconButton
          id="property-grid-react-element-list-back-btn"
          styleType="borderless"
          onClick={onBack}
          onKeyDown={onBack}
          title={PropertyGridManager.translate("header.back")}
        >
          <SvgProgressBackwardCircular />
        </IconButton>
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

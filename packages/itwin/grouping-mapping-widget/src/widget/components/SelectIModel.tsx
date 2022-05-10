/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  ApiOverrides,
  IModelFull,
} from "@itwin/imodel-browser-react";
import {
  IModelGrid,
} from "@itwin/imodel-browser-react";
import { Button } from "@itwin/itwinui-react";
import React, { useContext, useMemo } from "react";
import { ApiContext } from "./GroupingMapping";
import "./SelectIModel.scss";

interface SelectIModelProps {
  projectId: string;
  onSelect: (project: IModelFull) => void;
  onCancel: () => void;
  backFn: () => void;
}
const SelectIModel = ({
  projectId,
  onSelect,
  onCancel,
  backFn,
}: SelectIModelProps) => {
  const apiContext = useContext(ApiContext);

  const apiOverrides = useMemo<ApiOverrides<IModelFull[]>>(
    () => ({ serverEnvironmentPrefix: apiContext.prefix }),
    [apiContext.prefix]
  );

  return (
    <div className='imodel-grid-container'>
      <div className='imodel-grid'>
        <IModelGrid
          projectId={projectId}
          onThumbnailClick={onSelect}
          accessToken={apiContext.accessToken}
          apiOverrides={apiOverrides}
        />
      </div>
      <div className='import-action-panel'>
        <Button onClick={backFn}>Back</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default SelectIModel;

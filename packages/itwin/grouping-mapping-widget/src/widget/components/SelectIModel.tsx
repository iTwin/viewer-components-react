/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  ApiOverrides,
  IModelFull,
  IModelGrid,
} from "@itwin/imodel-browser-react";
import { Button } from "@itwin/itwinui-react";
import React, { useMemo} from "react";
import { getUrlPrefix } from "../../api/reportingClient";
import useFetchAccessToken from "../hooks/useFetchAccessToken";
import "./SelectIModel.scss";

interface SelectIModelProps {
  projectId: string;
  onSelect: (project: IModelFull) => void;
  backFn: () => void;
}
const SelectIModel = ({ projectId, onSelect, backFn }: SelectIModelProps) => {
  const accessToken = useFetchAccessToken();

  const apiOverrides = useMemo<ApiOverrides<IModelFull[]>>(
    () => ({ serverEnvironmentPrefix: getUrlPrefix() }),
    [],
  );

  return (
    <div className='imodel-grid-container'>
      <div className='imodel-grid'>
        <IModelGrid
          projectId={projectId}
          onThumbnailClick={onSelect}
          accessToken={accessToken}
          apiOverrides={apiOverrides}
        />
      </div>
      <div className='import-action-panel'>
        <Button onClick={backFn}>Back</Button>
      </div>
    </div>
  );
};

export default SelectIModel;

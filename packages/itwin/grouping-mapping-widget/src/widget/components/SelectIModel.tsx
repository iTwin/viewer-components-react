/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import type {
  ApiOverrides,
  IModelFull
} from "@itwin/imodel-browser-react";
import {
  IModelGrid,
} from "@itwin/imodel-browser-react";
import { Button } from "@itwin/itwinui-react";
import React, { useEffect, useMemo, useState } from "react";
import { getUrlPrefix } from "../../api/reportingClient";
import "./SelectIModel.scss";



const useFetchAccessToken = () => {
  const [accessToken, setAccessToken] = useState<string>("");

  useEffect(() => {
    const fetchAccessToken = async () => {
      const accessToken = await IModelApp.authorizationClient?.getAccessToken();
      setAccessToken(accessToken ?? "");
    };
    void fetchAccessToken();
  }, []);

  return accessToken;
};
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
  const accessToken = useFetchAccessToken();

  const apiOverrides = useMemo<ApiOverrides<IModelFull[]>>(
    () => ({ serverEnvironmentPrefix: getUrlPrefix() }),
    []
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
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default SelectIModel;

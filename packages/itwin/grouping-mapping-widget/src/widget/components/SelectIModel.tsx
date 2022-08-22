/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import type {
  ApiOverrides,
  IModelFull,
} from "@itwin/imodel-browser-react";
import {
  IModelGrid,
} from "@itwin/imodel-browser-react";
import { Button } from "@itwin/itwinui-react";
import React, { useEffect, useState } from "react";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
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
  const { getAccessToken, prefix } = useGroupingMappingApiConfig();
  const [accessToken, setAccessToken] = useState<AccessToken>();
  const [apiOverrides, setApiOverrides] = useState<ApiOverrides<IModelFull[]>>(
    () => ({ serverEnvironmentPrefix: prefix })
  );

  useEffect(() => setApiOverrides(() => ({ serverEnvironmentPrefix: prefix })), [prefix]);

  useEffect(() => {
    const fetchAccessToken = async () => {
      const accessToken = await getAccessToken();
      setAccessToken(accessToken);
    };
    void fetchAccessToken();
  }, [getAccessToken]);

  return (
    <div className='gmw-imodel-grid-container'>
      <div className='gmw-imodel-grid'>
        <IModelGrid
          projectId={projectId}
          onThumbnailClick={onSelect}
          accessToken={accessToken}
          apiOverrides={apiOverrides}
        />
      </div>
      <div className='gmw-import-action-panel'>
        <Button onClick={backFn}>Back</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default SelectIModel;

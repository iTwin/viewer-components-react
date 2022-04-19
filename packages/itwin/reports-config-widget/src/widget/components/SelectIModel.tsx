/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";
import type { GetIModelListParams, MinimalIModel } from "@itwin/imodels-client-management";
import { IModelsClient, toArray } from "@itwin/imodels-client-management";
import { ComboBox, Label } from "@itwin/itwinui-react";
import React, { useCallback, useMemo } from "react";
import { useEffect, useState } from "react";
import './SelectIModel.scss'
import { LoadingSpinner } from "./utils";

const fetchIModels = async (
  setiModels: React.Dispatch<React.SetStateAction<MinimalIModel[]>>,
  iTwinId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  try {
    const accessToken = (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    const iModelsClient: IModelsClient = new IModelsClient();
    const authorization = AccessTokenAdapter.toAuthorizationCallback(accessToken);
    const getiModelListParams: GetIModelListParams = {
      urlParams: { projectId: iTwinId },
      authorization,
    };
    const iModels = await toArray(iModelsClient.iModels.getMinimalList(getiModelListParams));
    setiModels(iModels);

  } catch (error: any) {
  } finally {
    setIsLoading(false);
  }
};

const useFetchIModels = (
  iTwinId: string | undefined,
  iModelId: string | undefined,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
): [
    MinimalIModel[],
    React.Dispatch<React.SetStateAction<MinimalIModel[]>>
  ] => {
  const [iModels, setIModels] = useState<MinimalIModel[]>([]);
  useEffect(() => {
    if (iModelId && iTwinId) {
      void fetchIModels(setIModels, iTwinId, setIsLoading);
    }
  }, [setIModels, setIsLoading, iModelId, iTwinId]);


  return [iModels, setIModels];
};

interface SelectedIModelProps {
  selectedIModelId: string;
  setSelectedIModelId: React.Dispatch<React.SetStateAction<string>>;
}

export const SelectIModel = ({ selectedIModelId, setSelectedIModelId }: SelectedIModelProps) => {
  const iModelId = useActiveIModelConnection()?.iModelId;
  const iTwinId = useActiveIModelConnection()?.iTwinId;
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [iModels] = useFetchIModels(iTwinId, iModelId, setIsLoading);

  useEffect(() => {
    if (iModelId && iModels.length > 0) {
      setSelectedIModelId(iModelId);
    }
  }, [iModelId, iModels, setSelectedIModelId]);


  const iModelOptions = useMemo(() => {
    return iModels.map((iModel) => ({ label: iModel.displayName, value: iModel.id }));
  }, [iModels]);

  return (
    <div className="reports-select-imodel">
      <Label htmlFor='combo-input'>{IModelApp.localization.getLocalizedString("ReportsConfigWidget:SelectIModel")}</Label>
      <div className="combobox">
        <ComboBox<string>
          options={iModelOptions}
          value={selectedIModelId}
          onChange={(value) => {
            setSelectedIModelId(value)
          }}
          inputProps={{
            id: 'combo-input'
          }}
          style={{ flexGrow: 1, maxWidth: '395px' }}
        />
        {isLoading &&
          <LoadingSpinner />
        }
      </div>
    </div>);

};

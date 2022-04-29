/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";
import type { GetIModelListParams, IModelsClientOptions, MinimalIModel } from "@itwin/imodels-client-management";
import { Constants } from "@itwin/imodels-client-management";
import { IModelsClient, toArray } from "@itwin/imodels-client-management";
import { ComboBox, Label } from "@itwin/itwinui-react";
import React, { useContext, useMemo } from "react";
import { useEffect, useState } from "react";
import { Api, ApiContext, useApi } from "../context/ApiContext";
import { useActiveIModel } from "../hooks/useActiveIModel";
import "./SelectIModel.scss";
import { LoadingSpinner, prefixUrl } from "./utils";

const fetchIModels = async (
  setiModels: React.Dispatch<React.SetStateAction<MinimalIModel[]>>,
  iTwinId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  apiContext: Api
) => {
  try {
    const iModelClientOptions: IModelsClientOptions = {
      api: { baseUrl: prefixUrl(Constants.api.baseUrl, apiContext.prefix) },
    };

    const iModelsClient: IModelsClient = new IModelsClient(iModelClientOptions);
    const authorization = AccessTokenAdapter.toAuthorizationCallback(apiContext.accessToken);
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

interface SelectedIModelProps {
  selectedIModelId: string;
  setSelectedIModelId: React.Dispatch<React.SetStateAction<string>>;
}

export const SelectIModel = ({ selectedIModelId, setSelectedIModelId }: SelectedIModelProps) => {
  const apiContext = useApi();
  const { iTwinId, iModelId } = useActiveIModel();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [iModels, setIModels] = useState<MinimalIModel[]>([]);

  useEffect(() => {
    if (iModelId && iTwinId) {
      void fetchIModels(setIModels, iTwinId, setIsLoading, apiContext);
    }
  }, [apiContext, setIModels, setIsLoading, iModelId, iTwinId]);

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
            setSelectedIModelId(value);
          }}
          inputProps={{
            id: "combo-input",
          }}
          style={{ flexGrow: 1, maxWidth: "395px" }}
        />
        {isLoading &&
          <LoadingSpinner />
        }
      </div>
    </div>);

};

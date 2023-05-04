/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";
import type {
  GetIModelListParams,
  IModelsClientOptions,
  MinimalIModel,
} from "@itwin/imodels-client-management";
import {
  Constants,
  IModelsClient,
  toArray,
} from "@itwin/imodels-client-management";
import { ComboBox, Label } from "@itwin/itwinui-react";
import React, { useEffect, useMemo, useState } from "react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import { useReportsApiConfig } from "../context/ReportsApiConfigContext";
import "./SelectIModel.scss";
import { generateUrl } from "./utils";

const fetchIModels = async (
  setiModels: React.Dispatch<React.SetStateAction<MinimalIModel[]>>,
  iTwinId: string,
  baseUrl: string,
  getAccessToken: () => Promise<AccessToken>
) => {
  const iModelClientOptions: IModelsClientOptions = {
    api: { baseUrl: generateUrl(Constants.api.baseUrl, baseUrl) },
  };

  const iModelsClient: IModelsClient = new IModelsClient(iModelClientOptions);
  const accessToken = await getAccessToken();
  const authorization = AccessTokenAdapter.toAuthorizationCallback(accessToken);
  const getiModelListParams: GetIModelListParams = {
    urlParams: { projectId: iTwinId },
    authorization,
  };
  const iModels = await toArray(
    iModelsClient.iModels.getMinimalList(getiModelListParams)
  );
  setiModels(iModels);
};

interface SelectedIModelProps {
  selectedIModelId: string;
  setSelectedIModelId: React.Dispatch<React.SetStateAction<string>>;
}

export const SelectIModel = ({
  selectedIModelId,
  setSelectedIModelId,
}: SelectedIModelProps) => {
  const { iTwinId, iModelId, getAccessToken, baseUrl } = useReportsApiConfig();
  const [iModels, setIModels] = useState<MinimalIModel[]>([]);

  useEffect(() => {
    void fetchIModels(setIModels, iTwinId, baseUrl, getAccessToken);
  }, [baseUrl, getAccessToken, iTwinId, setIModels]);

  useEffect(() => {
    if (iModels.length > 0) {
      setSelectedIModelId(iModelId);
    }
  }, [iModelId, iModels, setSelectedIModelId]);

  const iModelOptions = useMemo(() => {
    return iModels.map((iModel) => ({
      label: iModel.displayName,
      value: iModel.id,
    }));
  }, [iModels]);

  return (
    <div className="rcw-select-imodel">
      <Label htmlFor="combo-input">
        {ReportsConfigWidget.localization.getLocalizedString(
          "ReportsConfigWidget:SelectIModel"
        )}
      </Label>
      <div className="rcw-combobox">
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
      </div>
    </div>
  );
};

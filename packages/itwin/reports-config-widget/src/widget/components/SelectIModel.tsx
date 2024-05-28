/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";
import type { GetIModelListParams, IModelsClient, MinimalIModel } from "@itwin/imodels-client-management";
import { toArray } from "@itwin/imodels-client-management";
import { ComboBox, Label } from "@itwin/itwinui-react";
import React, { useEffect, useMemo, useState } from "react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import { useReportsConfigApi } from "../context/ReportsConfigApiContext";
import "./SelectIModel.scss";

const fetchIModels = async (
  setiModels: React.Dispatch<React.SetStateAction<MinimalIModel[]>>,
  iTwinId: string,
  iModelsClient: IModelsClient,
  getAccessToken: () => Promise<AccessToken>,
) => {
  const accessToken = await getAccessToken();
  const authorization = AccessTokenAdapter.toAuthorizationCallback(accessToken);
  const getiModelListParams: GetIModelListParams = {
    urlParams: { iTwinId },
    authorization,
  };
  const iModels = await toArray(iModelsClient.iModels.getMinimalList(getiModelListParams));
  setiModels(iModels);
};

interface SelectedIModelProps {
  selectedIModelId?: string;
  setSelectedIModelId: (iModelId: string) => void;
}

export const SelectIModel = ({ selectedIModelId, setSelectedIModelId }: SelectedIModelProps) => {
  const { iTwinId, getAccessToken, iModelsClient } = useReportsConfigApi();
  const [iModels, setIModels] = useState<MinimalIModel[]>([]);

  useEffect(() => {
    void fetchIModels(setIModels, iTwinId, iModelsClient, getAccessToken);
  }, [getAccessToken, iModelsClient, iTwinId, setIModels]);

  const iModelOptions = useMemo(() => {
    return iModels.map((iModel) => ({
      label: iModel.displayName,
      value: iModel.id,
    }));
  }, [iModels]);

  return (
    <div className="rcw-select-imodel">
      <Label htmlFor="combo-input">{ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:SelectIModel")}</Label>
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

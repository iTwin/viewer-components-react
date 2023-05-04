import { IModelApp } from "@itwin/core-frontend";
import { toaster } from "@itwin/itwinui-react";
import React, { useEffect, useMemo, useState } from "react";
import { BulkExtractorContext } from "../context/BulkExtractorContext";
import type {
  GetAccessTokenFn,
  ReportsApiConfig,
} from "../context/ReportsApiConfigContext";
import { ReportsApiConfigContext } from "../context/ReportsApiConfigContext";
import { REPORTS_CONFIG_BASE_URL } from "../ReportsConfigUiProvider";
import { BulkExtractor } from "./BulkExtractor";
import { FailedExtractionToast, SuccessfulExtractionToast } from "./ExtractionToast";

export interface ReportsConfigContextProps {
  getAccessToken?: GetAccessTokenFn;
  baseUrl?: string;
  iTwinId: string;
  iModelId: string;
  bulkExtractor?: BulkExtractor;
  children?: React.ReactNode;
}
const authorizationClientGetAccessToken = async () =>
  (await IModelApp.authorizationClient?.getAccessToken()) ?? "";

export const ReportsConfigContext = (props: ReportsConfigContextProps) => {
  const [apiConfig, setApiConfig] = useState<ReportsApiConfig>({
    getAccessToken: props.getAccessToken ?? authorizationClientGetAccessToken,
    baseUrl: props.baseUrl || REPORTS_CONFIG_BASE_URL,
    iTwinId: props.iTwinId,
    iModelId: props.iModelId,
  });

  const successfulExtractionToast = (iModelName: string, odataFeedUrl: string) => {
    toaster.positive(<SuccessfulExtractionToast iModelName={iModelName} odataFeedUrl={odataFeedUrl} />);
  };

  const failedExtractionToast = (iModelName: string) => {
    toaster.negative(<FailedExtractionToast iModelName={iModelName} />);
  };

  const bulkExtractor = useMemo(
    () => ({ bulkExtractor: props.bulkExtractor ?? new BulkExtractor(apiConfig, successfulExtractionToast, failedExtractionToast) }),
    [apiConfig, props.bulkExtractor]
  );

  useEffect(() => {
    setApiConfig(() => ({
      getAccessToken: props.getAccessToken ?? authorizationClientGetAccessToken,
      baseUrl: props.baseUrl || REPORTS_CONFIG_BASE_URL,
      iTwinId: props.iTwinId,
      iModelId: props.iModelId,
    }));
  }, [props.getAccessToken, props.baseUrl, props.iTwinId, props.iModelId]);

  return (
    <ReportsApiConfigContext.Provider value={apiConfig}>
      <BulkExtractorContext.Provider value={bulkExtractor}>
        {props.children}
      </BulkExtractorContext.Provider>
    </ReportsApiConfigContext.Provider>
  );
};

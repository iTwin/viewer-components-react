/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import type { IModelsClientOptions } from "@itwin/imodels-client-management";
import { IModelsClient } from "@itwin/imodels-client-management";
import { ExtractionClient, GROUPING_AND_MAPPING_BASE_PATH, MappingsClient, REPORTING_BASE_PATH, ReportsClient } from "@itwin/insights-client";
import { toaster } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BulkExtractorContext } from "../context/BulkExtractorContext";
import type {
  GetAccessTokenFn,
  ReportsConfigApiProps,
} from "../context/ReportsConfigApiContext";
import { ReportsConfigApiContext } from "../context/ReportsConfigApiContext";
import { REPORTS_CONFIG_BASE_URL } from "../ReportsConfigUiProvider";
import { BulkExtractor } from "./BulkExtractor";
import { IMODELS_BASE_URL } from "./Constants";
import { FailedExtractionToast, SuccessfulExtractionToast } from "./ExtractionToast";
import { generateUrl } from "./utils";

/**
 * Props for the {@link ReportsConfigContext} component.
 * @public
 */
export interface ReportsConfigContextProps {
  getAccessToken?: GetAccessTokenFn;
  baseUrl?: string;
  iTwinId: string;
  bulkExtractor?: BulkExtractor;
  reportsClient?: ReportsClient;
  mappingsClient?: MappingsClient;
  extractionClient?: ExtractionClient;
  iModelsClient?: IModelsClient;
  children?: React.ReactNode;
}

const authorizationClientGetAccessToken = async () =>
  (await IModelApp.authorizationClient?.getAccessToken()) ?? "";

/**
 * Reports Config context providers required for all components.
 * @public
 */
export const ReportsConfigContext = (props: ReportsConfigContextProps) => {
  const reportsBaseUrl = useCallback(() => generateUrl(
    REPORTING_BASE_PATH,
    props.baseUrl || REPORTS_CONFIG_BASE_URL
  ), [props.baseUrl]);
  const groupingMappingBaseUrl = useCallback(() => generateUrl(
    GROUPING_AND_MAPPING_BASE_PATH,
    props.baseUrl || REPORTS_CONFIG_BASE_URL
  ), [props.baseUrl]);
  const iModelClientOptions: IModelsClientOptions = useMemo(() => ({
    api: { baseUrl: generateUrl(IMODELS_BASE_URL, props.baseUrl ?? REPORTS_CONFIG_BASE_URL) },
  }), [props.baseUrl]);
  const [extractionClient, setExtractionClient] = useState<ExtractionClient>(
    props.extractionClient ?? new ExtractionClient(reportsBaseUrl())
  );

  const [apiConfig, setApiConfig] = useState<ReportsConfigApiProps>({
    getAccessToken: props.getAccessToken ?? authorizationClientGetAccessToken,
    baseUrl: reportsBaseUrl(),
    iTwinId: props.iTwinId,
    reportsClient: props.reportsClient ?? new ReportsClient(reportsBaseUrl()),
    mappingsClient: props.mappingsClient ?? new MappingsClient(groupingMappingBaseUrl()),
    iModelsClient: props.iModelsClient ?? new IModelsClient(iModelClientOptions),
  });

  useEffect(() => {
    if (!props.extractionClient) {
      setExtractionClient(props.extractionClient ?? new ExtractionClient(reportsBaseUrl()));
    }
  }, [props.extractionClient, reportsBaseUrl]);

  const successfulExtractionToast = (iModelName: string, odataFeedUrl: string) => {
    toaster.positive(<SuccessfulExtractionToast iModelName={iModelName} odataFeedUrl={odataFeedUrl} />);
  };

  const failedExtractionToast = (iModelName: string) => {
    toaster.negative(<FailedExtractionToast iModelName={iModelName} />);
  };

  const bulkExtractor = useMemo(
    () => ({
      bulkExtractor:
        props.bulkExtractor ??
        new BulkExtractor(
          apiConfig.reportsClient,
          extractionClient,
          apiConfig.getAccessToken,
          successfulExtractionToast,
          failedExtractionToast,
        ),
    }),
    [apiConfig.getAccessToken, apiConfig.reportsClient, extractionClient, props.bulkExtractor],
  );

  useEffect(() => {
    setApiConfig(() => ({
      getAccessToken: props.getAccessToken ?? authorizationClientGetAccessToken,
      baseUrl: props.baseUrl || REPORTS_CONFIG_BASE_URL,
      iTwinId: props.iTwinId,
      reportsClient: props.reportsClient ?? new ReportsClient(reportsBaseUrl()),
      mappingsClient: props.mappingsClient ?? new MappingsClient(reportsBaseUrl()),
      iModelsClient: props.iModelsClient ?? new IModelsClient(iModelClientOptions),
    }));
  }, [props.getAccessToken, props.baseUrl, props.iTwinId, props.reportsClient, props.mappingsClient, props.iModelsClient, reportsBaseUrl, iModelClientOptions]);

  return (
    <ReportsConfigApiContext.Provider value={apiConfig}>
      <BulkExtractorContext.Provider value={bulkExtractor}>
        {props.children}
      </BulkExtractorContext.Provider>
    </ReportsConfigApiContext.Provider>
  );
};

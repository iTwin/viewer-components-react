/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  SvgAdd,
  SvgCopy,
  SvgDelete,
  SvgMore,
} from "@itwin/itwinui-icons-react";
import {
  Button,
  DropdownMenu,
  IconButton,
  LabeledInput,
  MenuItem,
  Surface,
  Text,
  toaster,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "./utils";
import { EmptyMessage, generateUrl, LoadingOverlay } from "./utils";
import { handleError, WidgetHeader } from "./utils";
import "./ReportMappings.scss";
import DeleteModal from "./DeleteModal";
import type { Report, ReportMapping } from "@itwin/insights-client";
import { REPORTING_BASE_PATH } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import AddMappingsModal from "./AddMappingsModal";
import type { GetSingleIModelParams, IModelsClientOptions } from "@itwin/imodels-client-management";
import { Constants } from "@itwin/imodels-client-management";
import { IModelsClient } from "@itwin/imodels-client-management";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";
import { HorizontalTile } from "./HorizontalTile";
import { Extraction, ExtractionStates, ExtractionStatus } from "./Extraction";
import { SearchBar } from "./SearchBar";
import type { Api } from "../context/ApiContext";
import { useApi } from "../context/ApiContext";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";

export type ReportMappingType = CreateTypeFromInterface<ReportMapping>;

export type ReportMappingAndMapping = ReportMappingType & { mappingName: string, mappingDescription: string, iModelName: string };

enum ReportMappingsView {
  REPORTMAPPINGS = "reportmappings",
  ADDING = "adding"
}

const fetchReportMappings = async (
  setReportMappings: React.Dispatch<React.SetStateAction<ReportMappingAndMapping[]>>,
  reportId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  apiContext: Api
) => {
  try {
    setIsLoading(true);
    const reportingClientApi = new ReportingClient(generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl));
    const accessToken = await apiContext.getAccessToken();
    const reportMappings = await reportingClientApi.getReportMappings(accessToken, reportId);
    const iModelClientOptions: IModelsClientOptions = {
      api: { baseUrl: generateUrl(Constants.api.baseUrl, apiContext.baseUrl) },
    };

    const iModelsClient: IModelsClient = new IModelsClient(iModelClientOptions);
    const authorization = AccessTokenAdapter.toAuthorizationCallback(accessToken);
    const iModelNames = new Map<string, string>();
    const reportMappingsAndMapping = await Promise.all(reportMappings?.map(async (reportMapping) => {
      const iModelId = reportMapping.imodelId ?? "";
      let iModelName = "";
      const mapping = await reportingClientApi.getMapping(accessToken, reportMapping.mappingId ?? "", iModelId);
      if (iModelNames.has(iModelId)) {
        iModelName = iModelNames.get(iModelId) ?? "";
      } else {
        const getSingleParams: GetSingleIModelParams = { authorization, iModelId };
        const iModel = await iModelsClient.iModels.getSingle(getSingleParams);
        iModelName = iModel.displayName;
        iModelNames.set(iModelId, iModelName);
      }
      const reportMappingAndMapping: ReportMappingAndMapping = {
        ...reportMapping,
        iModelName,
        mappingName: mapping.mapping?.mappingName ?? "",
        mappingDescription: mapping.mapping?.description ?? "",
      };
      return reportMappingAndMapping;
    }) ?? []);

    setReportMappings(reportMappingsAndMapping);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

interface ReportMappingsProps {
  report: Report;
  goBack: () => Promise<void>;
}

export const ReportMappings = ({ report, goBack }: ReportMappingsProps) => {
  const apiContext = useApi();
  const [reportMappingsView, setReportMappingsView] = useState<ReportMappingsView>(
    ReportMappingsView.REPORTMAPPINGS
  );
  const [selectedReportMapping, setSelectedReportMapping] = useState<
    ReportMappingAndMapping | undefined
  >(undefined);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [extractionState, setExtractionState] = useState<ExtractionStates>(ExtractionStates.None);
  const [runningIModelId, setRunningIModelId] = useState<string>("");
  const [searchValue, setSearchValue] = useState<string>("");
  const [reportMappings, setReportMappings] = useState<ReportMappingAndMapping[]>([]);

  useEffect(() => {
    void fetchReportMappings(setReportMappings, report.id ?? "", setIsLoading, apiContext);
  }, [apiContext, report.id, setIsLoading]);

  const refresh = useCallback(async () => {
    setReportMappingsView(ReportMappingsView.REPORTMAPPINGS);
    await fetchReportMappings(setReportMappings, report.id ?? "", setIsLoading, apiContext);
  }, [apiContext, report.id, setReportMappings]);

  const addMapping = () => {
    setReportMappingsView(ReportMappingsView.ADDING);
  };

  const uniqueIModels = useMemo(() => new Map(reportMappings.map((mapping) => [mapping.imodelId ?? "", mapping.iModelName])), [reportMappings]);

  const odataFeedUrl = `${generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl)}/odata/${report.id}`;

  const filteredReportMappings = useMemo(() => reportMappings.filter((x) =>
    [x.iModelName, x.mappingName, x.mappingDescription]
      .join(" ")
      .toLowerCase()
      .includes(searchValue.toLowerCase())), [reportMappings, searchValue]);

  return (
    <>
      <WidgetHeader title={report.displayName ?? ""} returnFn={goBack} />
      <div className="report-mapping-misc">
        <LabeledInput
          label={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ODataFeedURL")}
          className="odata-url-input"
          readOnly={true}
          value={odataFeedUrl}
          svgIcon={
            <IconButton title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Copy")} styleType='borderless' onClick={async (_) => {
              await navigator.clipboard.writeText(odataFeedUrl);
              toaster.positive(ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:CopiedToClipboard"));
            }}>
              <SvgCopy />
            </IconButton>
          }
          iconDisplayStyle='inline'
        />
        <Extraction
          iModels={uniqueIModels}
          extractionState={extractionState}
          setExtractionState={setExtractionState}
          setExtractingIModelId={setRunningIModelId}
          isLoading={isLoading} />
      </div>
      <Surface className="report-mappings-container">
        <div className="toolbar">
          <Button
            startIcon={<SvgAdd />}
            onClick={() => addMapping()}
            styleType="high-visibility"
          >
            {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:AddMapping")}
          </Button>
          <div className="search-bar-container" data-testid="search-bar">
            <SearchBar searchValue={searchValue} setSearchValue={setSearchValue} disabled={isLoading} />
          </div>
        </div>
        {isLoading ?
          <LoadingOverlay /> :
          reportMappings.length === 0 ?
            <EmptyMessage>
              <>
                <Text>{ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:NoReportMappings")}</Text>
                <div>
                  <Button
                    onClick={() => addMapping()}
                    styleType='cta'>
                    {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:LetsAddSomeMappingsCTA")}
                  </Button>
                </div>
              </>
            </EmptyMessage> :
            <div className="mapping-list">{filteredReportMappings.map((mapping) =>
              <HorizontalTile
                key={mapping.mappingId}
                title={mapping.mappingName}
                subText={mapping.iModelName}
                titleTooltip={mapping.mappingDescription}
                button={<ExtractionStatus
                  state={mapping.imodelId === runningIModelId ? extractionState : ExtractionStates.None} >
                  <DropdownMenu
                    menuItems={(close: () => void) => [
                      <MenuItem
                        key={0}
                        onClick={
                          () => {
                            setSelectedReportMapping(mapping);
                            setShowDeleteModal(true);
                            close();
                          }}
                        icon={<SvgDelete />}
                      >
                        {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Remove")}
                      </MenuItem>,
                    ]}
                  >
                    <IconButton styleType="borderless">
                      <SvgMore
                        style={{
                          width: "16px",
                          height: "16px",
                        }}
                      />
                    </IconButton>
                  </DropdownMenu>
                </ExtractionStatus>}
              />)}
            </div>
        }
      </Surface>
      <AddMappingsModal
        show={reportMappingsView === ReportMappingsView.ADDING}
        reportId={report.id ?? ""}
        existingMappings={reportMappings}
        returnFn={refresh}
      />
      <DeleteModal
        entityName={selectedReportMapping?.mappingName ?? ""}
        show={showDeleteModal}
        setShow={setShowDeleteModal}
        onDelete={async () => {
          const reportingClientApi = new ReportingClient(generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl));
          const accessToken = await apiContext.getAccessToken();
          await reportingClientApi.deleteReportMapping(
            accessToken,
            report.id ?? "",
            selectedReportMapping?.mappingId ?? ""
          );
        }}
        refresh={refresh}
      />
    </>
  );

};

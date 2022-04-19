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
  ProgressRadial,
  TablePaginatorRendererProps,
} from "@itwin/itwinui-react";
import {
  Button,
  Checkbox,
  DropdownMenu,
  IconButton,
  LabeledInput,
  MenuItem,
  Table,
  tableFilters,
  TablePaginator,
  Text,
  toaster,
  ToggleSwitch,
} from "@itwin/itwinui-react";
import type { CellProps } from "react-table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CreateTypeFromInterface, EmptyMessage, LoadingOverlay } from "./utils";
import { handleError, WidgetHeader } from "./utils";
import "./ReportMappings.scss";
import DeleteModal from "./DeleteModal";
import type { Report, ReportMapping } from "../../reporting";
import { ReportingClient } from "../../reporting/reportingClient";
import { IModelApp } from "@itwin/core-frontend";
import AddMappingsModal from "./AddMappingsModal";
import type { GetSingleIModelParams } from "@itwin/imodels-client-management";
import { IModelsClient } from "@itwin/imodels-client-management";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";
import { HorizontalTile } from "./HorizontalTile";
import { Extraction, ExtractionStates, ExtractionStatus } from "./Extraction";
import { SearchBar } from "./SearchBar";

export type ReportMappingType = CreateTypeFromInterface<ReportMapping>;

export type ReportMappingAndMapping = ReportMappingType & { mappingName: string, mappingDescription: string, iModelName: string };

enum ReportMappingsView {
  REPORTMAPPINGS = "reportmappings",
  ADDING = "adding"
}

const fetchReportMappings = async (
  setReportMappings: React.Dispatch<React.SetStateAction<ReportMappingAndMapping[]>>,
  reportId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  try {
    setIsLoading(true);
    const accessToken = (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    const reportingClientApi = new ReportingClient();
    const reportMappings = await reportingClientApi.getReportMappings(accessToken, reportId);
    const iModelsClient: IModelsClient = new IModelsClient();
    const authorization = AccessTokenAdapter.toAuthorizationCallback(accessToken);
    const iModelNames = new Map<string, string>();
    const reportMappingsAndMapping = await Promise.all(reportMappings.mappings?.map(async (reportMapping) => {
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

const useFetchReportMappings = (
  reportId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
): [
    ReportMappingAndMapping[],
    React.Dispatch<React.SetStateAction<ReportMappingAndMapping[]>>
  ] => {
  const [reportMappings, setReportMappings] = useState<ReportMappingAndMapping[]>([]);
  useEffect(() => {
    void fetchReportMappings(setReportMappings, reportId, setIsLoading);
  }, [reportId, setIsLoading]);

  return [reportMappings, setReportMappings];
};

interface ReportMappingsProps {
  report: Report;
  goBack: () => Promise<void>;
}

export const ReportMappings = ({ report, goBack }: ReportMappingsProps) => {
  const [reportMappingsView, setReportMappingsView] = useState<ReportMappingsView>(
    ReportMappingsView.REPORTMAPPINGS
  );
  const [selectedReportMapping, setSelectedReportMapping] = useState<
    ReportMappingAndMapping | undefined
  >(undefined);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reportMappings, setReportMappings] = useFetchReportMappings(report.id ?? "", setIsLoading);
  const [extractionState, setExtractionState] = useState<ExtractionStates>(ExtractionStates.None);
  const [runningIModelId, setRunningIModelId] = useState<string>("");
  const [searchValue, setSearchValue] = useState<string>("");



  const refresh = useCallback(async () => {
    setReportMappingsView(ReportMappingsView.REPORTMAPPINGS);
    setReportMappings([]);
    await fetchReportMappings(setReportMappings, report.id ?? "", setIsLoading);
  }, [report.id, setReportMappings]);

  const addMapping = () => {
    setReportMappingsView(ReportMappingsView.ADDING);
  };

  const uniqueIModels = useMemo(() => new Map(reportMappings.map(mapping => [mapping.imodelId ?? "", mapping.iModelName])), [reportMappings])



  const odataFeedUrl = `https://${process.env.IMJS_URL_PREFIX}api.bentley.com/insights/reporting/odata/${report.id}`;


  const filteredReportMappings = useMemo(() => reportMappings.filter((x) =>
    [x.iModelName, x.mappingName, x.mappingDescription]
      .join(' ')
      .toLowerCase()
      .includes(searchValue.toLowerCase())), [reportMappings, searchValue])

  return (
    <>
      <WidgetHeader title={report.displayName ?? ""} returnFn={goBack} />
      <LabeledInput
        label={IModelApp.localization.getLocalizedString("ReportsWidget:ODataFeedURL")}
        className="odata-url-input"
        readOnly={true}
        value={odataFeedUrl}
        svgIcon={
          <IconButton styleType='borderless' onClick={async (_) => {
            await navigator.clipboard.writeText(odataFeedUrl);
            toaster.positive(IModelApp.localization.getLocalizedString("ReportsWidget:CopiedToClipboard"));
          }}>
            <SvgCopy />
          </IconButton>
        }
        iconDisplayStyle='inline'
      />
      <div className="report-mappings-container">
        <div className="toolbar">
          <Button
            startIcon={<SvgAdd />}
            onClick={() => addMapping()}
            styleType="high-visibility"
          >
            {IModelApp.localization.getLocalizedString("ReportsWidget:AddMapping")}
          </Button>
          <Extraction
            iModels={uniqueIModels}
            extractionState={extractionState}
            setExtractionState={setExtractionState}
            setExtractingIModelId={setRunningIModelId} />
        </div>
        <div className="search-bar-container">
          <SearchBar searchValue={searchValue} setSearchValue={setSearchValue} disabled={isLoading} />
        </div>
        {isLoading ?
          <LoadingOverlay /> :
          reportMappings.length === 0 ?
            <EmptyMessage>
              <>
                <Text>{IModelApp.localization.getLocalizedString("ReportsWidget:NoReportMappings")}</Text>
                <Text
                  className="iui-anchor"
                  onClick={() => addMapping()}
                > {IModelApp.localization.getLocalizedString("ReportsWidget:LetsAddSomeMappingsCTA")}</Text>
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
                  <IconButton title={IModelApp.localization.getLocalizedString("ReportsWidget:Delete")}
                    styleType="borderless" onClick={
                      () => {
                        setSelectedReportMapping(mapping);
                        setShowDeleteModal(true);
                      }}
                  ><SvgDelete /></IconButton>
                </ExtractionStatus>}
              />)}
            </div>
        }

      </div>
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
          const accessToken = (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
          const reportingClientApi = new ReportingClient();
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

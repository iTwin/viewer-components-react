/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgAdd, SvgCopy, SvgRefresh } from "@itwin/itwinui-icons-react";
import { Button, IconButton, LabeledInput, Text, toaster } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "./utils";
import { EmptyMessage, generateUrl, handleError, LoadingOverlay, LoadingSpinner } from "./utils";
import "./ReportMappings.scss";
import DeleteModal from "./DeleteModal";
import type { MappingsClient, Report, ReportMapping, ReportsClient } from "@itwin/insights-client";
import { REPORTING_BASE_PATH } from "@itwin/insights-client";
import { AddMappingsModal } from "./AddMappingsModal";
import type { GetSingleIModelParams, IModelsClient } from "@itwin/imodels-client-management";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";
import { SearchBar } from "./SearchBar";
import { useReportsConfigApi } from "../context/ReportsConfigApiContext";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import { ReportMappingHorizontalTile } from "./ReportMappingHorizontalTile";
import type { AccessToken } from "@itwin/core-bentley";
import { BeEvent } from "@itwin/core-bentley";
import { useBulkExtractor } from "../context/BulkExtractorContext";

export type ReportMappingType = CreateTypeFromInterface<ReportMapping>;

export type ReportMappingAndMapping = ReportMappingType & {
  mappingName: string;
  mappingDescription: string;
  iModelName: string;
};

const fetchReportMappings = async (
  setReportMappings: (mappings: ReportMappingAndMapping[]) => void,
  reportId: string,
  setIsLoading: (isLoading: boolean) => void,
  reportsClient: ReportsClient,
  mappingsClient: MappingsClient,
  iModelsClient: IModelsClient,
  getAccessToken: () => Promise<AccessToken>,
) => {
  try {
    setIsLoading(true);
    const accessToken = await getAccessToken();
    const reportMappings = await reportsClient.getReportMappings(accessToken, reportId);
    const authorization = AccessTokenAdapter.toAuthorizationCallback(accessToken);
    const iModelNames = new Map<string, string>();

    const reportMappingsAndMappings = [];
    for (const reportMapping of reportMappings) {
      const iModelId = reportMapping.imodelId;
      let iModelName = "";
      const mapping = await mappingsClient.getMapping(accessToken, iModelId, reportMapping.mappingId);
      if (iModelNames.has(iModelId)) {
        iModelName = iModelNames.get(iModelId) ?? "";
      } else {
        const getSingleParams: GetSingleIModelParams = {
          authorization,
          iModelId,
        };
        const iModel = await iModelsClient.iModels.getSingle(getSingleParams);
        iModelName = iModel.displayName;
        iModelNames.set(iModelId, iModelName);
      }
      const reportMappingAndMapping: ReportMappingAndMapping = {
        ...reportMapping,
        iModelName,
        mappingName: mapping.mappingName,
        mappingDescription: mapping.description ?? "",
      };
      reportMappingsAndMappings.push(reportMappingAndMapping);
    }

    setReportMappings(reportMappingsAndMappings);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

/**
 * Props for the {@link ReportMappings} component.
 * @public
 */
export interface ReportMappingsProps {
  report: Report;
  onClickClose: () => void;
  defaultIModelId?: string;
}

/**
 * Component to display and manage report mappings.
 * @public
 */
export const ReportMappings = ({ report, onClickClose, defaultIModelId }: ReportMappingsProps) => {
  const { getAccessToken, reportsClient, iModelsClient, mappingsClient, baseUrl } = useReportsConfigApi();
  const [showDeleteModal, setShowDeleteModal] = useState<ReportMappingAndMapping | undefined>(undefined);
  const [showAddMapping, setShowAddMapping] = useState<boolean>(false);
  const { bulkExtractor } = useBulkExtractor();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchValue, setSearchValue] = useState<string>("");
  const [reportMappings, setReportMappings] = useState<ReportMappingAndMapping[]>([]);
  const [jobRunning, setJobRunning] = useState<boolean>(false);
  const jobStartEvent = useMemo(() => new BeEvent<(iModelId: string) => void>(), []);

  useEffect(() => {
    void fetchReportMappings(setReportMappings, report.id, setIsLoading, reportsClient, mappingsClient, iModelsClient, getAccessToken);
  }, [getAccessToken, iModelsClient, mappingsClient, report.id, reportsClient, setIsLoading]);

  useEffect(() => {
    if (!bulkExtractor) return;
    bulkExtractor.setHook(
      setJobRunning,
      reportMappings.map((x) => x.imodelId),
    );
  }, [bulkExtractor, reportMappings]);

  const refresh = useCallback(async () => {
    await fetchReportMappings(setReportMappings, report.id, setIsLoading, reportsClient, mappingsClient, iModelsClient, getAccessToken);
  }, [getAccessToken, iModelsClient, mappingsClient, report.id, reportsClient]);

  const odataFeedUrl = `${generateUrl(REPORTING_BASE_PATH, baseUrl)}/odata/${report.id}`;

  const addMapping = useCallback(() => {
    setShowAddMapping(true);
  }, []);

  const filteredReportMappings = useMemo(
    () => reportMappings.filter((x) => [x.iModelName, x.mappingName, x.mappingDescription].join(" ").toLowerCase().includes(searchValue.toLowerCase())),
    [reportMappings, searchValue],
  );

  const onAddMappingsModalClose = useCallback(async () => {
    await refresh();
    setShowAddMapping(false);
  }, [refresh]);

  if (!bulkExtractor) return null;

  return (
    <>
      <div className="rcw-report-mappings-container">
        <LabeledInput
          label={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ODataFeedURL")}
          className="rcw-odata-url-input"
          readOnly={true}
          value={odataFeedUrl}
          svgIcon={
            <IconButton
              title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Copy")}
              onClick={async (_) => {
                await navigator.clipboard.writeText(odataFeedUrl);
                toaster.positive(ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:CopiedToClipboard"));
              }}
            >
              <SvgCopy />
            </IconButton>
          }
          iconDisplayStyle="inline"
        />
        <div className="rcw-toolbar">
          <Button startIcon={<SvgAdd />} onClick={() => addMapping()} styleType="high-visibility">
            {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:AddMapping")}
          </Button>
          <div className="rcw-search-bar-container" data-testid="rcw-search-bar">
            <IconButton
              title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Refresh")}
              onClick={refresh}
              disabled={isLoading}
              styleType="borderless"
            >
              <SvgRefresh />
            </IconButton>
            <SearchBar searchValue={searchValue} setSearchValue={setSearchValue} disabled={isLoading} />
          </div>
        </div>
        {isLoading ? (
          <LoadingOverlay />
        ) : reportMappings.length === 0 ? (
          <EmptyMessage>
            <>
              <Text>{ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:NoReportMappings")}</Text>
              <div>
                <Button onClick={addMapping} styleType="cta">
                  {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:LetsAddSomeMappingsCTA")}
                </Button>
              </div>
            </>
          </EmptyMessage>
        ) : (
          <div className="rcw-mapping-list">
            {filteredReportMappings.map((mapping) => (
              <ReportMappingHorizontalTile
                key={mapping.mappingId}
                bulkExtractor={bulkExtractor}
                mapping={mapping}
                onClickDelete={() => {
                  setShowDeleteModal(mapping);
                }}
                odataFeedUrl={odataFeedUrl}
                jobStartEvent={jobStartEvent}
              />
            ))}
          </div>
        )}
      </div>
      <AddMappingsModal
        show={showAddMapping}
        reportId={report.id}
        existingMappings={reportMappings}
        onClose={onAddMappingsModalClose}
        defaultIModelId={defaultIModelId}
      />
      <DeleteModal
        entityName={showDeleteModal?.mappingName ?? ""}
        onDelete={async () => {
          const accessToken = await getAccessToken();
          await reportsClient.deleteReportMapping(accessToken, report.id, showDeleteModal?.mappingId ?? "");
        }}
        refresh={refresh}
        onClose={() => setShowDeleteModal(undefined)}
      />
      <div className="rcw-action-panel">
        {isLoading && <LoadingSpinner />}
        <Button
          disabled={isLoading || jobRunning || reportMappings.length === 0}
          styleType="high-visibility"
          onClick={async () => {
            setJobRunning(true);
            const uniqueIModels = Array.from(new Set(reportMappings.map((x) => x.imodelId)));
            await bulkExtractor.runIModelExtractions(uniqueIModels);
            reportMappings.forEach((reportMapping) => {
              jobStartEvent.raiseEvent(reportMapping.imodelId);
            });
          }}
        >
          {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:UpdateAllDatasets")}
        </Button>
        <Button styleType="default" type="button" onClick={onClickClose} disabled={isLoading}>
          {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Close")}
        </Button>
      </div>
    </>
  );
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  SvgAdd,
  SvgCopy,
} from "@itwin/itwinui-icons-react";
import {
  Button,
  IconButton,
  LabeledInput,
  Surface,
  Text,
  toaster,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "./utils";
import {
  EmptyMessage,
  generateUrl,
  handleError,
  LoadingOverlay,
  WidgetHeader,
} from "./utils";
import "./ReportMappings.scss";
import DeleteModal from "./DeleteModal";
import type { Report, ReportMapping } from "@itwin/insights-client";
import { MappingsClient, REPORTING_BASE_PATH, ReportsClient } from "@itwin/insights-client";
import AddMappingsModal from "./AddMappingsModal";
import type {
  GetSingleIModelParams,
  IModelsClientOptions,
} from "@itwin/imodels-client-management";
import { Constants, IModelsClient } from "@itwin/imodels-client-management";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";
import { SearchBar } from "./SearchBar";
import type { ReportsApiConfig } from "../context/ReportsApiConfigContext";
import { useReportsApiConfig } from "../context/ReportsApiConfigContext";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import { ReportMappingHorizontalTile } from "./ReportMappingHorizontalTile";
import type BulkExtractor from "./BulkExtractor";
import { BeEvent } from "@itwin/core-bentley";
import { LoadingSpinner } from "./utils";

export type ReportMappingType = CreateTypeFromInterface<ReportMapping>;

export type ReportMappingAndMapping = ReportMappingType & {
  mappingName: string;
  mappingDescription: string;
  iModelName: string;
};

enum ReportMappingsView {
  REPORTMAPPINGS = "reportmappings",
  ADDING = "adding",
}

const fetchReportMappings = async (
  setReportMappings: (mappings: ReportMappingAndMapping[]) => void,
  reportId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  apiContext: ReportsApiConfig
) => {
  try {
    setIsLoading(true);
    const reportsClientApi = new ReportsClient(
      generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl)
    );
    const mappingsClientApi = new MappingsClient(
      generateUrl(REPORTING_BASE_PATH, apiContext.baseUrl)
    );
    const accessToken = await apiContext.getAccessToken();
    const reportMappings = await reportsClientApi.getReportMappings(
      accessToken,
      reportId
    );
    const iModelClientOptions: IModelsClientOptions = {
      api: { baseUrl: generateUrl(Constants.api.baseUrl, apiContext.baseUrl) },
    };

    const iModelsClient: IModelsClient = new IModelsClient(iModelClientOptions);
    const authorization =
      AccessTokenAdapter.toAuthorizationCallback(accessToken);
    const iModelNames = new Map<string, string>();
    const reportMappingsAndMapping = await Promise.all(
      reportMappings.map(async (reportMapping) => {
        const iModelId = reportMapping.imodelId;
        let iModelName = "";
        const mapping = await mappingsClientApi.getMapping(
          accessToken,
          iModelId,
          reportMapping.mappingId
        );
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
        return reportMappingAndMapping;
      }) ?? []
    );

    setReportMappings(reportMappingsAndMapping);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

interface ReportMappingsProps {
  report: Report;
  bulkExtractor: BulkExtractor;
  goBack: () => Promise<void>;
}

export const ReportMappings = ({ report, bulkExtractor, goBack }: ReportMappingsProps) => {
  const apiConfig = useReportsApiConfig();
  const [reportMappingsView, setReportMappingsView] =
    useState<ReportMappingsView>(ReportMappingsView.REPORTMAPPINGS);
  const [selectedReportMapping, setSelectedReportMapping] = useState<ReportMappingAndMapping | undefined>(undefined);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchValue, setSearchValue] = useState<string>("");
  const [reportMappings, setReportMappings] = useState<ReportMappingAndMapping[]>([]);

  const jobStartEvent = useMemo(
    () => new BeEvent<(mappingId: string) => void>(),
    []
  );

  useEffect(() => {
    void fetchReportMappings(
      setReportMappings,
      report.id,
      setIsLoading,
      apiConfig
    );
  }, [apiConfig, report.id, setIsLoading]);

  const refresh = useCallback(async () => {
    setReportMappingsView(ReportMappingsView.REPORTMAPPINGS);
    await fetchReportMappings(
      setReportMappings,
      report.id,
      setIsLoading,
      apiConfig
    );
  }, [apiConfig, report.id, setReportMappings]);

  const addMapping = () => {
    setReportMappingsView(ReportMappingsView.ADDING);
  };

  const odataFeedUrl = `${generateUrl(
    REPORTING_BASE_PATH,
    apiConfig.baseUrl
  )}/odata/${report.id}`;

  const filteredReportMappings = useMemo(
    () =>
      reportMappings.filter((x) =>
        [x.iModelName, x.mappingName, x.mappingDescription]
          .join(" ")
          .toLowerCase()
          .includes(searchValue.toLowerCase())
      ),
    [reportMappings, searchValue]
  );

  return (
    <>
      <WidgetHeader title={report.displayName} returnFn={goBack} />
      <div className="report-mapping-misc">
        <LabeledInput
          label={ReportsConfigWidget.localization.getLocalizedString(
            "ReportsConfigWidget:ODataFeedURL"
          )}
          className="odata-url-input"
          readOnly={true}
          value={odataFeedUrl}
          svgIcon={
            <IconButton
              title={ReportsConfigWidget.localization.getLocalizedString(
                "ReportsConfigWidget:Copy"
              )}
              styleType="borderless"
              onClick={async (_) => {
                await navigator.clipboard.writeText(odataFeedUrl);
                toaster.positive(
                  ReportsConfigWidget.localization.getLocalizedString(
                    "ReportsConfigWidget:CopiedToClipboard"
                  )
                );
              }}
            >
              <SvgCopy />
            </IconButton>
          }
          iconDisplayStyle="inline"
        />
      </div>
      <Surface className="report-mappings-container">
        <div className="toolbar">
          <Button
            startIcon={<SvgAdd />}
            onClick={() => addMapping()}
            styleType="high-visibility"
          >
            {ReportsConfigWidget.localization.getLocalizedString(
              "ReportsConfigWidget:AddMapping"
            )}
          </Button>
          <div className="search-bar-container" data-testid="search-bar">
            <SearchBar
              searchValue={searchValue}
              setSearchValue={setSearchValue}
              disabled={isLoading}
            />
          </div>
        </div>
        {isLoading ? (
          <LoadingOverlay />
        ) : reportMappings.length === 0 ? (
          <EmptyMessage>
            <>
              <Text>
                {ReportsConfigWidget.localization.getLocalizedString(
                  "ReportsConfigWidget:NoReportMappings"
                )}
              </Text>
              <div>
                <Button onClick={() => addMapping()} styleType="cta">
                  {ReportsConfigWidget.localization.getLocalizedString(
                    "ReportsConfigWidget:LetsAddSomeMappingsCTA"
                  )}
                </Button>
              </div>
            </>
          </EmptyMessage>
        ) : (
          <div className="mapping-list">
            {filteredReportMappings.map((mapping) => (
              <ReportMappingHorizontalTile
                key={mapping.mappingId}
                bulkExtractor={bulkExtractor}
                mapping={mapping}
                onClickDelete={() => {
                  setSelectedReportMapping(mapping);
                  setShowDeleteModal(true);
                }}
                odataFeedUrl={odataFeedUrl}
                jobStartEvent={jobStartEvent}
                initialState={bulkExtractor.getIModelState(mapping.imodelId, mapping.iModelName, odataFeedUrl)}
              />
            ))}
          </div>
        )}
      </Surface>
      <AddMappingsModal
        show={reportMappingsView === ReportMappingsView.ADDING}
        reportId={report.id}
        existingMappings={reportMappings}
        returnFn={refresh}
      />
      <DeleteModal
        entityName={selectedReportMapping?.mappingName ?? ""}
        show={showDeleteModal}
        setShow={setShowDeleteModal}
        onDelete={async () => {
          const reportsClientApi = new ReportsClient(
            generateUrl(REPORTING_BASE_PATH, apiConfig.baseUrl)
          );
          const accessToken = await apiConfig.getAccessToken();
          await reportsClientApi.deleteReportMapping(
            accessToken,
            report.id,
            selectedReportMapping?.mappingId ?? ""
          );
        }}
        refresh={refresh}
      />
      <div id="action">
        <div className="rcw-action-panel">
          {isLoading && <LoadingSpinner />}
          <Button
            disabled={isLoading}
            styleType="high-visibility"
            id="save-app"
            onClick={() => {
              bulkExtractor.runIModelExtractions(reportMappings).catch((e) => {
                /* eslint-disable no-console */
                console.error(e);
              });
              reportMappings.forEach((reportMapping) => {
                jobStartEvent.raiseEvent(reportMapping.imodelId);
              });
            }}
          >
            {ReportsConfigWidget.localization.getLocalizedString(
              "ReportsConfigWidget:UpdateAllDatasets"
            )}
          </Button>
          <Button
            styleType="default"
            type="button"
            id="cancel"
            onClick={goBack}
            disabled={isLoading}
          >
            {ReportsConfigWidget.localization.getLocalizedString(
              "ReportsConfigWidget:Close"
            )}
          </Button>
        </div>
      </div>
    </>
  );
};

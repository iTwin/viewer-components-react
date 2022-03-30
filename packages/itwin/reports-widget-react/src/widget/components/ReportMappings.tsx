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
import type { CreateTypeFromInterface } from "./utils";
import { handleError, WidgetHeader } from "./utils";
import "./ReportMappings.scss";
import DeleteModal from "./DeleteModal";
import type { Report, ReportMapping } from "../../reporting";
import { Mapping } from "../../reporting/generated/api";
import { ReportingClient } from "../../reporting/reportingClient";
import { IModelApp } from "@itwin/core-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import AddMappings from "./AddMappings";
import { LocalizedTablePaginator } from "./LocalizedTablePaginator";
import { IModelReportMappings } from "./IModelReportMappings";
import { GetSingleIModelParams, IModelsClient } from "@itwin/imodels-client-management";
import { AccessTokenAdapter } from "@itwin/imodels-access-frontend";

export type ReportMappingType = CreateTypeFromInterface<ReportMapping>;

export type ReportMappingAndMapping = ReportMappingType & { mappingName: string, mappingDescription: string, iModelName: string };

const groupBy = <T, K extends keyof T>(value: T[], key: K) =>
  value.reduce((acc, curr) => {
    if (acc.get(curr[key])) return acc;
    acc.set(curr[key], value.filter(elem => elem[key] === curr[key]));
    return acc;
  }, new Map<T[K], T[]>());

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
      const iModelId = reportMapping.imodelId ?? ""
      let iModelName = "";
      const mapping = await reportingClientApi.getMapping(accessToken, reportMapping.mappingId ?? "", iModelId);

      if (iModelNames.has(iModelId)) {
        iModelName = iModelNames.get(iModelId) ?? ""
      }
      else {
        const getSingleParams: GetSingleIModelParams = { authorization: authorization, iModelId: iModelId }
        const iModel = await iModelsClient.iModels.getSingle(getSingleParams)
        iModelName = iModel.displayName;
        iModelNames.set(iModelId, iModelName);
      }
      const reportMappingAndMapping: ReportMappingAndMapping = {
        ...reportMapping,
        iModelName: iModelName,
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


  const iModels = useMemo(() => groupBy(reportMappings, "imodelId"), [reportMappings])

  const refresh = useCallback(async () => {
    setReportMappingsView(ReportMappingsView.REPORTMAPPINGS);
    setReportMappings([]);
    await fetchReportMappings(setReportMappings, report.id ?? "", setIsLoading);
  }, [report.id, setReportMappings]);

  const addMapping = async () => {
    setReportMappingsView(ReportMappingsView.ADDING);
  };

  const odataFeedUrl = `https://${process.env.IMJS_URL_PREFIX}api.bentley.com/insights/reporting/odata/${report.id}`;

  switch (reportMappingsView) {
    case ReportMappingsView.ADDING:
      return <AddMappings reportId={report.id ?? ""} existingMappings={reportMappings} returnFn={refresh} />;
    default:
      return (
        <>
          <WidgetHeader title={report.displayName ?? ""} returnFn={goBack} />
          <div className="report-mappings-container">
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
            <div className="table-toolbar">
              <Button
                startIcon={<SvgAdd />}
                onClick={async () => addMapping()}
                styleType="high-visibility"
              >
                {IModelApp.localization.getLocalizedString("ReportsWidget:AddMapping")}
              </Button>
            </div>
            <div className="imodels-list">
              {isLoading ?
                <div className='rw-loading-overlay'>
                  <Text>Loading Mappings</Text>
                  <ProgressRadial indeterminate />
                  <Text>Please wait...</Text>
                </div> : Array.from(iModels.keys()).map((iModelId) =>
                  iModelId &&
                  <IModelReportMappings
                    key={iModelId}
                    iModelId={iModelId}
                    setSelectedReportMapping={setSelectedReportMapping}
                    setShowDeleteModal={setShowDeleteModal}
                    reportMappings={iModels.get(iModelId) ?? []}
                    isLoading={isLoading}
                  />)}
            </div>
          </div>
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
  }
};

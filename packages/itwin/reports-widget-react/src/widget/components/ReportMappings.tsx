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
import type {
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

export type ReportMappingType = CreateTypeFromInterface<ReportMapping>;

export type ReportMappingAndMapping = ReportMappingType & { mappingName: string, mappingDescription: string };

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
    const reportMappingsAndMapping = await Promise.all(reportMappings.mappings?.map(async (reportMapping) => {
      const mapping = await reportingClientApi.getMapping(accessToken, reportMapping.mappingId ?? "", reportMapping.imodelId ?? "");
      const reportMappingAndMapping: ReportMappingAndMapping = {
        ...reportMapping,
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
  const iModelId = useActiveIModelConnection()?.iModelId as string;
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showOpenediModel, setShowOpenediModel] = useState(true);
  const [reportMappingsView, setReportMappingsView] = useState<ReportMappingsView>(
    ReportMappingsView.REPORTMAPPINGS
  );
  const [selectedReportMapping, setSelectedReportMapping] = useState<
    ReportMapping | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reportMappings, setReportMappings] = useFetchReportMappings(report.id ?? "", setIsLoading);

  const refresh = useCallback(async () => {
    setReportMappingsView(ReportMappingsView.REPORTMAPPINGS);
    setSelectedReportMapping(undefined);
    setReportMappings([]);
    await fetchReportMappings(setReportMappings, report.id ?? "", setIsLoading);
  }, [report.id, setReportMappings]);

  const addMapping = async () => {
    setReportMappingsView(ReportMappingsView.ADDING);
  };

  const filteredReportMappings = useMemo(() => reportMappings.filter((reportMapping) => reportMapping.imodelId === iModelId), [reportMappings, iModelId]);

  const reportMappingsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "mappingName",
            Header: IModelApp.localization.getLocalizedString("ReportsWidget:MappingName"),
            accessor: "mappingName",
            Filter: tableFilters.TextFilter(),
          }, {
            id: "mappingDescription",
            Header: IModelApp.localization.getLocalizedString("ReportsWidget:Description"),
            accessor: "mappingDescription",
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "remove",
            Header: "",
            width: 80,
            Cell: (value: CellProps<ReportMapping>) => {
              return (
                <IconButton onClick={() => {
                  setSelectedReportMapping(value.row.original);
                  setShowDeleteModal(true);
                }} styleType="borderless"
                  title="Remove">
                  <SvgDelete
                    style={{
                      width: "16px",
                      height: "16px",
                    }}
                  />
                </IconButton>
              );
            },
          },
        ],
      },
    ],
    []
  );

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
              <div className="filter-toggle">
                <Checkbox checked={showOpenediModel} onChange={() => setShowOpenediModel((showOpenediModel) => !showOpenediModel)} />
                <Text>{IModelApp.localization.getLocalizedString("ReportsWidget:FilterToCurrentIModel")}</Text>
              </div>
            </div>
            <Table<ReportMappingAndMapping>
              data={showOpenediModel ? filteredReportMappings : reportMappings}
              className='report-mappings-table'
              density="extra-condensed"
              columns={reportMappingsColumns}
              emptyTableContent={IModelApp.localization.getLocalizedString("ReportsWidget:NoReportMappingsAvailable")}
              isSortable
              isLoading={isLoading}
              paginatorRenderer={LocalizedTablePaginator}
            />
          </div>
          <DeleteModal
            entityName={selectedReportMapping?.mappingId ?? ""}
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

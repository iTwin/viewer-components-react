/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { SvgAdd, SvgDelete, SvgMore } from "@itwin/itwinui-icons-react";
import { Button, Checkbox, DropdownMenu, ExpandableBlock, IconButton, MenuItem, Table, tableFilters } from "@itwin/itwinui-react";
import React, { useMemo, useState } from "react";
import type { CellProps } from "react-table";
import { ReportMapping } from "../../reporting/generated/api";
import { ReportingClient } from "../../reporting/reportingClient";
import DeleteModal from "./DeleteModal";
import { Extraction } from "./Extraction";
import { LocalizedTablePaginator } from "./LocalizedTablePaginator";
import type { ReportMappingAndMapping } from "./ReportMappings";
import "./IModelReportMappings.scss";
import { useActiveIModelConnection } from "@itwin/appui-react";

interface IModelReportMappingsProps {
  iModelId: string;
  reportMappings: ReportMappingAndMapping[];
  isLoading: boolean;
  setSelectedReportMapping: React.Dispatch<React.SetStateAction<ReportMappingAndMapping | undefined>>;
  setShowDeleteModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export const IModelReportMappings = ({ iModelId, reportMappings, isLoading, setSelectedReportMapping, setShowDeleteModal }: IModelReportMappingsProps) => {
  const openedIModelId = useActiveIModelConnection()?.iModelId;

  const reportMappingsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "mappingName",
            Header: IModelApp.localization.getLocalizedString("ReportsConfigWidget:MappingName"),
            accessor: "mappingName",
            Filter: tableFilters.TextFilter(),
          }, {
            id: "mappingDescription",
            Header: IModelApp.localization.getLocalizedString("ReportsConfigWidget:Description"),
            accessor: "mappingDescription",
            Filter: tableFilters.TextFilter(),
          },
          {
            id: "remove",
            Header: "",
            width: 80,
            Cell: (value: CellProps<ReportMappingAndMapping>) => {
              return (
                <DropdownMenu
                  menuItems={(close: () => void) => [
                    <MenuItem
                      key={1}
                      onClick={() => {
                        setSelectedReportMapping(value.row.original);
                        setShowDeleteModal(true);
                        close();
                      }}
                      icon={<SvgDelete />}
                    >
                      {IModelApp.localization.getLocalizedString("ReportsConfigWidget:Remove")}
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
              );
            },
          },
        ],
      },
    ],
    [setSelectedReportMapping, setShowDeleteModal]
  );

  return (
    <>
      <ExpandableBlock title={openedIModelId === iModelId ? `(Viewing) ${reportMappings[0].iModelName}` : reportMappings[0].iModelName}>
        <div className="imodel-report-mappings-container">
          <Table<ReportMappingAndMapping>
            data={reportMappings}
            className='mappings-table'
            density="extra-condensed"
            columns={reportMappingsColumns}
            emptyTableContent={IModelApp.localization.getLocalizedString("ReportsConfigWidget:NoReportMappingsAvailable")}
            isSortable
            isLoading={isLoading}
            paginatorRenderer={LocalizedTablePaginator}
          />
        </div>
      </ExpandableBlock>

    </>
  );
};

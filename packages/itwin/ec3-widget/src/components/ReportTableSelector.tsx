/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ComboBox, Label, toaster } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import type { Configuration } from "./Template";
import "./ReportTableSelector.scss";
import { useODataClient } from "./api/context/ODataClientContext";
import { useApiConfig } from "./api/context/ApiConfigContext";

export interface ReportTableSelectorProps {
  selectedReportTable: string;
  template: Configuration;
  placeHolder: string;
  onChange: (table: string, numCols: string[], strCols: string[]) => Promise<void>;
  setLoading: (val: boolean) => void;
}

export const ReportTableSelector = ({
  selectedReportTable,
  template,
  placeHolder,
  onChange,
  setLoading,
}: ReportTableSelectorProps) => {
  const { getAccessToken } = useApiConfig();
  const [validator, _showValidationMessage] = useValidator();
  const [reportTable, setReportTable] = useState(selectedReportTable);
  const [reportTables, setReportTables] = useState<string[] | undefined>(undefined);
  const reportingClientApi = useODataClient();

  const updateData = useCallback(async (reportTableName: string) => {
    if (!template.reportId)
      throw new Error(
        "Invalid report."
      );

    setReportTable(reportTableName);
    let reportMetadataResponse;
    try {
      const token = await getAccessToken();
      reportMetadataResponse = await reportingClientApi.getODataReportMetadata(token, template.reportId);
    } catch (err) {
      toaster.negative("You are not authorized to use this system.");
      /* eslint-disable no-console */
      console.error(err);
      return;
    }

    const oDataReportTables = reportMetadataResponse.map((d) => d.name ?? "");
    const filteredReportTables: string[] = reportTable ? [reportTable] : [];
    filteredReportTables.push(...oDataReportTables.filter((table) =>
      !template.labels.some((label) => label.reportTable === table)
    ));

    if (reportTables === undefined)
      setReportTables(filteredReportTables);

    if (!reportTableName)
      return;

    const oDataTable = reportMetadataResponse.find((x) => x.name === reportTableName);
    if (!oDataTable)
      return;

    const filteredStringColumns = oDataTable.columns.filter((x) => x.type === "Edm.String").map((x) => x.name);
    const filteredNumericalColumns = oDataTable.columns.filter((x) => x.type === "Edm.Double").map((x) => x.name);

    await onChange(reportTableName, filteredNumericalColumns, filteredStringColumns);
  }, [reportTable, reportTables, template, onChange, reportingClientApi, getAccessToken]);

  const reportTableLabels = useMemo(() => {
    return reportTables?.map((g) => ({
      label: g,
      value: g,
    })) ?? [];
  }, [reportTables]);

  const onChangeCallback = useCallback(async (table: string) => {
    setLoading(true);
    await updateData(table);
    setLoading(false);
  }, [updateData, setLoading]);

  useEffect(() => {
    void onChangeCallback(reportTable);
  }, [reportTable, onChangeCallback]);

  return (
    <div className="ec3w-dropdown-select-container">
      <div className="ec3w-dropdown-select-combo-box">
        <Label htmlFor="combo-input" required>
          Report table
        </Label>
        <ComboBox
          options={reportTableLabels}
          value={reportTable}
          onChange={onChangeCallback}
          message={validator.message("reportTable", reportTable, NAME_REQUIREMENTS)}
          status={validator.message("reportTable", reportTable, NAME_REQUIREMENTS) ? "negative" : undefined}
          inputProps={{
            id: "combo-input",
            placeholder: placeHolder,
          }}
        />
      </div>
    </div>
  );
};

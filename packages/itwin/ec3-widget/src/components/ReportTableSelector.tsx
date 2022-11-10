/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import { ReportingClient } from "@itwin/insights-client";
import { ComboBox, Label, toaster } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import type { Configuration } from "./Template";
import "./ReportTableSelector.scss";

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
  const [validator, _showValidationMessage] = useValidator();
  const [reportTable, setReportTable] = useState(selectedReportTable);
  const [reportTables, setReportTables] = useState<string[] | undefined>(undefined);
  const reportingClientApi = useMemo(() => new ReportingClient(), []);

  const updateData = useCallback(async (reportTableName: string) => {
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    if (!template.reportId)
      throw new Error(
        "Invalid report."
      );

    setReportTable(reportTableName);
    let reportODataResponse;
    let reportMetadataResponse;
    try {
      const token = await IModelApp.authorizationClient.getAccessToken();
      reportODataResponse = await reportingClientApi.getODataReport(token, template.reportId);
      reportMetadataResponse = await reportingClientApi.getODataReportMetadata(token, template.reportId);
    } catch (err) {
      toaster.negative("You are not authorized to use this system.");
      /* eslint-disable no-console */
      console.error(err);
      return;
    }

    const oDataReportTables = reportODataResponse.value.map((d) => d.name ?? "");
    const filteredReportTables: string[] = reportTable ? [reportTable] : [];
    filteredReportTables.push(...oDataReportTables.filter((table) =>
      !template.labels.some((label) => label.reportTable === table)
    ));
    if (reportTables === undefined)
      setReportTables(filteredReportTables);

    if (!reportTableName)
      return;

    const responseText = await reportMetadataResponse.text();
    const dom = new DOMParser().parseFromString(responseText, "text/xml");
    const elems = Array.from(dom.getElementsByTagName("EntityType")).filter((x) => x.attributes[0].value === reportTableName);
    if (elems.length === 0)
      return;

    const columns = Array.from(elems[0].children).map((x) => x.attributes);
    const filteredStringColumns = columns.filter((x) => x[1].value === "Edm.String").map((x) => x[0].value);
    const filteredNumericalColumns = columns.filter((x) => x[1].value === "Edm.Double").map((x) => x[0].value);

    await onChange(reportTableName, filteredNumericalColumns, filteredStringColumns);
  }, [reportTable, reportTables, template, onChange, reportingClientApi]);

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
    <>
      <div className="dropdown-select-container">
        <div className="dropdown-select-combo-box">
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
    </>
  );
};

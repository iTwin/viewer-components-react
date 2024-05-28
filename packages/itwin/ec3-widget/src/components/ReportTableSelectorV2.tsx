/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { LabeledSelect, toaster } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Configuration } from "./EC3/Template";
import "./ReportTableSelector.scss";
import SimpleReactValidator from "simple-react-validator";
import { useApiContext } from "./api/APIContext";
import type { Group } from "@itwin/insights-client";

export interface GroupSelectorProps {
  selectedGroupDetails: string;
  template: Configuration;
  placeHolder: string;
  onChange: (table: string, numCols: string[], strCols: string[]) => Promise<void>;
  setIsLoading: (val: boolean) => void;
  isLoading: boolean;
}

export const GroupSelector = (props: GroupSelectorProps) => {
  const {
    config: { getAccessToken, iModelId },
  } = useApiContext();
  const [reportTable, setReportTable] = useState<string>("");
  const [reportTables, setReportTables] = useState<string[] | undefined>(undefined);
  const [groups, setGroups] = useState<Group[]>([]);
  const oDataClient = useApiContext().oDataClient;
  const validator = new SimpleReactValidator();
  const nameRequirements = "required";
  const mappingsClient = useApiContext().mappingsClient;

  useMemo(() => {
    setReportTable(props.selectedGroupDetails);
  }, [props.selectedGroupDetails]);

  const getGroups = useCallback(async () => {
    const accessToken = await getAccessToken();
    const mappingsForiModel = await mappingsClient.getMappings(accessToken, iModelId);
    const carbonCalculationMapping = mappingsForiModel.find((mapping) => (mapping.mappingName = "WallsMapping"));
    if (carbonCalculationMapping) {
      const carbonCalculationGroups = await mappingsClient.getGroups(accessToken, iModelId, carbonCalculationMapping.id);
      if (carbonCalculationGroups.length > 0) {
        setGroups(carbonCalculationGroups);
      }
    }
  }, [getAccessToken, iModelId, mappingsClient]);

  useEffect(() => {
    void getGroups();
    // eslint-disable-next-line
  }, []);

  const updateData = useCallback(
    async (reportTableName: string) => {
      if (!props.template.reportId) throw new Error("Invalid report.");

      setReportTable(reportTableName);
      let reportMetadataResponse;
      try {
        const token = await getAccessToken();
        reportMetadataResponse = await oDataClient.getODataReportMetadata(token, props.template.reportId);
      } catch (err) {
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
        return;
      }

      const oDataReportTables = reportMetadataResponse.map((d) => d.name ?? "");
      const filteredReportTables: string[] = reportTable ? [reportTable] : [];
      filteredReportTables.push(...oDataReportTables.filter((table) => !props.template.labels.some((label) => label.reportTable === table)));

      if (reportTables === undefined) setReportTables(filteredReportTables);

      if (!reportTableName) return;

      const oDataTable = reportMetadataResponse.find((x) => x.name === reportTableName);
      if (!oDataTable) return;

      const filteredStringColumns = oDataTable.columns.filter((x) => x.type === "Edm.String").map((x) => x.name);
      const filteredNumericalColumns = oDataTable.columns.filter((x) => x.type === "Edm.Double").map((x) => x.name);

      await props.onChange(reportTableName, filteredNumericalColumns, filteredStringColumns);
    },
    // eslint-disable-next-line
    [reportTable, reportTables, props.template, oDataClient],
  );

  const reportTableLabels = useMemo(() => {
    return (
      reportTables?.map((g) => ({
        label: groups.find((group) => g.includes(group.groupName))?.groupName ?? g,
        value: g,
      })) ?? []
    );
  }, [groups, reportTables]);

  const onChangeCallback = useCallback(
    async (table: string) => {
      props.setIsLoading(true);
      await updateData(table);
      props.setIsLoading(false);
    },
    // eslint-disable-next-line
    [updateData],
  );

  useEffect(() => {
    void onChangeCallback(reportTable);
  }, [reportTable, onChangeCallback]);

  return (
    <div className="ec3w-dropdown-select-container">
      <div className="ec3w-dropdown-select-combo-box">
        <LabeledSelect
          label="Select Group"
          data-testid="ec3-report-table-select"
          options={reportTableLabels}
          value={reportTable}
          onChange={onChangeCallback}
          message={validator.message("reportTable", reportTable, nameRequirements)}
          status={validator.message("reportTable", reportTable, nameRequirements) ? "negative" : undefined}
          placeholder={props.placeHolder}
          disabled={props.isLoading}
        />
      </div>
    </div>
  );
};

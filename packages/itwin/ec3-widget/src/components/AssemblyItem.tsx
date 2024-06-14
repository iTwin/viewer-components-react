import { Label, LabeledInput, LabeledSelect, Select } from "@itwin/itwinui-react";
import React from "react";
import { AssemblyCreationDropdownType } from "./TemplateModificationStepTwo";
import type { EC3ConfigurationLabel, Report } from "@itwin/insights-client";
import type { Configuration } from "../ec3-widget-react";
import { useApiContext } from "./context/APIContext";
import "./AssemblyItem.scss";

export interface AssemblyItemProps {
  assembly: EC3ConfigurationLabel;
  fetchedReports?: Report[];
  currentAssemblyIndex: number;
  template: Configuration;
  onAssemblyDataChange: (updatedAssembly: EC3ConfigurationLabel, index: number, action?: "add" | "delete") => void;
  setTemplate: (template: Configuration) => void;
  getMetadataColumns: (assembly: EC3ConfigurationLabel, optionType: AssemblyCreationDropdownType) => string[] | undefined;
  isLoading: boolean;
  editableAssemblyIndex?: number;
  getReportTableOptions: (assembly: EC3ConfigurationLabel) => {
    label: string;
    value: string;
  }[];
}
export const AssemblyItem = (props: AssemblyItemProps) => {
  const {
    config: { defaultReport },
  } = useApiContext();
  return (
    <>
      <LabeledInput
        className="ec3w-input-form"
        id="name"
        name="name"
        label="Assembly Name"
        value={props.assembly.name}
        onChange={(event) => {
          props.onAssemblyDataChange({ ...props.assembly, name: event.target.value }, props.currentAssemblyIndex);
        }}
        disabled={props.currentAssemblyIndex !== props.editableAssemblyIndex}
      />
      {!defaultReport && props.fetchedReports && props.fetchedReports.length > 0 && (
        <LabeledSelect
          label="Select Report"
          className="ec3w-input-form"
          data-testid="ec3-report-select"
          options={props.fetchedReports.map((x) => {
            return {
              label: x.displayName,
              value: x.id,
            };
          })}
          value={props.fetchedReports.find((rp) => rp.id === props.template.reportId)?.id}
          onChange={async (selectedReport) => {
            props.setTemplate({ ...props.template, reportId: selectedReport });
            props.onAssemblyDataChange(
              {
                elementNameColumn: "UserLabel",
                elementQuantityColumn: "",
                materials: [],
                name: props.assembly.name,
                reportTable: "",
              },
              props.currentAssemblyIndex,
            );
          }}
          disabled={props.currentAssemblyIndex !== props.editableAssemblyIndex}
          placeholder={props.isLoading ? "Loading reports..." : "Select report"}
        />
      )}
      <LabeledSelect
        label="Select ReportTable"
        className="ec3w-input-form"
        data-testid="ec3-report-table-select"
        options={props.getReportTableOptions(props.assembly)}
        value={props.assembly.reportTable}
        onChange={async (selectedReportTable) => {
          // reset all related fields
          props.onAssemblyDataChange(
            {
              elementNameColumn: "UserLabel",
              elementQuantityColumn: "",
              materials: [],
              name: props.assembly.name,
              reportTable: selectedReportTable,
            },
            props.currentAssemblyIndex,
          );
        }}
        disabled={props.currentAssemblyIndex !== props.editableAssemblyIndex || !props.template.reportId || props.isLoading}
        placeholder={props.isLoading ? "Loading report tables..." : !props.template.reportId ? "Select report first" : "Select report table"}
      />
      <LabeledSelect
        data-testid="ec3-element-select"
        className="ec3w-input-form"
        required
        label={"Element"}
        options={
          props.getMetadataColumns(props.assembly, AssemblyCreationDropdownType.elementName)?.map((x) => {
            return { label: x, value: x };
          }) ?? []
        }
        value={props.assembly.elementNameColumn}
        onChange={async (value) => {
          props.onAssemblyDataChange({ ...props.assembly, elementNameColumn: value }, props.currentAssemblyIndex);
        }}
        disabled={props.isLoading || props.assembly.reportTable === "" || props.currentAssemblyIndex !== props.editableAssemblyIndex}
        placeholder={props.isLoading ? "Loading elements" : props.assembly.reportTable === "" ? "Select report table first" : "Select element"}
      />
      <LabeledSelect
        data-testid="ec3-element-quantity-select"
        className="ec3w-input-form"
        required
        label={"Element quantity"}
        options={
          props.getMetadataColumns(props.assembly, AssemblyCreationDropdownType.elementQuantity)?.map((x) => {
            return { label: x, value: x };
          }) ?? []
        }
        value={props.assembly.elementQuantityColumn}
        onChange={async (value) => {
          props.onAssemblyDataChange({ ...props.assembly, elementQuantityColumn: value }, props.currentAssemblyIndex);
        }}
        disabled={props.isLoading || props.assembly.reportTable === "" || props.currentAssemblyIndex !== props.editableAssemblyIndex}
        placeholder={props.isLoading ? "Loading elements" : props.assembly.reportTable === "" ? "Select report table first" : "Select element quantity"}
      />
      <Label htmlFor="combo-input" required>
        Materials
      </Label>
      <Select
        className="ec3w-input-form"
        disabled={props.isLoading || props.assembly.reportTable === "" || props.currentAssemblyIndex !== props.editableAssemblyIndex}
        options={
          props.getMetadataColumns(props.assembly, AssemblyCreationDropdownType.material)?.map((x) => {
            return { label: x, value: x };
          }) ?? []
        }
        value={props.assembly.materials.map((x) => x?.nameColumn)}
        onChange={(val, event) => {
          if (val) {
            props.onAssemblyDataChange(
              {
                ...props.assembly,
                materials:
                  event === "removed"
                    ? props.assembly.materials.filter((value) => val !== value?.nameColumn)
                    : [...(props.assembly.materials ?? []), { nameColumn: val }],
              },
              props.currentAssemblyIndex,
            );
          }
        }}
        placeholder={
          props.isLoading ? "Loading elements" : props.assembly.reportTable === "" ? "Select report table first" : "Select property containing material names"
        }
        multiple
      />
    </>
  );
};

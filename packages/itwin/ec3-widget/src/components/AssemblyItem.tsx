import { Label, LabeledInput, LabeledSelect, Select } from "@itwin/itwinui-react";
import React, { useCallback, useMemo } from "react";
import { AssemblyCreationDropdownType } from "./TemplateModificationStepTwo";
import type { EC3ConfigurationLabel, ODataTable } from "@itwin/insights-client";
import type { Configuration } from "../ec3-widget-react";
import { EC3Widget } from "../EC3Widget";
import "./AssemblyItem.scss";

export interface AssemblyItemProps {
  assembly: EC3ConfigurationLabel;
  currentAssemblyIndex: number;
  template: Configuration;
  isLoading: boolean;
  editableAssemblyIndex?: number;
  oDataTable?: ODataTable[];
  reportTables?: string[];
  allAssemblies: EC3ConfigurationLabel[];
  onAssemblyDataChange: (updatedAssembly: EC3ConfigurationLabel, index: number, action?: "add" | "delete") => void;
  setTemplate: (template: Configuration) => void;
}
export const AssemblyItem = (props: AssemblyItemProps) => {
  const getMetadataColumns = useMemo(
    () => (assembly: EC3ConfigurationLabel, optionType: AssemblyCreationDropdownType) => {
      const oDataTableData = props.oDataTable?.find((x) => x.name === assembly.reportTable);
      if (!oDataTableData) {
        return;
      }
      switch (optionType) {
        case AssemblyCreationDropdownType.elementName: {
          return oDataTableData.columns
            .filter((x) => x.type === "Edm.String" && !assembly.materials.map((p) => p.nameColumn).includes(x.name))
            .map((x) => x.name);
        }
        case AssemblyCreationDropdownType.elementQuantity: {
          return oDataTableData.columns.filter((x) => x.type === "Edm.Double").map((x) => x.name);
        }
        case AssemblyCreationDropdownType.material: {
          return oDataTableData.columns.filter((x) => x.type === "Edm.String" && assembly.elementNameColumn !== x.name).map((x) => x.name);
        }
      }
    },
    [props.oDataTable],
  );

  const reportTableLabels = useMemo(() => {
    return (
      props.reportTables?.map((g) => ({
        label: g,
        value: g,
      })) ?? []
    );
  }, [props.reportTables]);

  // skip reportTables that have already been used in other assemblies
  const getReportTableOptions = useCallback(
    (assembly: EC3ConfigurationLabel) => {
      const existingAssembly = reportTableLabels.find((x) => x.value === assembly.reportTable);
      if (existingAssembly) {
        const allAssem = reportTableLabels.filter((x) => !props.allAssemblies?.map((p) => p.reportTable).includes(x.value));
        allAssem.push(existingAssembly);
        return allAssem;
      }
      return reportTableLabels.filter((x) => !props.allAssemblies?.map((p) => p.reportTable).includes(x.value));
    },
    [reportTableLabels, props.allAssemblies],
  );

  const onAssemblyNameChange = useCallback(
    (event) => {
      props.onAssemblyDataChange({ ...props.assembly, name: event.target.value }, props.currentAssemblyIndex);
    },
    [props],
  );

  const onReportTableSelectChange = useCallback(
    async (selectedReportTable) => {
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
    },
    [props],
  );

  const onElementSelectChange = useCallback(
    (value) => {
      props.onAssemblyDataChange({ ...props.assembly, elementNameColumn: value }, props.currentAssemblyIndex);
    },
    [props],
  );

  const onElementQuantitySelectChange = useCallback(
    (value) => {
      props.onAssemblyDataChange({ ...props.assembly, elementQuantityColumn: value }, props.currentAssemblyIndex);
    },
    [props],
  );

  const onMaterialSelectChange = useCallback(
    (val, event) => {
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
    },
    [props],
  );

  return (
    <>
      <LabeledInput
        className="ec3w-input-form"
        id="name"
        name="name"
        data-testid="ec3-assembly-name-input"
        label={EC3Widget.translate("assemblyName")}
        value={props.assembly.name}
        onChange={onAssemblyNameChange}
        disabled={props.currentAssemblyIndex !== props.editableAssemblyIndex}
      />
      <LabeledSelect
        label={EC3Widget.translate("reportTable")}
        className="ec3w-input-form"
        data-testid="ec3-report-table-select"
        options={getReportTableOptions(props.assembly)}
        value={props.assembly.reportTable}
        onChange={onReportTableSelectChange}
        disabled={props.currentAssemblyIndex !== props.editableAssemblyIndex || !props.template.reportId || props.isLoading}
        placeholder={props.isLoading ? EC3Widget.translate("reportTablesPlaceholderLoading") : EC3Widget.translate("reportTablesPlaceholderSelect")}
      />
      <LabeledSelect
        data-testid="ec3-element-select"
        className="ec3w-input-form"
        required
        label={EC3Widget.translate("element")}
        options={
          getMetadataColumns(props.assembly, AssemblyCreationDropdownType.elementName)?.map((x) => {
            return { label: x, value: x };
          }) ?? []
        }
        value={props.assembly.elementNameColumn}
        onChange={onElementSelectChange}
        disabled={props.isLoading || props.assembly.reportTable === "" || props.currentAssemblyIndex !== props.editableAssemblyIndex}
        placeholder={
          props.isLoading
            ? EC3Widget.translate("elementPlaceholderLoading")
            : props.assembly.reportTable === ""
              ? EC3Widget.translate("selectReportTableFirstPlaceholder")
              : EC3Widget.translate("elementPlaceholderSelect")
        }
      />
      <LabeledSelect
        data-testid="ec3-element-quantity-select"
        className="ec3w-input-form"
        required
        label={EC3Widget.translate("elementQuantity")}
        options={
          getMetadataColumns(props.assembly, AssemblyCreationDropdownType.elementQuantity)?.map((x) => {
            return { label: x, value: x };
          }) ?? []
        }
        value={props.assembly.elementQuantityColumn}
        onChange={onElementQuantitySelectChange}
        disabled={props.isLoading || props.assembly.reportTable === "" || props.currentAssemblyIndex !== props.editableAssemblyIndex}
        placeholder={
          props.isLoading
            ? EC3Widget.translate("elementPlaceholderLoading")
            : props.assembly.reportTable === ""
              ? EC3Widget.translate("selectReportTableFirstPlaceholder")
              : EC3Widget.translate("elementQuantityPlaceholderSelect")
        }
      />
      <Label htmlFor="combo-input" required>
        {EC3Widget.translate("materials")}
      </Label>
      <Select
        data-testid="ec3-material-select"
        className="ec3w-input-form"
        disabled={props.isLoading || props.assembly.reportTable === "" || props.currentAssemblyIndex !== props.editableAssemblyIndex}
        options={
          getMetadataColumns(props.assembly, AssemblyCreationDropdownType.material)?.map((x) => {
            return { label: x, value: x };
          }) ?? []
        }
        value={props.assembly.materials.map((x) => x?.nameColumn)}
        onChange={onMaterialSelectChange}
        placeholder={
          props.isLoading
            ? EC3Widget.translate("elementPlaceholderLoading")
            : props.assembly.reportTable === ""
              ? EC3Widget.translate("selectReportTableFirstPlaceholder")
              : EC3Widget.translate("materialsSelectPlaceholder")
        }
        multiple
      />
    </>
  );
};

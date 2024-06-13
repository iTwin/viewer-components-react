/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, ButtonGroup, ExpandableBlock, IconButton, Label, LabeledInput, LabeledSelect, ProgressRadial, Select } from "@itwin/itwinui-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Configuration } from "./EC3/Template";
import React from "react";
import type { EC3ConfigurationLabel, ODataTable } from "@itwin/insights-client";
import "./CreateAssemblyComponent.scss";
import { SvgAdd, SvgDelete, SvgEdit } from "@itwin/itwinui-icons-react";
import { useApiContext } from "./context/APIContext";

export interface CreateAssemblyProps {
  template: Configuration;
  onNextClick: () => void;
  onCancelClick?: () => void;
  onBackClick: () => void;
  setTemplate: (template: Configuration) => void;
  label?: EC3ConfigurationLabel[];
}

export enum CreateAssemblyDropdownType {
  material,
  elementName,
  elementQuantity,
}

export const CreateAssembly = (props: CreateAssemblyProps) => {
  const [allAssemblies, setAllAssemblies] = useState<EC3ConfigurationLabel[] | undefined>(props.label);
  const [reportTables, setReportTables] = useState<string[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [oDataTable, setoDataTable] = useState<ODataTable[]>([]);
  const [editableAssemblyIndex, setEditableAssemblyIndex] = useState<number>();

  const oDataClient = useApiContext().oDataClient;
  const {
    config: { getAccessToken },
  } = useApiContext();

  useMemo(() => {
    setAllAssemblies(props.label);
  }, [props.label]);

  const onAssemblyDataChange = useCallback(
    (updatedAssembly: EC3ConfigurationLabel, index: number, action?: "add" | "delete") => {
      if (allAssemblies) {
        const newArray = [...allAssemblies];
        if (action === "add") {
          newArray.splice(0, 0, updatedAssembly);
        } else if (action === "delete") {
          newArray.splice(index, 1);
        } else {
          newArray.splice(index, 1, updatedAssembly);
        }
        setAllAssemblies(newArray);
      } else {
        setAllAssemblies([updatedAssembly]);
      }
    },
    [allAssemblies],
  );

  const getMetadataColumns = (assembly: EC3ConfigurationLabel, optionType: CreateAssemblyDropdownType) => {
    const oDataTableData = oDataTable.find((x) => x.name === assembly.reportTable);
    if (!oDataTableData) {
      return;
    }
    switch (optionType) {
      case CreateAssemblyDropdownType.elementName: {
        return oDataTableData.columns
          .filter((x) => x.type === "Edm.String" && !assembly.materials.map((p) => p.nameColumn).includes(x.name))
          .map((x) => x.name);
      }
      case CreateAssemblyDropdownType.elementQuantity: {
        return oDataTableData.columns.filter((x) => x.type === "Edm.Double").map((x) => x.name);
      }
      case CreateAssemblyDropdownType.material: {
        return oDataTableData.columns.filter((x) => x.type === "Edm.String" && assembly.elementNameColumn !== x.name).map((x) => x.name);
      }
    }
  };

  const initReportTableSelection = useCallback(async () => {
    if (!props.template.reportId) throw new Error("Invalid report.");
    const token = await getAccessToken();
    const reportMetadataResponse = await oDataClient.getODataReportMetadata(token, props.template.reportId);
    setoDataTable(reportMetadataResponse);
    setReportTables(reportMetadataResponse.map((d) => d.name ?? ""));
  }, [getAccessToken, oDataClient, props.template.reportId]);

  const addNewEmptyAssembly = () => {
    setEditableAssemblyIndex(0);
    onAssemblyDataChange(
      {
        name: "",
        elementNameColumn: "UserLabel",
        elementQuantityColumn: "",
        materials: [],
        reportTable: "",
      },
      0,
      "add",
    );
  };

  const init = useCallback(async () => {
    setIsLoading(true);
    await initReportTableSelection();
    if (props.label === undefined || props.label.length === 0) {
      addNewEmptyAssembly();
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initReportTableSelection, props.label]);

  useEffect(() => {
    void init();
    // eslint-disable-next-line
  }, []);

  const reportTableLabels = useMemo(() => {
    return (
      reportTables?.map((g) => ({
        label: g,
        value: g,
      })) ?? []
    );
  }, [reportTables]);

  // skip reportTables that have already been used in other assemblies
  const getReportTableOptions = (assembly: EC3ConfigurationLabel) => {
    const existingAssembly = reportTableLabels.find((x) => x.value === assembly.reportTable);
    if (existingAssembly) {
      const allAssem = reportTableLabels.filter((x) => !allAssemblies?.map((p) => p.reportTable).includes(x.value));
      allAssem.push(existingAssembly);
      return allAssem;
    }
    return reportTableLabels.filter((x) => !allAssemblies?.map((p) => p.reportTable).includes(x.value));
  };

  return (
    <div className="create-assembly-step">
      {isLoading ? (
        <ProgressRadial className="loading-indicator" indeterminate />
      ) : (
        <>
          <div className="assembly-list">
            {allAssemblies &&
              allAssemblies.length > 0 &&
              allAssemblies?.map((assembly, i) => {
                return (
                  <>
                    <ExpandableBlock
                      className="assembly-expandable-block"
                      title={`${assembly.name}`}
                      endIcon={
                        <ButtonGroup>
                          <IconButton
                            key={`edit-assembly${i}`}
                            styleType="borderless"
                            onClick={(e) => {
                              setEditableAssemblyIndex(i);
                              e.stopPropagation();
                            }}
                          >
                            <SvgEdit />
                          </IconButton>
                          <IconButton
                            key={`delete-assembly${i}`}
                            disabled={allAssemblies.length === 1}
                            styleType="borderless"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAssemblyDataChange(assembly, i, "delete");
                            }}
                          >
                            <SvgDelete />
                          </IconButton>
                        </ButtonGroup>
                      }
                      key={i}
                      isExpanded={editableAssemblyIndex ? i === editableAssemblyIndex : i === 0}
                    >
                      <>
                        <LabeledInput
                          id="name"
                          name="name"
                          label="Assembly Name"
                          value={assembly.name}
                          onChange={(event) => {
                            onAssemblyDataChange({ ...assembly, name: event.target.value }, i);
                          }}
                          disabled={i !== editableAssemblyIndex}
                        />
                        <LabeledSelect
                          label="Select ReportTable"
                          data-testid="ec3-report-table-select"
                          options={getReportTableOptions(assembly)}
                          value={assembly.reportTable}
                          onChange={async (selectedReportTable) => {
                            // reset all related fields
                            onAssemblyDataChange(
                              {
                                elementNameColumn: "UserLabel",
                                elementQuantityColumn: "",
                                materials: [],
                                name: assembly.name,
                                reportTable: selectedReportTable,
                              },
                              i,
                            );
                          }}
                          disabled={i !== editableAssemblyIndex}
                        />
                        <LabeledSelect
                          data-testid="ec3-element-select"
                          required
                          label={"Element"}
                          options={
                            getMetadataColumns(assembly, CreateAssemblyDropdownType.elementName)?.map((x) => {
                              return { label: x, value: x };
                            }) ?? []
                          }
                          value={assembly.elementNameColumn}
                          onChange={async (value) => {
                            onAssemblyDataChange({ ...assembly, elementNameColumn: value }, i);
                          }}
                          disabled={isLoading || assembly.reportTable === "" || i !== editableAssemblyIndex}
                          placeholder={isLoading ? "Loading elements" : assembly.reportTable === "" ? "Select report table first" : "Select element"}
                        />
                        <LabeledSelect
                          data-testid="ec3-element-quantity-select"
                          required
                          label={"Element quantity"}
                          options={
                            getMetadataColumns(assembly, CreateAssemblyDropdownType.elementQuantity)?.map((x) => {
                              return { label: x, value: x };
                            }) ?? []
                          }
                          value={assembly.elementQuantityColumn}
                          onChange={async (value) => {
                            onAssemblyDataChange({ ...assembly, elementQuantityColumn: value }, i);
                          }}
                          disabled={isLoading || assembly.reportTable === "" || i !== editableAssemblyIndex}
                          placeholder={isLoading ? "Loading elements" : assembly.reportTable === "" ? "Select report table first" : "Select element quantity"}
                        />
                        <Label htmlFor="combo-input" required>
                          Materials
                        </Label>
                        <Select
                          disabled={isLoading || assembly.reportTable === "" || i !== editableAssemblyIndex}
                          options={
                            getMetadataColumns(assembly, CreateAssemblyDropdownType.material)?.map((x) => {
                              return { label: x, value: x };
                            }) ?? []
                          }
                          value={assembly.materials.map((x) => x?.nameColumn)}
                          onChange={(val, event) => {
                            if (val) {
                              onAssemblyDataChange(
                                {
                                  ...assembly,
                                  materials:
                                    event === "removed"
                                      ? assembly.materials.filter((value) => val !== value?.nameColumn)
                                      : [...(assembly.materials ?? []), { nameColumn: val }],
                                },
                                i,
                              );
                            }
                          }}
                          placeholder={
                            isLoading
                              ? "Loading elements"
                              : assembly.reportTable === ""
                                ? "Select report table first"
                                : "Select property containing material names"
                          }
                          multiple
                        />
                      </>
                    </ExpandableBlock>
                  </>
                );
              })}
            <div className="button-row-above-stepper">
              <Button
                className="add-new-button"
                styleType="borderless"
                title="Add new"
                startIcon={<SvgAdd />}
                onClick={() => {
                  // add new empty item to the assemblies array
                  addNewEmptyAssembly();
                }}
              >
                Add new
              </Button>
            </div>
          </div>
          <div className="stepper-footer">
            <Button onClick={props.onBackClick} className="footer-button">
              Back
            </Button>
            <Button
              styleType="high-visibility"
              className="footer-button"
              disabled={
                allAssemblies === undefined ||
                (allAssemblies && allAssemblies?.length === 0) ||
                allAssemblies.some((assembly) => assembly.name === "") ||
                allAssemblies.some((assembly) => assembly.name === undefined) ||
                allAssemblies.some((assembly) => assembly.elementNameColumn === undefined) ||
                allAssemblies.some((assembly) => assembly.elementQuantityColumn === undefined) ||
                allAssemblies.some((assembly) => assembly.materials.length === 0) ||
                allAssemblies.some((assembly) => assembly.reportTable === "")
              }
              onClick={() => {
                // send back updated assemblies to the parent
                props.setTemplate({ ...props.template, labels: allAssemblies ?? [] });
                props.onNextClick();
              }}
            >
              Next
            </Button>
            <Button onClick={props.onCancelClick}>Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
};

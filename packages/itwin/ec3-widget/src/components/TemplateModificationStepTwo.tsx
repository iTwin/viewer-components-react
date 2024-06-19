/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, ButtonGroup, ExpandableBlock, IconButton } from "@itwin/itwinui-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Configuration } from "./EC3/Template";
import React from "react";
import type { EC3ConfigurationLabel, ODataTable, Report } from "@itwin/insights-client";
import "./TemplateModificationStepTwo.scss";
import { SvgAdd, SvgDelete, SvgEdit } from "@itwin/itwinui-icons-react";
import { useApiContext } from "./context/APIContext";
import { AssemblyItem } from "./AssemblyItem";
import type { useEC3WidgetLocalizationResult } from "../common/UseEC3WidgetLocalization";
import { useEC3WidgetLocalization } from "../common/UseEC3WidgetLocalization";

export interface TemplateModificationStepTwoProps {
  template: Configuration;
  updateCurrentStep: (currentStep: number) => void;
  onCancelClick?: () => void;
  setTemplate: (template: Configuration) => void;
  fetchedReports?: Report[];
  localizedStrings?: useEC3WidgetLocalizationResult;
}

export enum AssemblyCreationDropdownType {
  material,
  elementName,
  elementQuantity,
}

export const TemplateModificationStepTwo = (props: TemplateModificationStepTwoProps) => {
  const [allAssemblies, setAllAssemblies] = useState<EC3ConfigurationLabel[] | undefined>(props.template.labels);
  const [reportTables, setReportTables] = useState<string[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [oDataTable, setoDataTable] = useState<ODataTable[]>([]);
  const [editableAssemblyIndex, setEditableAssemblyIndex] = useState<number>();
  const localizedStrings = useEC3WidgetLocalization(props.localizedStrings);
  const oDataClient = useApiContext().oDataClient;
  const {
    config: { getAccessToken },
  } = useApiContext();

  useEffect(() => {
    setAllAssemblies(props.template.labels);
  }, [props.template.labels]);

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

  const isNextDisabled = useMemo(
    () =>
      !allAssemblies ||
      allAssemblies.length === 0 ||
      allAssemblies.some(
        (assembly) =>
          !assembly.name || !assembly.elementNameColumn || !assembly.elementQuantityColumn || assembly.materials.length === 0 || !assembly.reportTable,
      ),
    [allAssemblies],
  );

  const initReportTableSelection = useCallback(async () => {
    try {
      if (!props.template.reportId) throw new Error("Invalid report.");
      const token = await getAccessToken();
      setIsLoading(true);
      const reportMetadataResponse = await oDataClient.getODataReportMetadata(token, props.template.reportId);
      setoDataTable(reportMetadataResponse);
      setReportTables(reportMetadataResponse.map((d) => d.name ?? ""));
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
      throw new Error("Could not get Odata Tables");
    }
  }, [getAccessToken, oDataClient, props.template.reportId]);

  const addNewEmptyAssembly = useCallback(() => {
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
  }, [onAssemblyDataChange]);

  useEffect(() => {
    const init = async () => {
      if (allAssemblies === undefined || allAssemblies.length === 0) addNewEmptyAssembly();
      if (oDataTable === undefined || oDataTable.length === 0) await initReportTableSelection();
    };
    init(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [addNewEmptyAssembly, allAssemblies, initReportTableSelection, oDataTable]);

  const onAssemblyEdit = useCallback(
    (index: number) => (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      setEditableAssemblyIndex(index);
      e.stopPropagation();
    },
    [setEditableAssemblyIndex],
  );

  const onAssemblyDelete = useCallback(
    (assembly: EC3ConfigurationLabel, index: number) => (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.stopPropagation();
      onAssemblyDataChange(assembly, index, "delete");
    },
    [onAssemblyDataChange],
  );

  return (
    <div className="ec3w-create-template-step-two">
      <div className="ec3w-assembly-list">
        {allAssemblies &&
          allAssemblies.length > 0 &&
          allAssemblies?.map((assembly, i) => {
            return (
              <ExpandableBlock
                className="ec3w-assembly-expandable-block"
                title={`${assembly.name}`}
                endIcon={
                  <ButtonGroup>
                    <IconButton key={`edit-assembly${i}`} styleType="borderless" onClick={onAssemblyEdit(i)}>
                      <SvgEdit />
                    </IconButton>
                    <IconButton
                      key={`delete-assembly${i}`}
                      disabled={allAssemblies.length === 1}
                      styleType="borderless"
                      onClick={onAssemblyDelete(assembly, i)}
                    >
                      <SvgDelete />
                    </IconButton>
                  </ButtonGroup>
                }
                key={i}
                isExpanded={editableAssemblyIndex ? i === editableAssemblyIndex : i === 0}
              >
                <AssemblyItem
                  assembly={assembly}
                  allAssemblies={allAssemblies}
                  currentAssemblyIndex={i}
                  editableAssemblyIndex={editableAssemblyIndex}
                  oDataTable={oDataTable}
                  reportTables={reportTables}
                  isLoading={isLoading}
                  onAssemblyDataChange={onAssemblyDataChange}
                  setTemplate={props.setTemplate}
                  template={props.template}
                  localizedStrings={props.localizedStrings}
                />
              </ExpandableBlock>
            );
          })}
        <div className="ec3w-button-row-above-stepper">
          <Button
            className="add-new-button"
            styleType="borderless"
            title="Add new"
            disabled={allAssemblies?.length === reportTables?.length}
            startIcon={<SvgAdd />}
            onClick={() => {
              // add new empty item to the assemblies array
              addNewEmptyAssembly();
            }}
          >
            {localizedStrings.addNewAssembly}
          </Button>
        </div>
      </div>
      <div className="ec3w-stepper-footer">
        <Button
          onClick={() => {
            props.updateCurrentStep(0);
            props.setTemplate({ ...props.template, labels: allAssemblies ?? [] });
          }}
          className="ec3w-footer-button"
        >
          {localizedStrings.backButton}
        </Button>
        <Button
          styleType="high-visibility"
          className="ec3w-footer-button"
          data-testid="ec3-step-two-next-button"
          disabled={isNextDisabled}
          onClick={() => {
            // send back updated assemblies to the parent
            props.setTemplate({ ...props.template, labels: allAssemblies ?? [] });
            props.updateCurrentStep(2);
          }}
        >
          {localizedStrings.nextButton}
        </Button>
        <Button onClick={props.onCancelClick}> {localizedStrings.cancelButton}</Button>
      </div>
    </div>
  );
};

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, Label, LabeledInput, LabeledSelect, Select } from "@itwin/itwinui-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Configuration } from "./EC3/Template";
import React from "react";
import type { EC3ConfigurationLabel, EC3ConfigurationMaterial } from "@itwin/insights-client";
import { GroupSelector } from "./ReportTableSelectorV2";
import "./CreateAssemblyComponent.scss";
export interface LabelActionProps {
  template: Configuration;
  label?: EC3ConfigurationLabel[];
  onNextClick: () => void;
  onCancelClick?: () => void;
  onBackClick: () => void;
  setTemplate: (template: Configuration) => void;
  selectedGroupDetails: string;
  setSelectedGroupDetails: (table: string) => void;
}

export const CreateAssembly = (props: LabelActionProps) => {
  const [assemblyName, setAssemblyName] = useState<string>(props.label?.[0]?.name ?? "");
  const [elementName, setElementName] = useState<string>(props.label?.[0]?.elementNameColumn ?? "UserLabel");
  const [elementQuantity, setItemQuantity] = useState<string>(props.label?.[0]?.elementQuantityColumn ?? "");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [materials, setMaterials] = useState<(EC3ConfigurationMaterial | undefined)[]>(props.label?.[0]?.materials ?? []);
  const [availableStringColumns, setStringColumns] = useState<string[]>([]);
  const [availableNumericalColumns, setNumericalColumns] = useState<string[]>([]);

  const onNextClick = useCallback(async () => {
    const selectedLabel: EC3ConfigurationLabel = {
      reportTable: props.selectedGroupDetails,
      name: assemblyName,
      elementNameColumn: elementName,
      elementQuantityColumn: elementQuantity,
      materials: materials.filter((material): material is EC3ConfigurationMaterial => material !== undefined),
    };

    if (props.label !== undefined) {
      const i = props.template.labels.findIndex((l) => l.reportTable === props.label?.[0]?.reportTable);
      props.template.labels[i] = selectedLabel;
    } else {
      props.template.labels.push(selectedLabel);
    }

    props.setTemplate(props.template);
    props.onNextClick();
    // eslint-disable-next-line
  }, [assemblyName, elementName, elementQuantity, materials, props.template]);

  const stringColumnOptions = useMemo(() => {
    const options = availableStringColumns.map((col) => ({
      label: col,
      value: col,
    }));

    if (availableStringColumns.indexOf(elementName) === -1 && options.length !== 0) setElementName("");

    return options;
  }, [availableStringColumns, elementName]);

  const getStringColumnOptions = (material: string | undefined) => {
    const options = stringColumnOptions.filter((x) => !materials.some((m) => m?.nameColumn === x.label)).filter((x) => x.label !== elementName);
    if (material) options.push({ label: material, value: material });

    return options;
  };

  const getStringColumnOptionsForMaterial = (material: string | undefined) => {
    // eslint-disable-next-line
    console.log(stringColumnOptions);
    const options = stringColumnOptions.filter((x) => x.label !== elementName);
    if (material) options.push({ label: material, value: material });

    return options;
  };

  const numericalColumnOptions = useMemo(() => {
    const options = availableNumericalColumns.map((col) => ({
      label: col,
      value: col,
    }));

    if (availableNumericalColumns.indexOf(elementQuantity) === -1 && options.length !== 0) setItemQuantity("");

    return options;
  }, [availableNumericalColumns, elementQuantity]);

  useEffect(() => {
    setIsLoading(true);
    if (props.label) {
      setAssemblyName(props.label?.[0]?.name);
      setElementName(props.label?.[0]?.elementNameColumn);
      setItemQuantity(props.label?.[0]?.elementQuantityColumn);
      props.setSelectedGroupDetails(props.label?.[0]?.reportTable);
      setMaterials([...props.label?.[0]?.materials]); // creating a copy of array, so original (in the parent) isn't modified
    } else {
      setElementName("UserLabel");
    }
    // eslint-disable-next-line
  }, [props.label]);

  useEffect(() => {
    // eslint-disable-next-line
    console.log("in create assembly component");
  }, []);

  const onChangeCallback = useCallback(
    async (table: string, numCols: string[], strCols: string[]) => {
      if (table !== props.selectedGroupDetails) {
        setMaterials([]);
      }
      props.setSelectedGroupDetails(table);
      setNumericalColumns(numCols);
      setStringColumns(strCols);
    },
    // eslint-disable-next-line
    [props.selectedGroupDetails],
  );

  return (
    <>
      <div className="report-creation-step-two">
        <LabeledInput
          id="name"
          name="name"
          label="Assembly Name"
          value={assemblyName}
          onChange={(event) => {
            setAssemblyName(event.target.value);
          }}
        />
        <GroupSelector
          selectedGroupDetails={props.selectedGroupDetails}
          template={props.template}
          placeHolder={isLoading ? "Loading report tables" : "Select group"}
          onChange={onChangeCallback}
          setIsLoading={setIsLoading}
          isLoading={isLoading}
        />
        <LabeledSelect
          data-testid="ec3-element-select"
          required
          label={"Element"}
          options={getStringColumnOptions(elementName)}
          value={elementName}
          onChange={async (value) => {
            setElementName(value);
          }}
          disabled={isLoading || props.selectedGroupDetails === ""}
          placeholder={isLoading ? "Loading elements" : props.selectedGroupDetails === "" ? "Select group first" : "Select element"}
        />
        <LabeledSelect
          data-testid="ec3-element-quantity-select"
          required
          label={"Element quantity"}
          options={numericalColumnOptions}
          value={elementQuantity}
          onChange={async (value) => {
            setItemQuantity(value);
          }}
          disabled={isLoading || props.selectedGroupDetails === ""}
          placeholder={isLoading ? "Loading elements" : props.selectedGroupDetails === "" ? "Select group first" : "Select element quantity"}
        />
        <Label htmlFor="combo-input" required>
          Materials
        </Label>
        <Select
          disabled={isLoading || props.selectedGroupDetails === ""}
          options={getStringColumnOptionsForMaterial(elementName)}
          value={materials.map((x) => x?.nameColumn)}
          onChange={(val, event) => {
            if (val) {
              setMaterials((prev) => (event === "removed" ? prev.filter((value) => val !== value?.nameColumn) : [...prev, { nameColumn: val }]));
            }
          }}
          placeholder={isLoading ? "Loading elements" : props.selectedGroupDetails === "" ? "Select group first" : "Select property containing material names"}
          multiple
        />
      </div>
      <div className="stepper-footer">
        <Button className="back-button" onClick={props.onBackClick}>
          Back
        </Button>
        <Button
          className="next-button"
          styleType="high-visibility"
          disabled={
            assemblyName === undefined ||
            props.selectedGroupDetails === undefined ||
            elementName === undefined ||
            elementQuantity === undefined ||
            materials.length === 0
          }
          onClick={onNextClick}
        >
          Next
        </Button>
        <Button onClick={props.onCancelClick}>Cancel</Button>
      </div>
    </>
  );
};

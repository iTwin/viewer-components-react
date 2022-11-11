/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Fieldset, LabeledInput, Small } from "@itwin/itwinui-react";
import {
  SvgAdd,
  SvgDelete,
} from "@itwin/itwinui-icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import LabelActionPanel from "./LabelActionPanel";
import { Button, IconButton } from "@itwin/itwinui-react";
import { WidgetHeader } from "./utils";
import "./LabelAction.scss";
import type { Configuration, Label as EC3Label, Material } from "./Template";
import { DropdownTile } from "./DropdrownTile";
import DeleteModal from "./DeleteModal";
import useValidator from "../hooks/useValidator";
import React from "react";
import {
  Label,
  Select,
} from "@itwin/itwinui-react";
import { ReportTableSelector } from "./ReportTableSelector";

interface LabelActionProps {
  template: Configuration;
  label: EC3Label | undefined;
  goBack: () => Promise<void>;
  setTemplate: (sel: Configuration) => void;
}

const LabelAction = ({ template, goBack, label, setTemplate }: LabelActionProps) => {
  const [reportTable, setReportTable] = useState<string>(label?.reportTable ?? "");
  const [name, setName] = useState<string>(label?.name ?? "");
  const [itemName, setItemName] = useState<string>(label?.elementNameColumn ?? "UserLabel");
  const [itemQuantity, setItemQuantity] = useState<string>(label?.elementQuantityColumn ?? "");
  const [selectedMaterial, setSelectedMaterial] = useState<Material>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [materials, setMaterials] = useState<Material[]>(label?.materials.map((x) => { return { nameColumn: x.nameColumn }; }) ?? [{ nameColumn: undefined }]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [validator, _showValidationMessage] = useValidator();
  const [availableStringColumns, setStringColumns] = useState<string[]>([]);
  const [availableNumericalColumns, setNumericalColumns] = useState<string[]>([]);

  const onSave = async () => {
    const selectedLabel: EC3Label = {
      reportTable,
      name,
      elementNameColumn: itemName,
      elementQuantityColumn: itemQuantity,
      materials,
    };

    if (label) {
      const i = template.labels.findIndex((l) => l.reportTable === label.reportTable);
      template.labels[i] = selectedLabel;
    } else {
      template.labels.push(selectedLabel);
    }

    setTemplate(template);
  };

  const StringColumnOptions = useMemo(() => {
    const options = availableStringColumns.map((col) => ({
      label: col,
      value: col,
    }));

    if (availableStringColumns.indexOf(itemName) === -1)
      setItemName("");

    return options;
  }, [availableStringColumns]);

  const getStringColumnOptions = ((material: string | undefined) => {
    const options = StringColumnOptions
      .filter((x) => !materials.some((m) => m.nameColumn === x.label))
      .filter((x) => x.label !== itemName);

    if (material)
      options.push({ label: material, value: material });
    return options;
  });

  const NumericalColumnOptions = useMemo(() => {
    const options = availableNumericalColumns.map((col) => ({
      label: col,
      value: col,
    }));

    if (availableNumericalColumns.indexOf(itemQuantity) === -1)
      setItemQuantity("");

    return options;
  }, [availableNumericalColumns]);

  const addPair = (() => {
    const pair: Material = {
      nameColumn: undefined,
    };
    const newMaterials = materials.map((x) => { return { nameColumn: x.nameColumn }; });
    newMaterials.push(pair);
    setMaterials(newMaterials);
  });

  useEffect(() => {
    setIsLoading(true);
    if (label) {
      setName(label.name);
      setItemName(label.elementNameColumn);
      setItemQuantity(label.elementQuantityColumn);
      setMaterials(label.materials.map((x) => { return { nameColumn: x.nameColumn }; })); // creating a copy of array, so original (in the parent) isn't modified
    } else {
      setItemName("UserLabel");
    }
  }, []);

  const onChangeCallback = useCallback(async (table: string, numCols: string[], strCols: string[]) => {
    if (table !== reportTable) {
      setMaterials([{ nameColumn: undefined }]);
      setName(table);
    }
    setReportTable(table);
    setNumericalColumns(numCols);
    setStringColumns(strCols);
  }, [reportTable]);

  return (
    <>
      <WidgetHeader
        title={label?.name ?? "Label"}
        returnFn={goBack}
        disabled={isLoading}
      />
      <div className='ec3w-label-details-container'>
        <Fieldset legend='Label' className='ec3w-label-details'>
          <Small className='ec3w-label-field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>

          <ReportTableSelector
            selectedReportTable={reportTable}
            template={template}
            placeHolder={isLoading ? "Loading report tables" : "Select report table"}
            onChange={onChangeCallback}
            setLoading={setIsLoading}
          />

          <LabeledInput
            id='name'
            name='name'
            label='Name'
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />

          <div className="ec3w-dropdown-select-container">
            <div className="ec3w-dropdown-select-combo-box">
              <Label htmlFor="combo-input" required>
                Element
              </Label>
              <Select
                options={getStringColumnOptions(itemName)}
                value={itemName}
                // placeholder={isLoading ? "Loading elements" : "Select element quantity"}
                onChange={async (value) => {
                  setItemName(value);
                }}
                disabled={isLoading || reportTable === ""}
                placeholder={isLoading ? "Loading elements" : (reportTable === "" ? "Select report table first" : "Select element")}
              />
            </div>
          </div>

          <div className="ec3w-dropdown-select-container">
            <div className="ec3w-dropdown-select-combo-box">
              <Label htmlFor="combo-input" required>
                Element quantity
              </Label>
              <Select
                options={NumericalColumnOptions}
                value={itemQuantity}
                // placeholder={isLoading ? "Loading elements" : "Select element quantity"}
                onChange={async (value) => {
                  setItemQuantity(value);
                }}
                disabled={isLoading || reportTable === ""}
                placeholder={isLoading ? "Loading elements" : (reportTable === "" ? "Select report table first" : "Select element quantity")}
              />
            </div>
          </div>
        </Fieldset>

        <Fieldset legend='Materials' className='ec3w-label-details'>
          <div className="ec3w-pair-list">
            <Button
              className="ec3w-label-button"
              startIcon={<SvgAdd />}
              onClick={addPair}
              styleType="default"
              disabled={isLoading || reportTable === "" || materials.filter((x) => x.nameColumn === undefined).length > 0}
            >
              Add material
            </Button>
            {materials.map((material, index) => (
              <DropdownTile
                key={index}
                deletionDisabled={index === 0}
                disabled={reportTable === ""}
                stringColumnOptions={getStringColumnOptions(material.nameColumn)}
                materialValue={material.nameColumn ?? ""}
                onMaterialChange={async (value) => {
                  const newPairs = materials.map((x) => { return { nameColumn: x.nameColumn }; });
                  newPairs.forEach((p) => {
                    if (p.nameColumn === material.nameColumn)
                      p.nameColumn = value;
                  });
                  setMaterials(newPairs);
                }}
                actionGroup={
                  <div className="actions">
                    <IconButton
                      styleType="borderless"
                      className="delete-icon"
                      onClick={() => {
                        setSelectedMaterial(material);
                        setShowDeleteModal(true);
                        close();
                      }}
                    >
                      <SvgDelete />
                    </IconButton>
                  </div>
                }
              />
            ))}
          </div>
        </Fieldset>
      </div>

      <DeleteModal
        entityName={selectedMaterial?.nameColumn ?? ""}
        show={showDeleteModal}
        setShow={setShowDeleteModal}
        onDelete={async () => {
          setMaterials(materials.filter((x) => x.nameColumn !== selectedMaterial?.nameColumn));
        }}
        refresh={async () => { }}
      />

      <LabelActionPanel
        isSavingDisabled={
          !validator.allValid() ||
          materials.filter((x) => x.nameColumn === undefined).length > 0 ||
          itemQuantity === "" ||
          itemName === ""
        }
        onSave={async () => {
          void onSave();
          await goBack();
        }
        }
        onCancel={goBack}
        isLoading={isLoading}
      />
    </>
  );
};

export default LabelAction;

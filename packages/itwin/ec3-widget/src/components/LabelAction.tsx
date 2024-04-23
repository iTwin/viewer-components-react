/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Fieldset, LabeledInput, LabeledSelect, Text } from "@itwin/itwinui-react";
import {
  SvgAdd,
  SvgDelete,
} from "@itwin/itwinui-icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, IconButton } from "@itwin/itwinui-react";
import "./LabelAction.scss";
import type { Configuration } from "./EC3/Template";
import { DropdownTile } from "./DropdrownTile";
import React from "react";
import { ReportTableSelector } from "./ReportTableSelector";
import SimpleReactValidator from "simple-react-validator";
import { DeleteModal } from "./DeleteModal";
import { LabelActionPanel } from "./LabelActionPanel";
import type { EC3ConfigurationLabel, EC3ConfigurationMaterial } from "@itwin/insights-client";

export interface LabelActionProps {
  template: Configuration;
  label?: EC3ConfigurationLabel;
  onClose: () => Promise<void>;
  setTemplate: (sel: Configuration) => void;
}

export const LabelAction = ({ template, onClose, label, setTemplate }: LabelActionProps) => {
  const [reportTable, setReportTable] = useState<string>(label?.reportTable ?? "");
  const [name, setName] = useState<string>(label?.name ?? "");
  const [itemName, setItemName] = useState<string>(label?.elementNameColumn ?? "UserLabel");
  const [itemQuantity, setItemQuantity] = useState<string>(label?.elementQuantityColumn ?? "");
  const [selectedMaterial, setSelectedMaterial] = useState<EC3ConfigurationMaterial | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [materials, setMaterials] = useState<(EC3ConfigurationMaterial | undefined)[]>(label?.materials ?? [undefined]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [availableStringColumns, setStringColumns] = useState<string[]>([]);
  const [availableNumericalColumns, setNumericalColumns] = useState<string[]>([]);
  const validator = new SimpleReactValidator();

  const onSave = async () => {
    const selectedLabel: EC3ConfigurationLabel = {
      reportTable,
      name,
      elementNameColumn: itemName,
      elementQuantityColumn: itemQuantity,
      materials: materials.filter((material): material is EC3ConfigurationMaterial => material !== undefined),
    };

    if (label) {
      const i = template.labels.findIndex((l) => l.reportTable === label.reportTable);
      template.labels[i] = selectedLabel;
    } else {
      template.labels.push(selectedLabel);
    }

    setTemplate(template);
  };

  const stringColumnOptions = useMemo(() => {
    const options = availableStringColumns.map((col) => ({
      label: col,
      value: col,
    }));

    if (availableStringColumns.indexOf(itemName) === -1 && options.length !== 0)
      setItemName("");

    return options;
  }, [availableStringColumns, itemName]);

  const getStringColumnOptions = ((material: string | undefined) => {
    const options = stringColumnOptions
      .filter((x) => !materials.some((m) => m?.nameColumn === x.label))
      .filter((x) => x.label !== itemName);

    if (material)
      options.push({ label: material, value: material });
    return options;
  });

  const numericalColumnOptions = useMemo(() => {
    const options = availableNumericalColumns.map((col) => ({
      label: col,
      value: col,
    }));

    if (availableNumericalColumns.indexOf(itemQuantity) === -1 && options.length !== 0)
      setItemQuantity("");

    return options;
  }, [availableNumericalColumns, itemQuantity]);

  const addPair = (() => {
    setMaterials((oldMaterials) => [...oldMaterials, undefined]);
  });

  useEffect(() => {
    setIsLoading(true);
    if (label) {
      setName(label.name);
      setItemName(label.elementNameColumn);
      setItemQuantity(label.elementQuantityColumn);
      setMaterials([...label.materials]); // creating a copy of array, so original (in the parent) isn't modified
    } else {
      setItemName("UserLabel");
    }
  }, [label]);

  const onChangeCallback = useCallback(async (table: string, numCols: string[], strCols: string[]) => {
    if (table !== reportTable) {
      setMaterials([undefined]);
      setName(table);
    }
    setReportTable(table);
    setNumericalColumns(numCols);
    setStringColumns(strCols);
  }, [reportTable]);

  return (
    <>
      <div className='ec3w-label-details-container' data-testid="ec3-label-action">
        <Fieldset legend='Assembly' className='ec3w-label-details'>
          <Text variant="small" className='ec3w-label-field-legend'>
            Asterisk * indicates mandatory fields.
          </Text>

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
            label='Assembly Name'
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />

          <LabeledSelect
            data-testid="ec3-element-select"
            required
            label={"Element"}
            options={getStringColumnOptions(itemName)}
            value={itemName}
            onChange={async (value) => {
              setItemName(value);
            }}
            disabled={isLoading || reportTable === ""}
            placeholder={isLoading ? "Loading elements" : (reportTable === "" ? "Select report table first" : "Select element")}
          />

          <LabeledSelect
            data-testid="ec3-element-quantity-select"
            required
            label={"Element quantity"}
            options={numericalColumnOptions}
            value={itemQuantity}
            onChange={async (value) => {
              setItemQuantity(value);
            }}
            disabled={isLoading || reportTable === ""}
            placeholder={isLoading ? "Loading elements" : (reportTable === "" ? "Select report table first" : "Select element quantity")}
          />
        </Fieldset>

        <Fieldset legend='Materials' className='ec3w-label-details'>
          <div className="ec3w-pair-list">
            <Button
              className="ec3w-label-button"
              data-testid="ec3-add-material-button"
              startIcon={<SvgAdd />}
              onClick={addPair}
              styleType="default"
              disabled={isLoading || reportTable === "" || materials.some((material) => material === undefined)}
            >
              Add Material
            </Button>
            {materials.map((material, index) => (
              <DropdownTile
                key={index}
                required={index === 0}
                disabled={reportTable === ""}
                stringColumnOptions={getStringColumnOptions(material?.nameColumn)}
                materialValue={material?.nameColumn ?? ""}
                onMaterialChange={async (value) => {
                  setMaterials((oldMaterials) => {
                    const newPairs = oldMaterials.map((oldMaterial) =>
                      oldMaterial?.nameColumn === material?.nameColumn ? { nameColumn: value } : oldMaterial
                    );
                    return newPairs;
                  });
                }}
                actionGroup={
                  <div className="actions">
                    <IconButton
                      data-testid="ec3-materials-delete-button"
                      styleType="borderless"
                      className="delete-icon"
                      disabled={index === 0}
                      onClick={() => {
                        setSelectedMaterial(material);
                        setShowDeleteModal(true);
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
          setMaterials(materials.filter((x) => x?.nameColumn !== selectedMaterial?.nameColumn));
        }}
        refresh={async () => { }}
      />

      <LabelActionPanel
        isSavingDisabled={
          !validator.allValid() ||
          materials.filter((x) => x?.nameColumn === undefined).length > 0 ||
          itemQuantity === "" ||
          itemName === ""
        }
        onSave={async () => {
          void onSave();
          await onClose();
        }
        }
        onCancel={onClose}
        isLoading={isLoading}
      />
    </>
  );
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DropdownMenu, Fieldset, LabeledInput, Small, LabeledSelect } from "@itwin/itwinui-react";
import {
  SvgAdd,
  SvgDelete,
  SvgMore,
} from "@itwin/itwinui-icons-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import LabelActionPanel from "./LabelActionPanel";
import { IModelApp } from "@itwin/core-frontend";
import { Button, toaster, MenuItem, IconButton } from "@itwin/itwinui-react";
import { WidgetHeader } from "./utils";
import "./LabelAction.scss";
import { Configuration, Label, Material } from "./Template"
import { ReportingClient } from "@itwin/insights-client";
import { DropdownTile } from "./DropdrownTile";
import DeleteModal from "./DeleteModal";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import React from "react";

interface LabelActionProps {
  template: Configuration;
  label: Label | undefined;
  goBack: () => Promise<void>;
  setTemplate: (sel: Configuration) => void;
}

async function fetchMetadata(token: string, reportingClientApi: ReportingClient, reportId: string) {
  return (await reportingClientApi.getODataReportMetadata(token, reportId)).text();
}

const LabelAction = ({ template, goBack, label, setTemplate }: LabelActionProps) => {
  const [reportTable, setReportTable] = useState<string>(label?.reportTable ?? "");
  const [name, setName] = useState<string>(label?.name ?? "");
  const [itemName, setItemName] = useState<string>(label?.elementNameColumn ?? "UserLabel");
  const [itemQuantity, setItemQuantity] = useState<string>(label?.elementQuantityColumn ?? "");
  const [selectedMaterial, setSelectedMaterial] = useState<Material>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // creating a copy of an array, so original isn't modified
  const [materials, setMaterials] = useState<Material[]>(label?.materials.map(x => { return { nameColumn: x.nameColumn } }) ?? []);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [validator, showValidationMessage] = useValidator();
  const [availableLabels, setLabels] = useState<string[]>();
  const [availableStringColumns, setStringColumns] = useState<string[]>([]);
  const [availableNumericalColumns, setNumericalColumns] = useState<string[]>([]);
  const reportingClientApi = useMemo(() => new ReportingClient(), []);

  const onSave = async () => {
    const selectedLabel: Label = {
      reportTable: reportTable,
      name: name,
      elementNameColumn: itemName,
      elementQuantityColumn: itemQuantity,
      materials: materials,
    }

    if (label) {
      for (let i = 0; i < template.labels.length; i++) {
        if (template.labels[i].reportTable === label.reportTable) {
          template.labels[i] = selectedLabel;
          break;
        }
      }
    }
    else {
      template.labels.push(selectedLabel);
    }

    setTemplate(template);
  };

  async function updateColumns(labelName: string) {
    setIsLoading(true);

    if (!IModelApp.authorizationClient) {
      setIsLoading(false);
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    }


    if (!template.reportId) {
      setIsLoading(false);
      throw new Error(
        "Invalid report."
      );
    }

    try {
      const accessToken = await IModelApp.authorizationClient
        .getAccessToken();

      const responseText = await fetchMetadata(accessToken, reportingClientApi, template.reportId);
      const dom = new DOMParser().parseFromString(responseText, "text/xml");

      const c = dom.getElementsByTagName("EntityType");

      const elems = Array.from(dom.getElementsByTagName("EntityType")).filter(x => x.attributes[0].value === labelName);

      if (elems.length > 0) {
        const columns = Array.from(elems[0].children).map(x => x.attributes);
        const stringColumns = columns.filter(x => x[1].value === "Edm.String").map(x => x[0].value);
        const numericalColumns = columns.filter(x => x[1].value === "Edm.Double").map(x => x[0].value);
        setStringColumns(stringColumns);
        setNumericalColumns(numericalColumns);
      }
    }
    catch (err) {
      toaster.negative("You are not authorized to use this system.");
      /* eslint-disable no-console */
      console.error(err);
    }
    setIsLoading(false);
  }

  const labelOptions = useMemo(() => {
    return availableLabels?.map((g) => ({
      label: g,
      value: g,
    })) ?? [];
  }, [availableLabels]);



  const StringColumnOptions = useMemo(() => {
    const options = availableStringColumns?.map((col) => ({
      label: col,
      value: col,
    })) ?? [];

    if (availableStringColumns.indexOf(itemName) === -1) {
      setItemName("");
    }

    return options;
  }, [availableStringColumns]);

  const getStringColumnOptions = ((material: string | undefined) => {
    const options = StringColumnOptions
      .filter(x => materials.filter(p => p.nameColumn === x.label).length === 0)
      .filter(x => x.label !== itemName);


    if (material)
      options.push({ label: material, value: material });
    return options;
  })


  const NumericalColumnOptions = useMemo(() => {
    const options = availableNumericalColumns?.map((col) => ({
      label: col,
      value: col,
    })) ?? [];

    if (availableNumericalColumns.indexOf(itemQuantity) === -1) {
      setItemQuantity("");
    }
    return options;
  }, [availableNumericalColumns]);



  const load = (async () => {
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    if (!template.reportId)
      throw new Error(
        "Invalid report."
      );

    const token = await IModelApp.authorizationClient
      .getAccessToken();
    const data = await reportingClientApi
      .getODataReport(token, template.reportId);
    if (data) {
      const labelItems = data.value.map(data =>
        data.name ?? ""
      );
      const filteredLabels: string[] = label ? [label.reportTable] : [];
      for (const g of labelItems) {
        if (template.labels.filter(x => x.reportTable === g).length === 0) {
          filteredLabels.push(g);
        }
      }

      if (!availableLabels)
        setLabels(filteredLabels);
    }
  })

  const refresh = useCallback(async () => {
    await load();
  }, []);

  const addPair = (() => {
    if (materials.filter(x => x.nameColumn === undefined).length === 0) {

      const pair: Material = {
        nameColumn: undefined,
      };

      const newMaterials = materials.map((x) => { return { nameColumn: x.nameColumn } });

      newMaterials.push(pair);
      setMaterials(newMaterials);
    }
  })

  useEffect(() => {
    setIsLoading(true);
    if (label) {
      setReportTable(label.reportTable);
      setName(label.name);
      setItemName(label.elementNameColumn);
      setItemQuantity(label.elementQuantityColumn);
      setMaterials(label.materials.map(x => { return { nameColumn: x.nameColumn } })); // creating a copy of array, so original (in the parent) isn't modified
      updateColumns(label.reportTable);
    }
    else {
      setItemName("UserLabel");
    }

    const fetchMappings = async () => {
      if (!IModelApp.authorizationClient) {
        setIsLoading(false);
        throw new Error(
          "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
        );
      }

      if (!template.reportId) {
        setIsLoading(false);
        throw new Error(
          "Invalid report."
        );
      }

      try {
        const accessToken = await IModelApp.authorizationClient
          .getAccessToken();

        const ODataReport = await reportingClientApi
          .getODataReport(accessToken, template.reportId);

        if (ODataReport) {
          const labelItems = ODataReport.value.map(data =>
            data.name ?? ""
          );
          const filteredLabels: string[] = label ? [label.reportTable] : [];
          for (const g of labelItems) {
            if (template.labels.filter(x => x.reportTable === g).length === 0) {
              filteredLabels.push(g);
            }
          }
          if (!availableLabels)
            setLabels(filteredLabels);
        }
      }
      catch (err) {
        toaster.negative("You are not authorized to get metadata for this report. Please contact project administrator.");
        console.error(err);
      }

      setIsLoading(false);
    }

    void fetchMappings();
  }, []);

  return (
    <>
      <WidgetHeader
        title={label?.name ?? "Label"}
        returnFn={goBack}
        disabled={isLoading}
      />
      <div className='ec3-label-details-container'>
        <Fieldset legend='Label' className='ec3-label-details'>
          <Small className='ec3-label-field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>

          <LabeledSelect
            label="Report table"
            id='reportTable'
            placeholder={isLoading ? "Loading report tables" : "Select report table"}
            required
            options={labelOptions}
            value={reportTable}
            onChange={async (value) => {
              if (value !== reportTable) {
                setMaterials([]);
                setName(value);
              }

              setReportTable(value);
              updateColumns(value);
            }}
            message={validator.message(
              "reportTable",
              reportTable,
              NAME_REQUIREMENTS,
            )}
            status={
              validator.message(
                "reportTable",
                reportTable,
                NAME_REQUIREMENTS,
              )
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("reportTable");
            }} onShow={() => { }} onHide={() => { }} />
          <LabeledInput
            id='name'
            name='name'
            label='Name'
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <div className="body">
            <div className="ec3-label-combo-field">
              <LabeledSelect
                label="Element"
                id='element'
                required
                options={getStringColumnOptions(itemName)}
                value={itemName}
                onChange={async (value) => {
                  setItemName(value);
                }}
                message={validator.message(
                  "element",
                  itemName,
                  NAME_REQUIREMENTS,
                )}
                status={
                  validator.message(
                    "element",
                    itemName,
                    NAME_REQUIREMENTS,
                  )
                    ? "negative"
                    : undefined
                }
                onBlur={() => {
                  validator.showMessageFor("element");
                }} onShow={() => { }} onHide={() => { }} />
            </div>
            <div className="ec3-label-combo-field">
              <LabeledSelect
                label="Element quantity"
                id='elementQuantity'
                placeholder={isLoading ? "Loading elements" : "Select element quantity"}
                required
                options={NumericalColumnOptions}
                value={itemQuantity}
                onChange={async (value) => {
                  setItemQuantity(value);
                  console.log(value);
                }}
                message={validator.message(
                  "elementQuantity",
                  itemQuantity,
                  NAME_REQUIREMENTS,
                )}
                status={
                  validator.message(
                    "elementQuantity",
                    itemQuantity,
                    NAME_REQUIREMENTS,
                  )
                    ? "negative"
                    : undefined
                }
                onBlur={() => {
                  validator.showMessageFor("elementQuantity");
                }} onShow={() => { }} onHide={() => { }} />
            </div>

          </div>
          <div className="ec3-pair-list">
            {materials.map((material, index) => (
              <DropdownTile
                key={index}
                stringColumnOptions={getStringColumnOptions(material.nameColumn)}
                materialValue={material.nameColumn ?? ""}
                validator={validator}
                onMaterialChange={async (value) => {
                  const newPairs = materials.map(x => { return { nameColumn: x.nameColumn } });
                  newPairs.forEach(p => {
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
            <Button
              className="ec3-label-button"
              startIcon={<SvgAdd />}
              onClick={addPair}
              styleType="high-visibility"
            >
              {"Add material"}
            </Button>
          </div>
        </Fieldset>
      </div>

      <DeleteModal
        entityName={selectedMaterial?.nameColumn ?? ""}
        show={showDeleteModal}
        setShow={setShowDeleteModal}
        onDelete={async () => {
          setMaterials(materials.filter(x => x.nameColumn !== selectedMaterial?.nameColumn));
        }}
        refresh={refresh}
      />

      <LabelActionPanel
        onSave={async () => {
          if (!validator.allValid()) {
            showValidationMessage(true);
            return;
          }

          onSave();
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

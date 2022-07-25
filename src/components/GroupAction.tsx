/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DropdownMenu, Fieldset, LabeledInput, Small, ToggleSwitch, ComboBox, SelectOption } from "@itwin/itwinui-react";
import React, { useState, useMemo, useEffect } from "react";
import ActionPanel from "./ActionPanel";
import { IModelApp } from "@itwin/core-frontend";
import { ODataItem } from "@itwin/insights-client";
import { Button, Table, toaster, Label } from "@itwin/itwinui-react";
//import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleInputChange, WidgetHeader } from "./utils";
import "./GroupAction.scss";
//import { useMappingClient } from "./context/MappingClientContext";
import type { Mapping } from "@itwin/insights-client";
import { Selector, Group, Pair } from "./Selector"
import SelectorClient from "./selectorClient"
import { Guid } from "@itwin/core-bentley";
//import { Group } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
//import { DropdownInput } from "@itwin/itwinui-react";
//import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";


// Cia reikia labai daug taisyt
// visu pirma: kad grupes itemas gali turet daug materialu poru Ir tada prasideda reikalai su ui...
//
// ADDD VALIDATOR!!!!

interface GroupActionProps {
  //selectorId: string;
  //reportId: string;
  selector: Selector;
  //selectedGroup: string | undefined;
  group: Group | undefined;
  goBack: () => Promise<void>;
  resetView: () => Promise<void>;
}


type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

type groupItem = CreateTypeFromInterface<Group>;

async function fetchEntity(token: string, reportingClientApi: ReportingClient, reportId: string, ODataItem: ODataItem) {
  return reportingClientApi.getODataReportEntity(token, reportId, ODataItem);
}



async function fetchMetadata(token: string, reportingClientApi: ReportingClient, reportId: string) {
  return (await reportingClientApi.getODataReportMetadata(token, reportId)).text();
}

const GroupAction = ({ selector, goBack, group }: GroupActionProps) => {
  const selectorClient = new SelectorClient();


  /*
  function setGroupName(value: string) {
    updateColumns(value);


    if (selectedGroup)
      selectedGroup.groupName = value;
    else {
      selectedGroup = {
        groupName: value,

      }
    }
    //;
  }
  */
  //const groupLabel = {
  //  name: "",
  // }
  //const mappingClient = useMappingClient();

  //var selectedGroup: Group | undefined;

  const [groupName, setGroupName] = useState<string>();
  const [elementColumn, setElementColumn] = useState<string>();
  const [material, setMaterialColumn] = useState<string>();
  const [quantity, setQuantityColumn] = useState<string>();

  /*
  if (group)
    selectedGroup = group;
  else {
    selectedGroup = undefined;
  }
  */

  //var [selectedGroup, setGroup] = useState<Group>();
  //const [materialColumn, setMaterialColumn] = useState<string>();
  //const [quantityColumn, setQuantityColumn] = useState<string>();

  //const [groupLabel, setGroup] = useState<GroupLabel>();

  /*
  const [values, setValues] = useState({
    name: groupLabel?.name ?? "",
    itemLabel: groupLabel?.element.name ?? "",
    material: groupLabel?.element.material ?? "",
    quantity: groupLabel?.element.quantity ?? "",
  });
  */

  //const group: Group;
  //const [selectedGroup, setGroup] = useState<Group>();
  //const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [availableGroups, setGroups] = useState<string[]>([]);
  const [availableColumns, setColumns] = useState<string[]>([]);
  //const [selector, setSelector] = useState<Selector>();
  const reportingClientApi = useMemo(() => new ReportingClient(), []);


  //setSelector(selectorClient.getSelector(props.templateId));

  const onSave = async () => {

    /*
    const groupLabel: GroupLabel = {
      name: values.name ?? "",

    }
    */

    //groupLabel?.element.material = selectedm
    /////////////////////////////////////////////////////
    //CHECK IF selector GROUP CHANGED




    /*
    if (groupName)
      selectedGroup.groupName = groupName;
    */

    const pairs: Pair[] = [];

    const pair: Pair = {
      material: material ?? "",
      quantity: quantity ?? "",
    }

    pairs.push(pair);

    const selectedGroup: Group = {
      groupName: groupName ?? "",
      itemName: elementColumn ?? "",
      pairs: pairs,
    }


    selector.groups.push(selectedGroup);
    //selector.groups.push(groupLabel);
    selectorClient.updateSelector(selector);
    await goBack();


    /*
  if (selector) {


  }
  else {
    console.error("selector is undefined!!!");
  }
  */



  };



  // const updateColumns: void (groupName: string) (() => {

  //})

  function updateColumns(groupName: string) {

    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    if (!selector.reportId)
      throw new Error(
        "Invalid report."
      );

    IModelApp.authorizationClient
      .getAccessToken()
      .then(async (token: string) => {

        const responseText = await fetchMetadata(token, reportingClientApi, selector.reportId);

        const dom = new DOMParser().parseFromString(responseText, "text/xml");
        const elems = Array.from(dom.getElementsByTagName("EntityType")).filter(x => x.attributes[0].value == groupName);


        if (elems.length > 0) {
          const columns = Array.from(elems[0].children).map(x => x.attributes[0].value);
          columns.push(selector.groups[0].groupName);
          setColumns(columns);
        }

      })
      .catch((err) => {
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
      });

  }

  const groupOptions = useMemo(() => {
    const newGroupOptions: SelectOption<string>[] = [];


    for (const name of availableGroups) {
      newGroupOptions.push({
        label: name,
        value: name,
        key: name,
      });
    }
    return newGroupOptions;
  }, [availableGroups]);

  const ColumnOptions = useMemo(() => {
    const newGroupOptions: SelectOption<string>[] = [];


    for (const name of availableColumns) {
      newGroupOptions.push({
        label: name,
        value: name,
        key: name,
      });
    }
    return newGroupOptions;
  }, [availableColumns]);

  const load = (() => {
    setIsLoading(true);


    if (group) {
      setGroupName(group.groupName);
      setElementColumn(group.itemName);
      setMaterialColumn(group.pairs[0].material);
      setQuantityColumn(group.pairs[0].quantity);
    }

    //setGroup(groupLabel);

    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    if (!selector.reportId)
      throw new Error(
        "Invalid report."
      );

    IModelApp.authorizationClient
      .getAccessToken()
      .then((token: string) => {
        reportingClientApi
          .getODataReport(token, selector.reportId)
          .then(async (data) => {
            if (data) {
              const reportData = data ?? "";
              const groupItems = reportData.value.map(data =>
                data.name ?? ""
              );
              //setGroups(groupItems)

              const filteredGroups: string[] = [];

              for (const g of groupItems) {
                if (selector?.groups.filter(x => x.groupName == g).length == 0) {
                  filteredGroups.push(g);
                }
              }

              if (groupName)
                filteredGroups.push(groupName);

              setGroups(filteredGroups);
            }
          })
          .catch((err) => {
            toaster.negative("You are not authorized to get metadata for this report. Please contact project administrator.");
            /* eslint-disable no-console */
            console.error(err);
          });
      })
      .catch((err) => {
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
      });

    setIsLoading(false);
  })

  useEffect(() => {
    load();
  }, [reportingClientApi]);

  return (
    <>
      <WidgetHeader
        title={"Select group"}
        returnFn={goBack}
      />
      <div className='details-form-container'>
        <Fieldset legend='Group' className='details-form'>
          <Small className='field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>

          <Label htmlFor="group-combo-input">
            Label
          </Label>
          <ComboBox
            options={groupOptions}
            value={groupName}
            onChange={async (value) => {
              //setGroupName(value);
              updateColumns(value);
              setGroupName(value);
              //setSelectedGroupName(value);
              //selectedGroup.groupName = value;
              //setGroup(value);

            }}
            inputProps={{
              id: "group-combo-input",
              placeholder: "Label",
            }}
          />


          <Label htmlFor="item-combo-input">
            Element
          </Label>
          <ComboBox
            options={ColumnOptions}
            value={elementColumn}
            onChange={async (value) => {
              setElementColumn(value);
              //groupLabel?.element.material = value;
              //handleInputChange(event, value, setGroup);
              //setMaterialColumn(value);
              //await runExtraction(value);
            }}
            inputProps={{
              id: "item-combo-input",
              placeholder: "Element",
            }}
          />

          <Label htmlFor="material-combo-input">
            Material column
          </Label>
          <ComboBox
            options={ColumnOptions}
            value={material}
            onChange={async (value) => {
              setMaterialColumn(value);
              //groupLabel?.element.material = value;
              //handleInputChange(event, value, setGroup);
              //setMaterialColumn(value);
              //await runExtraction(value);
            }}
            inputProps={{
              id: "material-combo-input",
              placeholder: "Material column",
            }}
          />

          <Label htmlFor="quantity-combo-input">
            Quantity column
          </Label>
          <ComboBox
            options={ColumnOptions}
            value={quantity}
            onChange={async (value) => {
              setQuantityColumn(value);
              //values.quantity = value;
              //handleInputChange(event, value, setGroup);
              //setQuantityColumn(value);
              //await runExtraction(value);
            }}
            inputProps={{
              id: "quantity-combo-input",
              placeholder: "Quantity column",
            }}
          />

        </Fieldset>
      </div>
      <ActionPanel
        onSave={onSave}
        onCancel={goBack}
        //isSavingDisabled={!groupName}
        isLoading={isLoading}
      />
    </>
  );
};

export default GroupAction;

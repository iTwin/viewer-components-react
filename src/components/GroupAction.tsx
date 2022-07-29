/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DropdownMenu, Fieldset, LabeledInput, Small, ToggleSwitch, ComboBox, SelectOption } from "@itwin/itwinui-react";
import {
  SvgAdd,
  SvgCopy,
  SvgDelete,
  SvgMore,
} from "@itwin/itwinui-icons-react";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { SearchBox } from "@itwin/core-react";
import ActionPanel from "./ActionPanel";
import { IModelApp } from "@itwin/core-frontend";
import { ODataItem } from "@itwin/insights-client";
import { Button, Table, toaster, Label, Surface, MenuItem, IconButton } from "@itwin/itwinui-react";
//import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleInputChange, WidgetHeader } from "./utils";
import "./GroupAction.scss";
//import { useMappingClient } from "./context/MappingClientContext";
import type { Mapping } from "@itwin/insights-client";
import { Selector, Group, Pair } from "./Selector"
//import SelectorClient from "./selectorClient"
import { Guid } from "@itwin/core-bentley";
//import { Group } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import { DropdownTile } from "./DropdrownTile";
import { SearchBar } from "./SearchBar";
import DeleteModal from "./DeleteModal";
import { clearAll } from "./viewerUtils";
//import { DropdownInput } from "@itwin/itwinui-react";
//import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";


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
  setSelector: (sel: Selector) => void;
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

const GroupAction = ({ selector, goBack, group, resetView, setSelector }: GroupActionProps) => {
  //const selectorClient = new SelectorClient();


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
  const [elementQuantity, setElementQuantity] = useState<string>();
  const [selectedPair, setSelectedPair] = useState<Pair>();
  //const [material, setMaterialColumn] = useState<string>();
  //const [quantity, setQuantityColumn] = useState<string>();

  const [pairs, setPairs] = useState<(Pair)[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  //const [group, setGroup] = useState<Group | undefined>(selGroup);

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
  const [availableGroups, setGroups] = useState<string[]>();
  //const [availableColumns, setColumns] = useState<string[]>([]);
  const [availableStringColumns, setStringColumns] = useState<string[]>([]);
  const [availableNumericalColumns, setNumericalColumns] = useState<string[]>([]);
  //const [selector, setSelector] = useState<Selector>();
  const reportingClientApi = useMemo(() => new ReportingClient(), []);


  //setGroups(fetchGroups());


  //setSelector(selectorClient.getSelector(props.templateId));

  const tableStateSingleSelectReducer = (newState: any, action: any): any => {
    switch (action.type) {
      case "toggleRowSelected": {
        return { ...newState, selectedRowIds: { [action.id]: action.value } };
      }
      default:
        break;
    }
    return newState;
  };

  const groupColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "displayName",
            Header: "Name",
            accessor: "displayName",
          },
          {
            id: "description",
            Header: "Description",
            accessor: "description",
          },
        ],
      },
    ],
    []
  );

  const onSave = async () => {

    const selectedGroup: Group = {
      groupName: groupName ?? "",
      itemName: elementColumn ?? "",
      itemQuantity: elementQuantity ?? "",
      pairs: (pairs ?? []),
    }

    var updated = false;
    for (let i = 0; i < selector.groups.length; i++) {
      if (selector.groups[i].groupName === selectedGroup.groupName) {
        selector.groups[i] = selectedGroup;
        updated = true;
        break;
      }
    }
    if (!updated) {
      selector.groups.push(selectedGroup);
    }

    setSelector(selector);
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

          const columns = Array.from(elems[0].children).map(x => x.attributes);
          const stringColumns = columns.filter(x => x[1].value == "Edm.String").map(x => x[0].value);
          const numericalColumns = columns.filter(x => x[1].value == "Edm.Double").map(x => x[0].value);

          setStringColumns(stringColumns);
          setNumericalColumns(numericalColumns);

          //columns.push(selector.groups[0].groupName);
          //setColumns(columns);
        }

      })
      .catch((err) => {
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
      });

  }

  const groupOptions = useMemo(() => {

    //const groups = await fetchGroups();
    return availableGroups?.map((g) => ({
      label: g,
      value: g,
    })) ?? [];

    /*
    const newGroupOptions: SelectOption<string>[] = [];


    for (const name of availableGroups) {
      newGroupOptions.push({
        label: name,
        value: name,
        key: name,
      });
    }
    return newGroupOptions;
*/
  }, [availableGroups]);


  const StringColumnOptions = useMemo(() => {

    return availableStringColumns?.map((col) => ({
      label: col,
      value: col,
    })) ?? [];

  }, [availableStringColumns]);

  const NumericalColumnOptions = useMemo(() => {

    return availableNumericalColumns?.map((col) => ({
      label: col,
      value: col,
    })) ?? [];

  }, [availableNumericalColumns]);

  const load = (async () => {

    //setPairs(group?.pairs ?? []);
    //setGroups

    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    if (!selector.reportId)
      throw new Error(
        "Invalid report."
      );

    const token = await IModelApp.authorizationClient
      .getAccessToken();
    //.then((token: string) => {
    const data = await reportingClientApi
      .getODataReport(token, selector.reportId);
    //.then(async (data) => {
    if (data) {
      const reportData = data ?? "";
      const groupItems = reportData.value.map(data =>
        data.name ?? ""
      );
      const filteredGroups: string[] = group ? [group.groupName] : [];
      for (const g of groupItems) {
        if (selector?.groups.filter(x => x.groupName == g).length == 0) {
          filteredGroups.push(g);
        }
      }

      if (!availableGroups)
        setGroups(filteredGroups);
    }

  })
  /*
  .catch((err) => {
    toaster.negative("You are not authorized to get metadata for this report. Please contact project administrator.");
    console.error(err);
  });
})
.catch((err) => {
toaster.negative("You are not authorized to use this system.");
console.error(err);
});
*/



  const refresh = useCallback(async () => {
    //clearAll();
    //setSelectedPair(undefined);
    //setGroups([]);
    //setColumns([]);
    await load();
  }, []);

  const addPair = (() => {
    const pair: Pair = {
      material: undefined,
      quantity: undefined,
    };

    pairs.push(pair);
    //onSave();
    //resetView();
    refresh();
    //GroupAction({selector, goBack, group} : GroupActionProps);

  })

  /*
  useEffect(() => {

    if (group && !groupName) {
      setGroupName(group.groupName);
      setElementColumn(group.itemName);
      setMaterialColumn(group.pairs[0].material);
      setQuantityColumn(group.pairs[0].quantity);
    }

  }, [group]);
  */

  useEffect(() => {

    setPairs(group?.pairs ?? []);
    //setGroups

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
              const filteredGroups: string[] = group ? [group.groupName] : [];
              for (const g of groupItems) {
                if (selector?.groups.filter(x => x.groupName == g).length == 0) {
                  filteredGroups.push(g);
                }
              }

              if (!availableGroups)
                setGroups(filteredGroups);
            }

          })
          .catch((err) => {
            toaster.negative("You are not authorized to get metadata for this report. Please contact project administrator.");
            console.error(err);
          });
      })
      .catch((err) => {
        toaster.negative("You are not authorized to use this system.");
        console.error(err);
      });
  }, []);

  useEffect(() => {

  }, [pairs]);

  /*
  useEffect(() => {



    if (!availableGroups)
      load();
    //const groups = fetchGroups();
    //setGroups(groups);
  }, []);
  */
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
            value={group?.groupName ?? groupName}
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

          <div className="body">
            <div className="combo-field">
              <Label htmlFor="item-combo-input">
                Element
              </Label>
              <ComboBox
                options={StringColumnOptions}
                value={group?.itemName ?? elementColumn ?? "UserLabel"}
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
            </div>

            <div className="combo-field">
              <Label htmlFor="item-combo-input">
                Element quantity
              </Label>
              <ComboBox
                options={NumericalColumnOptions}
                value={group?.itemQuantity ?? elementQuantity}
                onChange={async (value) => {
                  setElementQuantity(value);
                  //groupLabel?.element.material = value;
                  //handleInputChange(event, value, setGroup);
                  //setMaterialColumn(value);
                  //await runExtraction(value);
                }}
                inputProps={{
                  id: "item-combo-input",
                  placeholder: "Element quantity",
                }}
              />
            </div>
          </div>
          <div className="pair-list">
            {pairs.map((pair) => (
              <DropdownTile
                stringColumnOptions={StringColumnOptions}
                numericalColumnOptions={NumericalColumnOptions}
                materialValue={pair.material ?? ""}
                quantityValue={pair.quantity ?? ""}
                onMaterialChange={(value) => {
                  //setMaterialColumn(value);
                  pair.material = value;
                }}
                onQuantityChange={(value) => {
                  //setMaterialColumn(value);
                  pair.quantity = value;
                }}
                actionGroup={
                  <div className="actions">
                    <DropdownMenu
                      disabled={isLoading}
                      menuItems={(close: () => void) => [
                        <MenuItem
                          key={0}
                          onClick={() => {
                            setSelectedPair(pair);
                            setShowDeleteModal(true);
                            close();
                          }}
                          icon={<SvgDelete />}
                        >
                          Remove
                        </MenuItem>,
                      ]}
                    >
                      <IconButton
                        styleType="borderless"
                      >
                        <SvgMore
                          style={{
                            width: "16px",
                            height: "16px",
                          }}
                        />
                      </IconButton>
                    </DropdownMenu>
                  </div>
                }
              />
            ))}
            <Button
              className="button"
              startIcon={<SvgAdd />}
              onClick={() => { addPair() }}
              styleType="high-visibility"
            >
              {"Add material"}
            </Button>
          </div>


        </Fieldset>
      </div>

      <DeleteModal
        entityName={selectedPair?.material + " - " + selectedPair?.quantity ?? ""}
        show={showDeleteModal}
        setShow={setShowDeleteModal}
        onDelete={async () => {
          setPairs(pairs.filter(x => x.material !== selectedPair?.material || x.quantity !== selectedPair?.quantity));
          /*
          if (selectedPair && group)
            selectorClient.deletePair(selector, group, pairs, selectedPair);
            */
        }}
        refresh={refresh}
      />


      <ActionPanel
        onSave={async () => {
          onSave();
          await goBack();
        }
        }
        onCancel={goBack}
        //isSavingDisabled={!groupName}
        isLoading={isLoading}
      />
    </>
  );
};

export default GroupAction;

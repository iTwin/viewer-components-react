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
import ActionPanel from "./ActionPanel";
import { IModelApp } from "@itwin/core-frontend";
import { Button, toaster, MenuItem, IconButton } from "@itwin/itwinui-react";
import { WidgetHeader } from "./utils";
import "./GroupAction.scss";
import { Selector, Group, Pair } from "./Selector"
import { ReportingClient } from "@itwin/insights-client";
import { DropdownTile } from "./DropdrownTile";
import DeleteModal from "./DeleteModal";
import useValidator, { NAME_REQUIREMENTS } from "./hooks/useValidator";

interface GroupActionProps {
  selector: Selector;
  group: Group | undefined;
  goBack: () => Promise<void>;
  setSelector: (sel: Selector) => void;
}

async function fetchMetadata(token: string, reportingClientApi: ReportingClient, reportId: string) {
  return (await reportingClientApi.getODataReportMetadata(token, reportId)).text();
}

const GroupAction = ({ selector, goBack, group, setSelector }: GroupActionProps) => {
  const [reportTable, setReportTable] = useState<string>(group?.groupName ?? "");
  const [label, setLabel] = useState<string>(group?.customName ?? "");
  const [element, setElement] = useState<string>(group?.itemName ?? "UserLabel");
  const [elementQuantity, setElementQuantity] = useState<string>(group?.itemQuantity ?? "");
  const [selectedPair, setSelectedPair] = useState<Pair>();

  // creating a copy of an array, so original isn't modified
  const [pairs, setPairs] = useState<Pair[]>(group?.pairs.map(x => { return { material: x.material, quantity: x.quantity } }) ?? []);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [validator, showValidationMessage] = useValidator();
  const [availableGroups, setGroups] = useState<string[]>();
  const [availableStringColumns, setStringColumns] = useState<string[]>([]);
  const [availableNumericalColumns, setNumericalColumns] = useState<string[]>([]);
  const reportingClientApi = useMemo(() => new ReportingClient(), []);

  const onSave = async () => {
    const selectedGroup: Group = {
      groupName: reportTable,
      customName: label,
      itemName: element,
      itemQuantity: elementQuantity,
      pairs: pairs,
    }

    if (group) {
      for (let i = 0; i < selector.groups.length; i++) {
        if (selector.groups[i].groupName === group.groupName) {
          selector.groups[i] = selectedGroup;
          break;
        }
      }
    }
    else {
      selector.groups.push(selectedGroup);
    }

    setSelector(selector);
  };

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
        }
      })
      .catch((err) => {
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
      });
  }

  const groupOptions = useMemo(() => {
    return availableGroups?.map((g) => ({
      label: g,
      value: g,
    })) ?? [];
  }, [availableGroups]);



  const StringColumnOptions = useMemo(() => {
    const options = availableStringColumns?.map((col) => ({
      label: col,
      value: col,
    })) ?? [];

    if (availableStringColumns.indexOf(element) == -1) {
      setElement("");
    }

    return options;
  }, [availableStringColumns]);

  const getStringColumnOptions = ((material: string | undefined) => {
    const options = StringColumnOptions
      .filter(x => pairs.filter(p => p.material === x.label).length === 0)
      .filter(x => x.label !== element);


    if (material)
      options.push({ label: material, value: material });
    return options;
  })


  const NumericalColumnOptions = useMemo(() => {
    const options = availableNumericalColumns?.map((col) => ({
      label: col,
      value: col,
    })) ?? [];

    if (availableNumericalColumns.indexOf(elementQuantity) == -1) {
      setElementQuantity("");
    }
    return options;
  }, [availableNumericalColumns]);

  const load = (async () => {
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
    const data = await reportingClientApi
      .getODataReport(token, selector.reportId);
    if (data) {
      const reportData = data;
      const groupItems = reportData.value.map(data =>
        data.name ?? ""
      );
      const filteredGroups: string[] = group ? [group.groupName] : [];
      for (const g of groupItems) {
        if (selector?.groups.filter(x => x.groupName === g).length == 0) {
          filteredGroups.push(g);
        }
      }

      if (!availableGroups)
        setGroups(filteredGroups);
    }
  })

  const refresh = useCallback(async () => {
    await load();
  }, []);

  const addPair = (() => {
    const pair: Pair = {
      material: undefined,
      quantity: undefined,
    };

    pairs.push(pair);
    refresh();
  })

  useEffect(() => {


    if (group) {
      setReportTable(group.groupName);
      setLabel(group.customName);
      setElement(group.itemName);
      setElementQuantity(group.itemQuantity);
      setPairs(group.pairs.map(x => { return { material: x.material, quantity: x.quantity } })); // creating a copy of array, so original isn't modified
      updateColumns(group.groupName);
    }
    else {
      setElement("UserLabel");
    }


    //updateColumns(groupName);

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
              const reportData = data;
              const groupItems = reportData.value.map(data =>
                data.name ?? ""
              );
              const filteredGroups: string[] = group ? [group.groupName] : [];
              for (const g of groupItems) {
                if (selector.groups.filter(x => x.groupName === g).length === 0) {
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

          <LabeledSelect
            label="Report table"
            id='reportTable'
            required
            options={groupOptions}
            value={reportTable}
            onChange={async (value) => {
              if (value !== reportTable) {
                setPairs([]);
                setLabel(value);
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
              validator.showMessageFor("label");
            }}
          />
          <LabeledInput
            id='label'
            name='label'
            label='Label'
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
            }}
          />
          <div className="body">
            <div className="combo-field">
              <LabeledSelect
                label="Element"
                id='element'
                required
                options={getStringColumnOptions(element)}
                value={element}
                onChange={async (value) => {
                  setElement(value);
                }}
                message={validator.message(
                  "element",
                  element,
                  NAME_REQUIREMENTS,
                )}
                status={
                  validator.message(
                    "element",
                    element,
                    NAME_REQUIREMENTS,
                  )
                    ? "negative"
                    : undefined
                }
                onBlur={() => {
                  validator.showMessageFor("element");
                }}
              />
            </div>
            <div className="combo-field">
              <LabeledSelect
                label="Element quantity"
                id='elementQuantity'
                required
                options={NumericalColumnOptions}
                value={elementQuantity}
                onChange={async (value) => {
                  setElementQuantity(value);
                  console.log(value);
                }}
                message={validator.message(
                  "elementQuantity",
                  elementQuantity,
                  NAME_REQUIREMENTS,
                )}
                status={
                  validator.message(
                    "elementQuantity",
                    elementQuantity,
                    NAME_REQUIREMENTS,
                  )
                    ? "negative"
                    : undefined
                }
                onBlur={() => {
                  validator.showMessageFor("elementQuantity");
                }}
              />
            </div>

          </div>
          <div className="pair-list">
            {pairs.map((pair) => (
              <DropdownTile
                stringColumnOptions={getStringColumnOptions(pair.material)}
                numericalColumnOptions={NumericalColumnOptions}
                materialValue={pair.material ?? ""}
                quantityValue={pair.quantity ?? ""}
                validator={validator}
                onMaterialChange={async (value) => {
                  const newPairs = pairs.map(x => { return { material: x.material, quantity: x.quantity } });
                  newPairs.forEach(p => {
                    if (p.material === pair.material)
                      p.material = value;
                  });

                  //pair.material = value;//setState
                  setPairs(newPairs);
                  //console.log(pairs);
                  //refresh();
                }}
                onQuantityChange={(value) => {

                  pair.quantity = value;

                }}
                actionGroup={
                  <div className="actions">
                    <DropdownMenu
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
              onClick={addPair}
              styleType="high-visibility"
            >
              {"Add material"}
            </Button>
          </div>
        </Fieldset>
      </div>

      <DeleteModal
        entityName={selectedPair?.material /*+ " - " + selectedPair?.quantity */ ?? ""}
        show={showDeleteModal}
        setShow={setShowDeleteModal}
        onDelete={async () => {
          setPairs(pairs.filter(x => x.material !== selectedPair?.material || x.quantity !== selectedPair?.quantity));
        }}
        refresh={refresh}
      />

      <ActionPanel
        onSave={async () => {
          /*
          var valid = true;
          pairs.forEach(pair => {
            if (availableStringColumns.indexOf(pair.material ?? "") === -1) {
              toaster.negative("Not all materials are selected")
              valid = false;
            }
          });
          */
          if (!validator.allValid()) {
            showValidationMessage(true);
            return;
          }

          onSave();
          await goBack();
        }
        }
        onCancel={goBack}
      />
    </>
  );
};

export default GroupAction;

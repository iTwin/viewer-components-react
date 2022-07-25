/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { SearchBox } from "@itwin/core-react";
import { IModelApp } from "@itwin/core-frontend";
import { GroupItem, useActiveIModelConnection } from "@itwin/appui-react";
import type { Report } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import { WidgetHeader, LoadingOverlay, EmptyMessage } from "./utils";
import { ODataItem } from "@itwin/insights-client";
import { ODataResponse } from "@itwin/insights-client";
//import { Group } from "@itwin/insights-client";
import { ReportSingle } from "@itwin/insights-client";
import ExportModal from "./ExportModal";
import { ECProperty } from "@itwin/insights-client";
import SelectorClient from "./selectorClient";
import GroupAction from "./GroupAction";
import { Selector, Group } from "./Selector"
import { GroupTile } from "./GroupTile";
import DeleteModal from "./DeleteModal";

import {
  clearEmphasizedElements,
  clearEmphasizedOverriddenElements,
  clearHiddenElements,
  clearOverriddenElements,
  emphasizeElements,
  getHiliteIds,
  hideElements,
  hideElementsById,
  overrideElements,
  zoomToElements,
} from "./viewerUtils";

import {
  SvgAdd,
  SvgDelete,
  SvgEdit,
  SvgList,
  SvgMore,
  SvgVisibilityHide,
  SvgVisibilityShow,
} from "@itwin/itwinui-icons-react";

import {
  Button,
  ButtonGroup,
  DropdownMenu,
  IconButton,
  MenuItem,
  ProgressRadial,
  Surface,
  toaster,
  ToggleSwitch,
} from "@itwin/itwinui-react";

import Items from "./Items";
import "./Reports.scss";


//type CreateTypeFromInterface<Interface> = {
//  [Property in keyof Interface]: Interface[Property];
//};

interface SelectorProps {
  selector: Selector;
  //templateId: string;
  //reportId: string;
  //reportName: string;
  goBack: () => Promise<void>;
}

//type groupItem = CreateTypeFromInterface<Group>;

enum GroupsView {
  GROUPS = "groups",
  ADD = "add",
  MODIFY = "modify"
}

/*


//type GroupItem = CreateTypeFromInterface<Group>;
//type Reporting = CreateTypeFromInterface<Report>;

//type odataItem = CreateTypeFromInterface<ODataItem>;




interface Prop {
  Name: string,
  Value: string,
}



type PropertyItem = CreateTypeFromInterface<ECProperty>


async function fetchResponse(token: string, reportingClientApi: ReportingClient, reportId: string) {
  return (await reportingClientApi.getODataReportMetadata(token, reportId)).text();
}

async function fetchMetadata(token: string, reportingClientApi: ReportingClient, reportId: string, ODataItem: ODataItem) {
  return reportingClientApi.getODataReportEntity(token, reportId, ODataItem);
}
*/


const GroupSelector = (props: SelectorProps) => {


  const selectorClient = new SelectorClient();

  //const reportingClientApi = useMemo(() => new ReportingClient(), []);
  //const [selectedGroup, setSelectedGroup] = useState<groupItem>();
  const [isLoading, setIsLoading] = useState<boolean>(true);

  //const [selector, setSelector] = useState<Selector>();
  //const [reportGroups, setGroups] = useState<groupItem[]>([]);


  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<Group>();

  const [groupsView, setGroupsView] = useState<GroupsView>(
    GroupsView.GROUPS
  );


  //const [properties, setProperties] = useState<PropertyItem[]>([]);
  //const [items, setItems] = useState<Report[]>([]);
  //const [buttonIsDisabled, disableButton] = useState<boolean>(true);
  //const [filteredItems, setFilteredItems] = useState<Report[]>(items);
  //const [selectedReport, setSelectedReport] = useState<Reporting>();

  //const [modalIsOpen, openModal] = useState(false);

  const groupColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "groupName",
            Header: "GroupName",
            accessor: "groupName",
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

  /*
    const propertyColumns = useMemo(
      () => [
        {
          Header: "Table",
          columns: [
            {
              id: "ecPropertyName",
              Header: "ecPropertyName",
              accessor: "ecPropertyName",
            },
            {
              id: "ecPropertyType",
              Header: "ecPropertyType",
              accessor: "ecPropertyType",
            },
          ],
        },
      ],
      []
    );

*/


  const onGroupRowClick = useMemo(
    () => (_: any, row: any) => {

    },
    []
  );

  const addGroup = () => {
    clearEmphasizedElements();
    setGroupsView(GroupsView.ADD);
  };



  const load = (() => {
    setIsLoading(true);

    //const selector = selectorClient.getSelector(props.templateId);
    //setSelector(selector);


    //setSelector

    /*
    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    if (!props.reportId)
      throw new Error(
        "Invalid report."
      );

    IModelApp.authorizationClient
      .getAccessToken()
      .then((token: string) => {
        reportingClientApi
          .getODataReport(token, props.reportId)
          .then(async (data) => {
            if (data) {


              const reportData = data ?? "";
              const groupItems = reportData.value.map(data => {
                return { groupName: data.name, description: data.url }
              });
              setGroups(groupItems);
            }
          })
          .catch((err) => {

            toaster.negative("You are not authorized to get metadata for this report. Please contact project administrator.");
            /* eslint-disable no-console */ /*
console.error(err);
});
})
.catch((err) => {
toaster.negative("You are not authorized to use this system.");
/* eslint-disable no-console */
    /*
    console.error(err);
  });
  */
    setIsLoading(false);
  })



  useEffect(() => {
    load();

  }, []);



  const refresh = useCallback(async () => {
    load();
  }, []);

  const resetView = async () => {
    clearOverriddenElements();
    clearEmphasizedElements();
  }





  switch (groupsView) {
    case GroupsView.ADD:
      return (
        <GroupAction
          selector={props.selector}
          group={undefined}
          //groupLabel={undefined}
          //selectorId={props.selector.id ?? ""}
          //selector={selector}
          goBack={async () => {
            setGroupsView(GroupsView.GROUPS);
            await refresh();
          }}
          resetView={resetView}
        />
      );
    /*
  case GroupView.MODIFYING:
    return selectedGroup ? (
      <GroupAction
        iModelId={iModelId}
        mappingId={mapping.id ?? ""}
        group={selectedGroup}
        goBack={async () => {
          setGroupsView(GroupsView.GROUPS);
          await refresh();
        }}
        resetView={resetView}
      />
    ) : null;
  case GroupView.PROPERTIES:
    return selectedGroup ? (
      <PropertyMenu
        iModelId={iModelId}
        mappingId={mapping.id ?? ""}
        group={selectedGroup}
        goBack={propertyMenuGoBack}
      />
    ) : null;
    */
    case GroupsView.MODIFY:
      return (
        <GroupAction
          group={props.selector.groups.filter(x => x.groupName == selectedGroup?.groupName)[0]}
          selector={props.selector}
          //selectorId={props.selector.id ?? ""}
          //reportId={props.reportId}
          //selector={selector ?? selectorClient.getSelector(props.reportId)}
          goBack={async () => {
            setGroupsView(GroupsView.GROUPS);
            await refresh();
          }}
          resetView={resetView}
        />
      );

    default:
      return (

        <>
          <WidgetHeader
            title={props.selector.templateName ?? ""}
            disabled={isLoading}
            returnFn={async () => {
              clearEmphasizedOverriddenElements();
              await props.goBack();
            }}
          />
          <Surface className="groups-container">
            <div className="toolbar">
              <Button
                styleType="high-visibility"
                onClick={addGroup}
              >
                {"Add Group"}
              </Button>
            </div>
            {isLoading ? (
              <LoadingOverlay />
            ) : props.selector.groups.length === 0 ? (
              <EmptyMessage message="No Groups available." />
            ) : (
              <div className="group-list">
                {
                  props.selector.groups
                    .map((g) => (
                      <GroupTile
                        title={g.groupName ?? ""}

                        actionGroup={

                          <div className="actions">

                            <DropdownMenu
                              menuItems={(close: () => void) => [
                                <MenuItem
                                  key={2}
                                  onClick={() => {
                                    setSelectedGroup(g);
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
                        onClickTitle={() => {
                          setSelectedGroup(g);
                          setGroupsView(GroupsView.MODIFY);
                          refresh();
                        }}
                      />
                    ))}
              </div>
            )}
          </Surface>
          <DeleteModal
            entityName={selectedGroup?.groupName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={() => {
              if (props.selector.id && selectedGroup && selectedGroup.groupName) {
                selectorClient.deleteGroup(
                  props.selector.id,
                  selectedGroup.groupName,
                );
              }
            }}
            refresh={refresh}
          />
        </>

        /*
        <>
          <WidgetHeader
            title={mapping.mappingName ?? ""}
            disabled={isLoading || isLoadingQuery}
            returnFn={async () => {
              clearEmphasizedOverriddenElements();
              await goBack();
            }}
          />
          <Surface className="groups-container">
            <div className="toolbar">
              <Button
                startIcon={
                  isLoadingQuery ? (
                    <ProgressRadial size="small" indeterminate />
                  ) : (
                    <SvgAdd />
                  )
                }
                styleType="high-visibility"
                disabled={isLoadingQuery}
                onClick={addGroup}
              >
                {isLoadingQuery ? "Loading Group(s)" : "Add Group"}
              </Button>
              <ButtonGroup className="toolbar-buttons">
                <ToggleSwitch
                  label="Color by Group"
                  labelPosition="left"
                  className="group-view-icon toggle"
                  disabled={isLoadingQuery}
                  checked={showGroupColor}
                  onChange={toggleGroupColor}
                ></ToggleSwitch>
                <IconButton
                  title="Show All"
                  onClick={showAll}
                  disabled={isLoadingQuery}
                  styleType="borderless"
                  className="group-view-icon"
                >
                  <SvgVisibilityShow />
                </IconButton>
                <IconButton
                  title="Hide All"
                  onClick={hideAll}
                  disabled={isLoadingQuery}
                  styleType="borderless"
                  className="group-view-icon"
                >
                  <SvgVisibilityHide />
                </IconButton>
              </ButtonGroup>
            </div>
            {isLoading ? (
              <LoadingOverlay />
            ) : groups.length === 0 ? (
              <EmptyMessage message="No Groups available." />
            ) : (
              <div className="group-list">
                {
                  groups
                    .sort((a, b) => a.groupName?.localeCompare(b.groupName ?? "") ?? 1)
                    .map((g) => (
                      <GroupTile
                        key={g.id}
                        title={g.groupName ? g.groupName : "Untitled"}
                        subText={g.description}
                        actionGroup={
                          <div className="actions">
                            {g.id && hiddenGroupsIds.includes(g.id) ? (
                              <IconButton
                                disabled={isLoadingQuery}
                                styleType="borderless"
                                className="group-view-icon"
                                onClick={async () => {
                                  await showGroup(g);
                                  setHiddenGroupsIds(
                                    hiddenGroupsIds.filter((id) => g.id !== id),
                                  );
                                }}
                              >
                                <SvgVisibilityHide />
                              </IconButton>
                            ) : (
                              <IconButton
                                disabled={isLoadingQuery}
                                styleType="borderless"
                                className="group-view-icon"
                                onClick={async () => {
                                  await hideGroups([g]);
                                  setHiddenGroupsIds(
                                    hiddenGroupsIds.concat(g.id ? [g.id] : []),
                                  );
                                }}
                              >
                                <SvgVisibilityShow />
                              </IconButton>
                            )}
                            <DropdownMenu
                              disabled={isLoadingQuery}
                              menuItems={(close: () => void) => [
                                <MenuItem
                                  key={0}
                                  onClick={async () => onModify(g)}
                                  icon={<SvgEdit />}
                                >
                                  Modify
                                </MenuItem>,
                                <MenuItem
                                  key={1}
                                  onClick={async () => openProperties(g)}
                                  icon={<SvgList />}
                                >
                                  Properties
                                </MenuItem>,
                                <MenuItem
                                  key={2}
                                  onClick={() => {
                                    setSelectedGroup(g);
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
                                disabled={isLoadingQuery}
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
                        onClickTitle={
                          isLoadingQuery ? undefined : async () => openProperties(g)
                        }
                      />
                    ))}
              </div>
            )}
          </Surface>
          <DeleteModal
            entityName={selectedGroup?.groupName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={async () => {
              const accessToken = await getAccessToken();
              await mappingClient.deleteGroup(
                accessToken,
                iModelId,
                mapping.id ?? "",
                selectedGroup?.id ?? "",
              );
            }}
            refresh={refresh}
          />
        </>
        */
        //<>opa</>
      );
  }
};



export default GroupSelector;

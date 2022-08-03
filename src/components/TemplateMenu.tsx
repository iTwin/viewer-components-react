/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Fieldset, LabeledInput, LabeledSelect, Small, ComboBox, SelectOption, Label } from "@itwin/itwinui-react";
import { SearchBox } from "@itwin/core-react";
import { IModelApp } from "@itwin/core-frontend";
import { GroupItem, useActiveIModelConnection } from "@itwin/appui-react";
import type { Report } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import { WidgetHeader, LoadingOverlay, EmptyMessage, handleSelectChange } from "./utils";
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
import { handleError, handleInputChange } from "./utils";
import ActionPanel from "./ActionPanel";
import TemplateActionPanel from "./TemplateActionPanel";
import ReportConfirmModal from "./ReportConfirmModal";

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
  selector?: Selector;
  //templateId: string;
  //reportId: string;
  //reportName: string;
  goBack: () => Promise<void>;
}

enum GroupsView {
  GROUPS = "groups",
  ADD = "add",
  MODIFY = "modify"
}




const TemplateMenu = ({ selector, goBack }: SelectorProps) => {
  const selectorClient = new SelectorClient();
  const projectId = useActiveIModelConnection()?.iTwinId as string;
  const reportingClientApi = useMemo(() => new ReportingClient(), []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showReportConfirmModal, setShowReportConfirmModal] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<Group>();
  const [selectedReport, setSelectedReport] = useState<string>();
  const [modalIsOpen, openModal] = useState(false);
  const [availableReports, setReports] = useState<Report[]>([]);


  const [childSelector, setChildSelector] = useState<Selector>(selector ?? {
    reportId: "",
    templateDescription: "",
    templateName: "",
    groups: []
  });

  //const [report, setReport] = useState<string>();

  /*
  const [values, setValues] = useState({
    name: selector?.templateName ?? "",
    description: selector?.templateDescription ?? "",
    reportId: selector?.reportId ?? "",
    //groups: selector?.groups ?? [],
    //id: selector?.id,
  });
  */
  const [groupsView, setGroupsView] = useState<GroupsView>(
    GroupsView.GROUPS
  );

  const onSave = async () => {

    /*
    const selector: Selector = {
      //id: values.id,
      templateName: values.name,
      templateDescription: values.description,
      reportId: values.reportId,
      //groups: values.groups,
    }
    */
    /*
     if (childSelector) {
       childSelector.reportId = values.reportId;
       childSelector.templateDescription = values.description;
       childSelector.templateName = values.name;
     }
     else {
       setChildSelector({
         reportId: values.reportId,
         templateDescription: values.description,
         templateName: values.name,
         groups: []
       })
     }*/

    //childSelector.reportId = values.reportId;
    //childSelector.templateDescription = values.description;
    //childSelector.templateName = values.name;

    selectorClient.createUpdateSelector(childSelector!);
    /*
    if (selector.id)
      selectorClient.updateSelector(selector);
    else
      selectorClient.createSelector(selector);
    */

    goBack();
  };

  useEffect(() => {

    if (!IModelApp.authorizationClient)
      throw new Error(
        "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
      );
    IModelApp.authorizationClient
      .getAccessToken()
      .then((token: string) => {
        reportingClientApi
          .getReports(token, projectId)
          .then((data) => {
            if (data) {
              const fetchedReports = data ?? [];
              //const reports = fetchedReports.map(x => x.displayName ?? "");
              setReports(fetchedReports);
              //setFilteredReports(fetchedReports);
              setIsLoading(false);
            }
          })
          .catch((err) => {
            setIsLoading(false);
            toaster.negative("You are not authorized to get reports for this projects. Please contact project administrator.");
            /* eslint-disable no-console */
            console.error(err);
          });
      })
      .catch((err) => {
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
      });
    //load();
  }, []);

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

  const addGroup = () => {
    clearEmphasizedElements();
    setGroupsView(GroupsView.ADD);
  };

  const ReportOptions = useMemo(() => {
    const newGroupOptions: SelectOption<string>[] = [];


    for (const name of availableReports) {
      newGroupOptions.push({
        label: name.displayName ?? "",
        value: name.id ?? "",
        key: name.id,
      });
    }
    return newGroupOptions;
  }, [availableReports]);



  const load = (() => {
    setIsLoading(true);
    setIsLoading(false);
  })

  const authenticateClientCredentials = ((): Promise<string> => {
    if (!window) {
      //return "";
    }

    //const uri = `https://${window.location.hostname}/signin-oauth/credentials/${authorizationServer.id}`;
    const uri = `https://buildingtransparency.org/auth/login`;

    return new Promise<string>((resolve) => {
      const authWindow = window.open(uri, '_blank', 'width=400,height=500');
      console.log(authWindow);

      if (authWindow) {
        authWindow.onclose = (() => {
          console.log(authWindow);
        })
      }
      //authWindow?.

      const loadWindow = async (event: any) => {
        console.log(event);
      };

      /*
      const receiveMessage = async (event: MessageEvent) => {
        if (!event.data['accessToken']) {
          return;
        }

        const accessToken = event.data['accessToken'];
        const accessTokenType = event.data['accessTokenType'];
        resolve(`${accessTokenType} ${accessToken}`);
        if (authWindow && !authWindow.closed) {
          authWindow.close();
        }
      };
      */




      window?.addEventListener('message', loadWindow, false);
    });
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
          selector={childSelector}
          group={undefined}
          goBack={async () => {
            setGroupsView(GroupsView.GROUPS);
            await refresh();
          }}
          resetView={resetView}
          setSelector={setChildSelector}
        />
      );
    case GroupsView.MODIFY:
      return (
        <GroupAction
          group={childSelector.groups.filter(x => x.groupName == selectedGroup?.groupName)[0]}
          selector={childSelector}
          goBack={async () => {
            setGroupsView(GroupsView.GROUPS);
            await refresh();
          }}
          resetView={resetView}
          setSelector={setChildSelector}
        />
      );
    default:
      return (
        <>
          <WidgetHeader
            title={childSelector.templateName ?? "Create template"}
            disabled={isLoading}
            returnFn={async () => {
              clearEmphasizedOverriddenElements();
              await goBack();
            }}
          />
          <TemplateActionPanel
            onSave={onSave}
            onCancel={goBack}
            onExport={async () => {

              const res = await authenticateClientCredentials();
              console.log(res);
              //openModal(true)
            }}
            isSavingDisabled={!childSelector.templateName || !childSelector.reportId}
            isLoading={isLoading}
          />
          <div className='details-form-container'>
            <Fieldset legend='Template Details' className='details-form'>
              <Small className='field-legend'>
                Asterisk * indicates mandatory fields.
              </Small>
              <LabeledInput
                id='templateName'
                name='templateName'
                label='Template name'
                value={childSelector.templateName}
                required
                onChange={(event) => {
                  handleInputChange(event, childSelector, setChildSelector);
                }}

              />
              <LabeledInput
                id='templateDescription'
                name='templateDescription'
                label='Template description'
                value={childSelector.templateDescription}
                onChange={(event) => {
                  handleInputChange(event, childSelector, setChildSelector);
                }}
              />

              <LabeledSelect
                label="Report"
                id='reportId'
                required
                options={ReportOptions}
                value={childSelector.reportId}
                onChange={async (value) => {

                  if (selector && value !== selector.reportId) {
                    setSelectedReport(value);
                    setShowReportConfirmModal(true);
                  }
                  else {
                    handleSelectChange(value, "reportId", childSelector, setChildSelector);
                  }
                }}
              />


              <Surface className="groups-container">
                <div className="group-list">
                  {
                    childSelector.groups
                      .map((g) => (
                        <GroupTile
                          title={g.customName === "" ? g.groupName : g.customName}
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
                  <Button
                    styleType="high-visibility"
                    onClick={addGroup}
                  >
                    {"Add Label"}
                  </Button>
                </div>
              </Surface>
            </Fieldset>
          </div>


          <ExportModal
            isOpen={modalIsOpen}
            close={() => openModal(false)}
            templateId={childSelector.id}
          />

          <DeleteModal
            entityName={selectedGroup?.groupName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={() => {
              childSelector.groups = childSelector.groups.filter(x => x.groupName != selectedGroup?.groupName);


              /*
              if (selector.id && selectedGroup && selectedGroup.groupName) {
                selectorClient.deleteGroup(
                  selector.id,
                  selectedGroup.groupName,
                );
                */
            }
            }
            refresh={refresh}
          />

          <ReportConfirmModal
            entityName={selectedGroup?.groupName ?? ""}
            show={showReportConfirmModal}
            setShow={setShowReportConfirmModal}
            onDelete={() => {
              if (selectedReport) {
                childSelector.groups = [];
                handleSelectChange(selectedReport, "reportId", childSelector, setChildSelector);
              }
              //childSelector.groups = childSelector.groups.filter(x => x.groupName != selectedGroup?.groupName);

            }
            }
            refresh={refresh}
          />
        </>
      );
  }
};



export default TemplateMenu;

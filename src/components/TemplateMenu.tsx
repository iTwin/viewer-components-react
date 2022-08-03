/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useMemo, useState, useCallback } from "react";
import { Fieldset, LabeledInput, LabeledSelect, Small, SelectOption } from "@itwin/itwinui-react";
import { IModelApp } from "@itwin/core-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import type { Report } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import { WidgetHeader, handleSelectChange } from "./utils";
import ExportModal from "./ExportModal";
import SelectorClient from "./selectorClient";
import GroupAction from "./GroupAction";
import { Selector, Group } from "./Selector"
import { GroupTile } from "./GroupTile";
import DeleteModal from "./DeleteModal";
import { handleInputChange } from "./utils";
import TemplateActionPanel from "./TemplateActionPanel";
import ReportConfirmModal from "./ReportConfirmModal";

import {
  clearEmphasizedElements,
  clearEmphasizedOverriddenElements,
} from "./viewerUtils";

import {
  SvgDelete,
  SvgMore,
} from "@itwin/itwinui-icons-react";

import {
  Button,
  DropdownMenu,
  IconButton,
  MenuItem,
  Surface,
  toaster,
} from "@itwin/itwinui-react";
import "./Reports.scss";

interface SelectorProps {
  selector?: Selector;
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

  const [groupsView, setGroupsView] = useState<GroupsView>(
    GroupsView.GROUPS
  );

  const onSave = async () => {
    selectorClient.createUpdateSelector(childSelector);
    goBack();
  };

  useEffect(() => {
    setIsLoading(true);

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
              const fetchedReports = data;
              setReports(fetchedReports);
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
  }, []);

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

    }

    const uri = `https://buildingtransparency.org/auth/login`;

    return new Promise<string>((resolve) => {
      const authWindow = window.open(uri, '_blank', 'width=400,height=500');
      console.log(authWindow);

      if (authWindow) {
        authWindow.onclose = (() => {
          console.log(authWindow);
        })
      }
      const loadWindow = async (event: any) => {
        console.log(event);
      };
      window?.addEventListener('message', loadWindow, false);
    });
  })

  useEffect(() => {
    load();
  }, []);

  const refresh = useCallback(async () => {
    load();
  }, []);

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
          setSelector={setChildSelector}
        />
      );
    case GroupsView.MODIFY:
      return (
        <GroupAction
          group={childSelector.groups.filter(x => x.groupName === selectedGroup?.groupName)[0]}
          selector={childSelector}
          goBack={async () => {
            setGroupsView(GroupsView.GROUPS);
            await refresh();
          }}
          setSelector={setChildSelector}
        />
      );
    default:
      return (
        <>
          <WidgetHeader
            title={childSelector.templateName === "" ? "Create template" : childSelector.templateName}
            disabled={isLoading}
            returnFn={async () => {
              clearEmphasizedOverriddenElements();
              await goBack();
            }}
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
                    Add Label
                  </Button>
                </div>
              </Surface>
            </Fieldset>
          </div>
          <TemplateActionPanel
            onSave={onSave}
            onCancel={goBack}
            onExport={async () => {
              //const res = await authenticateClientCredentials();
              //console.log(res);
            }}
            isSavingDisabled={!childSelector.templateName || !childSelector.reportId}
            isLoading={isLoading}
          />

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
            }}
            refresh={refresh}
          />

          <ReportConfirmModal
            show={showReportConfirmModal}
            setShow={setShowReportConfirmModal}
            onConfirm={() => {
              if (selectedReport) {
                childSelector.groups = [];
                handleSelectChange(selectedReport, "reportId", childSelector, setChildSelector);
              }
            }}
            refresh={refresh}
          />
        </>
      );
  }
};



export default TemplateMenu;

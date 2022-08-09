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
import TemplateClient from "./templateClient";
import LabelAction from "./LabelAction";
import { Template, Label } from "./Template"
import { LabelTile } from "./LabelTile";
import DeleteModal from "./DeleteModal";
import { handleInputChange } from "./utils";
import TemplateActionPanel from "./TemplateActionPanel";
import ReportConfirmModal from "./ReportConfirmModal";

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
import "./TemplateMenu.scss";
import React from "react";

interface TemplateProps {
  template?: Template;
  goBack: () => Promise<void>;
}

enum LabelView {
  LABELS = "labels",
  ADD = "add",
  MODIFY = "modify"
}

const TemplateMenu = ({ template, goBack }: TemplateProps) => {
  const templateClient = new TemplateClient();
  const projectId = useActiveIModelConnection()?.iTwinId as string;
  //const reportingClientApi = useMemo(() => new ReportingClient, []);
  const reportingClientApi = useMemo(() => new ReportingClient(), []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showReportConfirmModal, setShowReportConfirmModal] = useState<boolean>(false);
  const [selectedLabel, setSelectedLabel] = useState<Label>();
  const [selectedReport, setSelectedReport] = useState<string>();
  const [modalIsOpen, openModal] = useState(false);
  const [availableReports, setReports] = useState<Report[]>([]);
  const [childTemplate, setChildTemplate] = useState<Template>(template ?? {
    reportId: "",
    templateDescription: "",
    templateName: "",
    labels: []
  });

  const [labelsView, setLabelsView] = useState<LabelView>(
    LabelView.LABELS
  );

  const onSave = async () => {
    templateClient.createUpdateTemplate(childTemplate);
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
            toaster.negative("You are not authorized to get reports for this projects. Please contact project administrator." + err + " " + projectId);
            /* eslint-disable no-console */
            console.error(err);
          });
      })
      .catch((err) => {
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
      });
  }, [projectId, reportingClientApi]);

  const addLabel = () => {
    setLabelsView(LabelView.ADD);
  };

  const ReportOptions = useMemo(() => {
    const newReportOptions: SelectOption<string>[] = [];

    for (const name of availableReports) {
      newReportOptions.push({
        label: name.displayName ?? "",
        value: name.id ?? "",
        key: name.id,
      });
    }
    return newReportOptions;
  }, [availableReports]);

  const load = (() => {
    setIsLoading(true);
    setIsLoading(false);
  })

  useEffect(() => {
    load();
  }, []);

  const refresh = useCallback(async () => {
    load();
  }, []);

  switch (labelsView) {
    case LabelView.ADD:
      return (
        <LabelAction
          template={childTemplate}
          label={undefined}
          goBack={async () => {
            setLabelsView(LabelView.LABELS);
            await refresh();
          }}
          setTemplate={setChildTemplate}
        />
      );
    case LabelView.MODIFY:
      return (
        <LabelAction
          label={childTemplate.labels.filter(x => x.reportTable === selectedLabel?.reportTable)[0]}
          template={childTemplate}
          goBack={async () => {
            setLabelsView(LabelView.LABELS);
            await refresh();
          }}
          setTemplate={setChildTemplate}
        />
      );
    default:
      return (
        <>
          <WidgetHeader
            title={childTemplate.templateName === "" ? "Create template" : childTemplate.templateName}
            disabled={isLoading}
            returnFn={async () => {
              await goBack();
            }}
          />
          <div className='template-details-container'>
            <Fieldset legend='Template Details' className='template-details'>
              <Small className='field-legend'>
                Asterisk * indicates mandatory fields.
              </Small>
              <LabeledInput
                id='templateName'
                name='templateName'
                label='Template name'
                value={childTemplate.templateName}
                required
                onChange={(event) => {
                  handleInputChange(event, childTemplate, setChildTemplate);
                }}

              />
              <LabeledInput
                id='templateDescription'
                name='templateDescription'
                label='Template description'
                value={childTemplate.templateDescription}
                onChange={(event) => {
                  handleInputChange(event, childTemplate, setChildTemplate);
                }}
              />

              <LabeledSelect
                label="Report"
                id='reportId'
                required
                options={ReportOptions}
                value={childTemplate.reportId}
                placeholder="Select report"
                onChange={async (value) => {

                  if (template && value !== template.reportId) {
                    setSelectedReport(value);
                    setShowReportConfirmModal(true);
                  }
                  else {
                    handleSelectChange(value, "reportId", childTemplate, setChildTemplate);
                  }
                }}
              />

              <Surface className="labels-container">
                <div className="labels-list">
                  {
                    childTemplate.labels
                      .map((g) => (
                        <LabelTile
                          key={g.reportTable}
                          title={g.customName === "" ? g.reportTable : g.customName}
                          actionGroup={
                            <div className="actions">
                              <DropdownMenu
                                menuItems={(close: () => void) => [
                                  <MenuItem
                                    key={2}
                                    onClick={() => {
                                      setSelectedLabel(g);
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
                            setSelectedLabel(g);
                            setLabelsView(LabelView.MODIFY);
                            refresh();
                          }}
                        />
                      ))}
                  <Button
                    styleType="high-visibility"
                    onClick={addLabel}
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
            isSavingDisabled={!childTemplate.templateName || !childTemplate.reportId}
            isLoading={isLoading}
          />

          <ExportModal
            isOpen={modalIsOpen}
            close={() => openModal(false)}
            templateId={childTemplate.id}
          />

          <DeleteModal
            entityName={selectedLabel?.customName === "" ? selectedLabel.reportTable : selectedLabel?.customName ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={() => {
              childTemplate.labels = childTemplate.labels.filter(x => x.reportTable !== selectedLabel?.reportTable);
            }}
            refresh={refresh}
          />

          <ReportConfirmModal
            show={showReportConfirmModal}
            setShow={setShowReportConfirmModal}
            onConfirm={() => {
              if (selectedReport) {
                childTemplate.labels = [];
                handleSelectChange(selectedReport, "reportId", childTemplate, setChildTemplate);
              }
            }}
            refresh={refresh}
          />
        </>
      );
  }
};



export default TemplateMenu;

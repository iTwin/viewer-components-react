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
import TemplateClient from "./TemplateClient";
import LabelAction from "./LabelAction";
import { Configuration, Label as EC3Label } from "./Template"
import { LabelTile } from "./LabelTile";
import DeleteModal from "./DeleteModal";
import { handleInputChange } from "./utils";
import TemplateActionPanel from "./TemplateActionPanel";
import ReportConfirmModal from "./ReportConfirmModal";
import { EC3ConfigurationClient } from "./api/EC3ConfigurationClient";
import {
  ComboBox,
  Label
} from "@itwin/itwinui-react";

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
import { EC3TokenCache } from "./EC3/EC3TokenCache";
import { EC3Config } from "./EC3/EC3Config";

interface TemplateProps {
  template?: Configuration;
  goBack: () => Promise<void>;
  config: EC3Config;
}

enum LabelView {
  LABELS = "labels",
  ADD = "add",
  MODIFY = "modify"
}

const TemplateMenu = ({ template, goBack, config }: TemplateProps) => {
  const projectId = useActiveIModelConnection()?.iTwinId as string;
  const reportingClientApi = useMemo(() => new ReportingClient(), []);
  const [token, setToken] = useState<EC3TokenCache>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showReportConfirmModal, setShowReportConfirmModal] = useState<boolean>(false);
  const [selectedLabel, setSelectedLabel] = useState<EC3Label>();
  const [selectedReport, setSelectedReport] = useState<string>();
  const [modalIsOpen, openModal] = useState(false);
  const [availableReports, setReports] = useState<Report[]>([]);
  const configurationClient = new EC3ConfigurationClient();
  const [childTemplate, setChildTemplate] = useState<Configuration>({
    reportId: "",
    description: "",
    displayName: "",
    labels: []
  });

  const [labelsView, setLabelsView] = useState<LabelView>(
    LabelView.LABELS
  );

  const onSave = async () => {
    var response;
    if (childTemplate.id)
      response = await configurationClient.updateConfiguration(childTemplate);
    else
      response = await configurationClient.createConfiguration(childTemplate);

    if (!response.ok) {
      toaster.negative("Saving failed");
      console.log(response.statusText);
    }
    else {
      toaster.positive("Saved successfully!");
      goBack();
    }
  };

  const validateSignin = useCallback(() => {
    return token?.token && token?.exp > Date.now();
  }, [token]);

  useEffect(() => {
    setIsLoading(true);

    const fetchReports = async () => {
      if (template) {
        const config = await configurationClient.getConfiguration(template.id!);
        const configuration = config.configuration;
        const reportId = configuration._links.report.href.split("/reports/")[1];
        configuration.reportId = reportId;
        setChildTemplate(configuration);
      }

      if (!IModelApp.authorizationClient)
        throw new Error(
          "AuthorizationClient is not defined. Most likely IModelApp.startup was not called yet."
        );

      try {
        const accessToken = await IModelApp.authorizationClient.getAccessToken();
        const data = await reportingClientApi.getReports(accessToken, projectId);
        if (data) {
          const fetchedReports = data.sort((a, b) => a.displayName?.localeCompare(b.displayName ?? "") ?? 0);
          setReports(fetchedReports);
          setIsLoading(false);
        }
      }
      catch (err) {
        setIsLoading(false);
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
      }
    }
    void fetchReports();
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

  switch (labelsView) {
    case LabelView.ADD:
      return (
        <LabelAction
          template={childTemplate}
          label={undefined}
          goBack={async () => {
            setLabelsView(LabelView.LABELS);
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
          }}
          setTemplate={setChildTemplate}
        />
      );
    default:
      return (
        <>
          <WidgetHeader
            title={childTemplate.displayName === "" ? "Create template" : childTemplate.displayName}
            disabled={isLoading}
            returnFn={async () => {
              await goBack();
            }}
          />
          <div className='ec3-template-details-container' data-testId="ec3-templateDetails">
            <Fieldset legend='Template Details' className='ec3-template-details'>
              <Small className='ec3-template-field-legend'>
                Asterisk * indicates mandatory fields.
              </Small>
              <LabeledInput
                id='templateName'
                name='displayName'
                label='Template name'
                value={childTemplate.displayName}
                required
                onChange={(event) => {
                  handleInputChange(event, childTemplate, setChildTemplate);
                }}

              />
              <LabeledInput
                id='templateDescription'
                name='description'
                label='Template description'
                value={childTemplate.description}
                onChange={(event) => {
                  handleInputChange(event, childTemplate, setChildTemplate);
                }}
              />

              <div className="report-select-container">
                <div className="report-select-combo-box">
                  <Label htmlFor="combo-input" required={true}>
                    Report
                  </Label>

                  <ComboBox
                    options={ReportOptions}
                    value={childTemplate.reportId}
                    onChange={async (value) => {
                      if (template && value !== template.reportId) {
                        setSelectedReport(value);
                        setShowReportConfirmModal(true);
                      }
                      else {
                        handleSelectChange(value, "reportId", childTemplate, setChildTemplate);
                      }
                    }}
                    inputProps={{
                      id: "combo-input",
                      placeholder: "Select report"
                    }}
                  />
                </div>
              </div>
            </Fieldset>

            <Fieldset legend='Labels' className='ec3-template-details'>
              <Surface className="ec3-labels-container">
                <Button
                  styleType="default"
                  onClick={addLabel}
                  disabled={!childTemplate.reportId}
                >
                  Add Label
                </Button>
                <div className="ec3-labels-list">
                  {
                    childTemplate.labels
                      .map((g) => (
                        <LabelTile
                          key={g.reportTable}
                          title={g.name === "" ? g.reportTable : g.name}
                          onDelete={() => {
                            setSelectedLabel(g);
                            setShowDeleteModal(true);
                            close();
                          }}
                          onClickTitle={() => {
                            setSelectedLabel(g);
                            setLabelsView(LabelView.MODIFY);
                          }}
                        />
                      ))}
                </div>
              </Surface>
            </Fieldset>
          </div>
          <TemplateActionPanel
            onSave={onSave}
            onCancel={goBack}
            onExport={async () => {
              if (!validateSignin()) {
                const url = `${config.EC3_URI}oauth2/authorize?client_id=${config.CLIENT_ID}&redirect_uri=${config.REDIRECT_URI}&response_type=code&scope=${config.SCOPE}`;
                const authWindow = window.open(url, '_blank', 'toolbar=0,location=0,menubar=0,width=800,height=700');

                const receiveMessage = (event: MessageEvent<EC3TokenCache>) => {
                  authWindow?.close();
                  setToken(event.data);
                  openModal(true);
                };

                window.addEventListener('message', receiveMessage, false);
              } else {
                openModal(true);
              }
            }}
            isSavingDisabled={!childTemplate.displayName || !childTemplate.reportId}
            isLoading={isLoading}
          />

          <ExportModal
            projectName={childTemplate.displayName}
            isOpen={modalIsOpen}
            close={() => openModal(false)}
            templateId={childTemplate.id}
            token={token?.token}
          />

          <DeleteModal
            entityName={selectedLabel?.name === "" ? selectedLabel.reportTable : selectedLabel?.name ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={() => {
              childTemplate.labels = childTemplate.labels.filter(x => x.reportTable !== selectedLabel?.reportTable);
            }}
            refresh={async () => { }}
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
            refresh={async () => { }}
          />
        </>
      );
  }
};



export default TemplateMenu;

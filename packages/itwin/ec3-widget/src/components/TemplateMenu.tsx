/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useMemo, useState } from "react";
import type { SelectOption } from "@itwin/itwinui-react";
import { Fieldset, LabeledInput, Small } from "@itwin/itwinui-react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import type { Report } from "@itwin/insights-client";
import { handleSelectChange, WidgetHeader } from "./utils";
import LabelAction from "./LabelAction";
import type { Configuration, Label as EC3Label } from "./Template";
import { convertConfigurationCreate, convertConfigurationUpdate } from "./Template";
import { LabelTile } from "./LabelTile";
import DeleteModal from "./DeleteModal";
import { handleInputChange } from "./utils";
import TemplateActionPanel from "./TemplateActionPanel";
import ReportConfirmModal from "./ReportConfirmModal";
import {
  ComboBox,
  Label,
} from "@itwin/itwinui-react";

import {
  Button,
  Surface,
  toaster,
} from "@itwin/itwinui-react";
import "./TemplateMenu.scss";
import React from "react";
import { useReportsClient } from "./api/context/ReportsClientContext";
import { useEC3ConfigurationsClient } from "./api/context/EC3ConfigurationsClientContext";
import { useAccessTokenFn } from "./api/context/ApiConfigContext";

interface TemplateProps {
  template?: Configuration;
  goBack: () => Promise<void>;
}

enum LabelView {
  LABELS = "labels",
  ADD = "add",
  MODIFY = "modify"
}

const TemplateMenu = ({ template, goBack }: TemplateProps) => {
  const getAccessToken = useAccessTokenFn();
  const projectId = useActiveIModelConnection()?.iTwinId as string;
  const reportingClientApi = useReportsClient();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showReportConfirmModal, setShowReportConfirmModal] = useState<boolean>(false);
  const [selectedLabel, setSelectedLabel] = useState<EC3Label>();
  const [selectedReport, setSelectedReport] = useState<string>();
  const [availableReports, setReports] = useState<Report[]>([]);
  const configurationsClient = useEC3ConfigurationsClient();
  const [childTemplate, setChildTemplate] = useState<Configuration>({
    reportId: undefined,
    description: "",
    displayName: "",
    labels: [],
  });

  const [labelsView, setLabelsView] = useState<LabelView>(
    LabelView.LABELS
  );

  const onSave = async () => {
    try {
      const token = await getAccessToken();
      if (childTemplate.id) {
        await configurationsClient.updateConfiguration(token, childTemplate.id, convertConfigurationUpdate(childTemplate));
      } else {
        await configurationsClient.createConfiguration(token, convertConfigurationCreate(childTemplate));
      }

      toaster.positive("Saved successfully!");
      void goBack();
    } catch (e) {
      toaster.negative("Saving failed");
      // eslint-disable-next-line
      console.log(e);
    }
  };

  useEffect(() => {
    setIsLoading(true);

    const fetchReports = async () => {
      if (template) {
        const token = await getAccessToken();
        const configuration = await configurationsClient.getConfiguration(token, template.id!);
        const reportId = configuration._links.report.href.split("/reports/")[1];
        const childConfig: Configuration = {
          displayName: configuration.displayName,
          description: configuration.description ?? "",
          reportId,
          id: configuration.id,
          labels: configuration.labels,
        };
        setChildTemplate(childConfig);
      }

      try {
        const accessToken = await getAccessToken();
        const data = await reportingClientApi.getReports(accessToken, projectId);
        if (data) {
          const fetchedReports = data.sort((a, b) => a.displayName?.localeCompare(b.displayName ?? "") ?? 0);
          setReports(fetchedReports);
          setIsLoading(false);
        }
      } catch (err) {
        setIsLoading(false);
        toaster.negative("You are not authorized to use this system.");
        /* eslint-disable no-console */
        console.error(err);
      }
    };
    void fetchReports();
  }, [projectId, template, reportingClientApi, configurationsClient, getAccessToken]);

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
          label={childTemplate.labels.filter((x) => x.reportTable === selectedLabel?.reportTable)[0]}
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
          <div className='ec3w-template-details-container' data-testId="ec3-templateDetails">
            <Fieldset legend='Template Details' className='ec3w-template-details'>
              <Small className='ec3w-template-field-legend'>
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

              {!isLoading && !childTemplate.id && <div className="ec3w-report-select-container">
                <div className="ec3w-report-select-combo-box">
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
                      } else {
                        handleSelectChange(value, "reportId", childTemplate, setChildTemplate);
                      }
                    }}
                    inputProps={{
                      id: "combo-input",
                      placeholder: "Select report",
                    }}
                  />
                </div>
              </div>}
            </Fieldset>

            <Fieldset legend='Labels' className='ec3w-template-details'>
              <Surface className="ec3w-labels-container">
                <Button
                  styleType="default"
                  onClick={addLabel}
                  disabled={!childTemplate.reportId}
                >
                  Add Label
                </Button>
                <div className="ec3w-labels-list">
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
            isSavingDisabled={!childTemplate.displayName || !childTemplate.reportId}
            isLoading={isLoading}
          />
          <DeleteModal
            entityName={selectedLabel?.name === "" ? selectedLabel.reportTable : selectedLabel?.name ?? ""}
            show={showDeleteModal}
            setShow={setShowDeleteModal}
            onDelete={async () => {
              childTemplate.labels = childTemplate.labels.filter((x) => x.reportTable !== selectedLabel?.reportTable);
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

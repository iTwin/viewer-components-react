/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useEffect, useMemo, useState } from "react";
import type { SelectOption } from "@itwin/itwinui-react";
import { Select } from "@itwin/itwinui-react";
import { Fieldset, LabeledInput } from "@itwin/itwinui-react";
import type { EC3ConfigurationLabel, Report } from "@itwin/insights-client";
import { handleSelectChange } from "./utils";
import type { Configuration } from "./EC3/Template";
import { LabelTile } from "./LabelTile";
import { handleInputChange } from "./utils";
import { ComboBox, Label } from "@itwin/itwinui-react";

import { Button, Text, toaster } from "@itwin/itwinui-react";
import "./TemplateMenu.scss";
import React from "react";
import { SvgAdd } from "@itwin/itwinui-icons-react";
import { useApiContext } from "./api/APIContext";
import { TemplateActionPanel } from "./TemplateActionPanel";
import { DeleteModal } from "./DeleteModal";
import { ReportConfirmModal } from "./ReportConfirmModal";
import { LabelActionModal } from "./LabelActionModal";
import { RequiredFieldsNotice } from "./RequiredFieldsNotice";

/**
 * Props for {@link TemplateMenu}
 * @beta
 */
export interface TemplateMenuProps {
  template?: Configuration;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
}

/**
 * EC3 Template menu
 * @beta
 */
export const TemplateMenu = ({ template, onSaveSuccess, onClickCancel }: TemplateMenuProps) => {
  const {
    config: { getAccessToken, iTwinId: projectId },
  } = useApiContext();
  const reportsClient = useApiContext().reportsClient;
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showReportConfirmModal, setShowReportConfirmModal] = useState<boolean>(false);
  const [selectedLabel, setSelectedLabel] = useState<EC3ConfigurationLabel | undefined>();
  const [previouslySelectedReport, setPreviouslySelectedReport] = useState<string>();
  const [availableReports, setReports] = useState<Report[]>([]);
  const configurationsClient = useApiContext().ec3ConfigurationsClient;
  const [childTemplate, setChildTemplate] = useState<Configuration>({
    reportId: undefined,
    description: "",
    displayName: "",
    labels: [],
  });
  const [showLabelActionModal, setShowLabelActionModal] = useState<boolean>(false);

  const onSave = async () => {
    try {
      const token = await getAccessToken();
      if (childTemplate.id) {
        await configurationsClient.updateConfiguration(token, childTemplate.id, childTemplate);
      } else if (childTemplate.reportId) {
        await configurationsClient.createConfiguration(token, {
          ...childTemplate,
          reportId: childTemplate.reportId,
        });
      }

      toaster.positive("Saved successfully!");
      onSaveSuccess();
    } catch (e) {
      toaster.negative("Saving failed");
      // eslint-disable-next-line no-console
      console.error(e);
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
        const data = await reportsClient.getReports(accessToken, projectId);
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
  }, [projectId, template, reportsClient, configurationsClient, getAccessToken]);

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

  return (
    <>
      <div className="ec3w-template-details-container" data-testid="ec3-template-details">
        <Fieldset legend="Template Details" className="ec3w-template-details">
          <RequiredFieldsNotice />
          <LabeledInput
            id="templateName"
            data-testid="ec3-template-name-input"
            name="displayName"
            label="EC3 Project Template Name"
            value={childTemplate.displayName}
            required
            onChange={(event) => {
              handleInputChange(event, childTemplate, setChildTemplate);
            }}
          />
          <LabeledInput
            id="templateDescription"
            data-testid="ec3-template-description-input"
            name="description"
            label="Template description"
            value={childTemplate.description}
            onChange={(event) => {
              handleInputChange(event, childTemplate, setChildTemplate);
            }}
          />

          <div className="ec3w-report-select-container">
            <div className="ec3w-report-select-combo-box">
              <Label htmlFor="combo-input" required={true}>
                Report
              </Label>
              {!template ? (
                <ComboBox
                  data-testid="ec3-enabled-selection"
                  options={ReportOptions}
                  value={childTemplate.reportId}
                  onChange={async (value) => {
                    if (childTemplate.labels.length > 0 && value !== childTemplate.reportId) {
                      setPreviouslySelectedReport(childTemplate.reportId);
                      setShowReportConfirmModal(true);
                    }
                    handleSelectChange(value, "reportId", childTemplate, setChildTemplate);
                  }}
                  inputProps={{
                    id: "combo-input",
                    placeholder: "Select report",
                  }}
                />
              ) : (
                <Select data-testid="ec3-disabled-selection" options={ReportOptions} value={childTemplate.reportId} disabled={true} />
              )}
            </div>
          </div>
        </Fieldset>
        <Fieldset legend="Assemblies" className="ec3w-template-details">
          <div className="ec3w-labels-container">
            <Button
              data-testid="ec3-add-assembly-button"
              styleType="high-visibility"
              startIcon={<SvgAdd />}
              onClick={() => {
                setSelectedLabel(undefined);
                setShowLabelActionModal(true);
              }}
              disabled={!childTemplate.reportId}
            >
              Add Assembly
            </Button>
            <div className="ec3w-labels-list">
              {childTemplate.labels.length === 0 && !isLoading ? (
                <div className="gmw-empty-selection">
                  <Text>No Assemblies selected.</Text>
                  <Text>Press the &quot;Add Assembly&quot; button to create an Assembly.</Text>
                </div>
              ) : (
                childTemplate.labels.map((g) => (
                  <LabelTile
                    key={g.reportTable}
                    title={g.name === "" ? g.reportTable : g.name}
                    onDelete={() => {
                      setSelectedLabel(g);
                      setShowDeleteModal(true);
                    }}
                    onClickTitle={() => {
                      setSelectedLabel(g);
                      setShowLabelActionModal(true);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </Fieldset>
      </div>
      <TemplateActionPanel
        onSave={onSave}
        onCancel={onClickCancel}
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
        refresh={async () => {}}
      />

      <ReportConfirmModal
        show={showReportConfirmModal}
        setShow={setShowReportConfirmModal}
        onConfirm={() => {
          childTemplate.labels = [];
        }}
        onCancel={() => {
          handleSelectChange(previouslySelectedReport ?? "", "reportId", childTemplate, setChildTemplate);
        }}
        refresh={async () => {}}
      />
      <LabelActionModal
        show={showLabelActionModal}
        template={childTemplate}
        label={selectedLabel}
        onClose={async () => {
          setShowLabelActionModal(false);
        }}
        setTemplate={setChildTemplate}
      />
    </>
  );
};

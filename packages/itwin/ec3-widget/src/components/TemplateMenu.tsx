/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { useEffect, useState } from "react";
import { Button, LabeledInput, Stepper, Text, toaster } from "@itwin/itwinui-react";
import type { Configuration } from "./EC3/Template";
import { handleInputChange, handleSelectChange } from "./utils";
import { RequiredFieldsNotice } from "./RequiredFieldsNotice";
import { useApiContext } from "./context/APIContext";
import { CreateAssembly } from "./CreateAssemblyComponent";
import { SvgInfoCircular } from "@itwin/itwinui-icons-react";
import type { EC3Configuration } from "@itwin/insights-client";
import "./TemplateMenu.scss";

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
export const TemplateMenu = (props: TemplateMenuProps) => {
  const {
    config: { getAccessToken, iTwinId: projectId },
  } = useApiContext();
  const [childTemplate, setChildTemplate] = useState<Configuration>({
    reportId: undefined,
    description: "",
    displayName: "",
    labels: [],
  });
  const configurationsClient = useApiContext().ec3ConfigurationsClient;
  const reportsClient = useApiContext().reportsClient;
  const [currentStep, setCurrentStep] = useState<number>(0);

  useEffect(() => {
    const fetchReports = async () => {
      if (props.template) {
        const token = await getAccessToken();
        const configuration = await configurationsClient.getConfiguration(token, props.template.id!);
        const reportId = configuration._links.report.href.split("/reports/")[1];
        const childConfig: Configuration = {
          displayName: configuration.displayName,
          description: configuration.description ?? "",
          reportId,
          id: configuration.id,
          labels: configuration.labels,
        };
        setChildTemplate(childConfig);
      } else {
        try {
          const accessToken = await getAccessToken();
          const data = await reportsClient.getReports(accessToken, projectId);
          if (data) {
            const fetchedReport = data.find((x) => x.displayName === `DefaultMapping_CarbonCalcReport`);
            if (fetchedReport) handleSelectChange(fetchedReport.id, "reportId", childTemplate, setChildTemplate);
          }
        } catch (err) {
          toaster.negative("You are not authorized to use this system.");
          /* eslint-disable no-console */
          console.error(err);
        }
      }
    };
    void fetchReports();
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [projectId, props.template]);

  const saveConfiguration = async (): Promise<EC3Configuration | undefined> => {
    try {
      const token = await getAccessToken();
      if (childTemplate.id) {
        return await configurationsClient.updateConfiguration(token, childTemplate.id, childTemplate);
      } else if (childTemplate.reportId) {
        return await configurationsClient.createConfiguration(token, {
          ...childTemplate,
          reportId: childTemplate.reportId,
        });
      } else {
        return undefined;
      }
    } catch (e) {
      toaster.negative("Saving failed");
      // eslint-disable-next-line no-console
      console.error(e);
      return undefined;
    }
  };

  const renderSteps = () => {
    switch (currentStep) {
      case 0: {
        return (
          <>
            <div className="report-creation-step-one">
              <RequiredFieldsNotice />
              <LabeledInput
                id="reportName"
                label="Name"
                name="displayName"
                value={childTemplate.displayName}
                required
                onChange={(event) => {
                  handleInputChange(event, childTemplate, setChildTemplate);
                }}
              />
              <LabeledInput
                id="reportDescription"
                name="description"
                label="Description"
                value={childTemplate.description}
                onChange={(event) => {
                  handleInputChange(event, childTemplate, setChildTemplate);
                }}
              />
            </div>
            <div className="stepper-footer">
              <Button
                className="next-button"
                styleType="high-visibility"
                onClick={() => setCurrentStep(1)}
                disabled={childTemplate.displayName === "" || childTemplate.displayName === undefined}
              >
                Next
              </Button>
              <Button onClick={props.onClickCancel}>Cancel</Button>
            </div>
          </>
        );
      }
      case 1: {
        return (
          <CreateAssembly
            template={childTemplate}
            onBackClick={() => setCurrentStep(0)}
            onCancelClick={props.onClickCancel}
            onNextClick={() => setCurrentStep(2)}
            setTemplate={setChildTemplate}
            label={childTemplate.labels}
          />
        );
      }
      case 2: {
        return (
          <>
            <div className="report-creation-step-three">
              <Text className="summary-text">Selection Summary :</Text>
              {childTemplate.labels.map((x) => (
                <div className="assembly-list" key={x.name}>
                  <SvgInfoCircular />
                  <Text className="assembly-name">{x.name}</Text>
                </div>
              ))}
            </div>
            <div className="stepper-footer">
              <Button className="back-button" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button
                className="next-button"
                styleType="high-visibility"
                onClick={async () => {
                  await saveConfiguration();
                  props.onSaveSuccess();
                }}
              >
                Save
              </Button>
              <Button onClick={props.onClickCancel}>Cancel</Button>
            </div>
          </>
        );
      }
      default:
        return <></>;
    }
  };

  return (
    <div className="ec3-report-creation-stepper">
      <Stepper
        steps={[{ name: "Create a report" }, { name: "Add Assembly(s)" }, { name: "Send report to EC3" }]}
        currentStep={currentStep}
        onStepClick={(index: number) => setCurrentStep(index)}
      />
      {renderSteps()}
    </div>
  );
};

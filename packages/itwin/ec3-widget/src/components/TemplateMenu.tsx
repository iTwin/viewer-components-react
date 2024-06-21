/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { useEffect, useState } from "react";
import { Stepper, toaster } from "@itwin/itwinui-react";
import type { Configuration } from "./EC3/Template";
import { useApiContext } from "./context/APIContext";
import { TemplateModificationStepRenderer } from "./TemplateModificationStepRenderer";
import type { Report } from "@itwin/insights-client";
import "./TemplateMenu.scss";
/**
 * Props for {@link TemplateMenu}
 * @beta
 */
export interface TemplateMenuProps {
  template?: Configuration;
  onSaveSuccess: () => void;
  onClickCancel: () => void;
}

/**
 * EC3 Template menu
 * @beta
 */
export const TemplateMenu = (props: TemplateMenuProps) => {
  const {
    config: { getAccessToken, iTwinId: projectId, defaultReport },
  } = useApiContext();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [childTemplate, setChildTemplate] = useState<Configuration>({
    reportId: undefined,
    description: "",
    displayName: "",
    labels: [],
  });
  const [fetchedReports, setFetchedReports] = useState<Report[]>();

  const configurationsClient = useApiContext().ec3ConfigurationsClient;
  const reportsClient = useApiContext().reportsClient;

  useEffect(() => {
    const fetchReports = async () => {
      const token = await getAccessToken();

      if (props.template && !childTemplate.reportId) {
        setIsLoading(true);
        const data = await reportsClient.getReports(token, projectId);
        if (data && data.length > 0) {
          setFetchedReports(data);
        }
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
        setIsLoading(false);
      } else {
        try {
          // check if defaultReport exists (set by the consuming application), else fetch all reports and allow user to select
          if (defaultReport) {
            setChildTemplate({ ...childTemplate, reportId: defaultReport.id });
          } else {
            if (!fetchedReports) {
              setIsLoading(true);
              const data = await reportsClient.getReports(token, projectId);
              if (data && data.length > 0) {
                setFetchedReports(data);
              }
              setIsLoading(false);
            }
          }
        } catch (err) {
          toaster.negative("You are not authorized to use this system.");
          /* eslint-disable no-console */
          console.error(err);
          setIsLoading(false);
        }
      }
    };
    void fetchReports();
  }, [childTemplate, configurationsClient, defaultReport, fetchedReports, getAccessToken, projectId, props.template, reportsClient]);

  const saveConfiguration = async () => {
    try {
      const token = await getAccessToken();
      if (childTemplate.id) {
        await configurationsClient.updateConfiguration(token, childTemplate.id, childTemplate);
        props.onSaveSuccess();
        return;
      } else if (childTemplate.reportId) {
        await configurationsClient.createConfiguration(token, {
          ...childTemplate,
          reportId: childTemplate.reportId,
        });
        props.onSaveSuccess();
        return;
      } else {
        props.onSaveSuccess();
        return undefined;
      }
    } catch (e) {
      toaster.negative("Saving failed.");
      // eslint-disable-next-line no-console
      console.error(e);
      return undefined;
    }
  };

  return (
    <div className="ec3w-template-creation-stepper" data-testid="ec3w-template-creation-stepper">
      <Stepper
        steps={[{ name: "Create a template" }, { name: "Add Assembly(s)" }, { name: "Send report to EC3" }]}
        currentStep={currentStep}
        onStepClick={(index: number) => setCurrentStep(index)}
      />
      <TemplateModificationStepRenderer
        childTemplate={childTemplate}
        isLoading={isLoading}
        currentStep={currentStep}
        onCancelClick={props.onClickCancel}
        onSaveClick={saveConfiguration}
        updateChildTemplate={setChildTemplate}
        updateCurrentStep={setCurrentStep}
        fetchedReports={fetchedReports ?? []}
      />
    </div>
  );
};

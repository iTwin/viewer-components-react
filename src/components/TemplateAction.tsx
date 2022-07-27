/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Fieldset, LabeledInput, Small, ToggleSwitch, ComboBox, SelectOption, toaster, Label } from "@itwin/itwinui-react";
import React, { useState, useMemo, useEffect } from "react";
import ActionPanel from "./ActionPanel";
//import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, handleInputChange, WidgetHeader } from "./utils";
import { IModelApp } from "@itwin/core-frontend";
import "./TemplateAction.scss";
import { Selector } from "./Selector"
import { ReportingClient } from "@itwin/insights-client";
import { useActiveIModelConnection } from "@itwin/appui-react";
//import { useMappingClient } from "./context/MappingClientContext";
import type { Mapping } from "@itwin/insights-client";
import SelectorClient from "./selectorClient";
import { Report } from "@itwin/insights-client"
//import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";

interface TemplateActionProps {
  //report?: string;
  selector?: Selector;
  returnFn: () => Promise<void>;
}

const TemplateAction = ({ selector, returnFn }: TemplateActionProps) => {
  const projectId = useActiveIModelConnection()?.iTwinId as string;
  const reportingClientApi = useMemo(() => new ReportingClient(), []);
  //const { getAccessToken } = useGroupingMappingApiConfig();
  //const mappingClient = useMappingClient();
  const [values, setValues] = useState({
    name: selector?.templateName ?? "",
    description: selector?.templateDescription ?? "",
    reportId: selector?.reportId ?? "",
    groups: selector?.groups ?? [],
    id: selector?.id,
  });
  //const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [availableReports, setReports] = useState<Report[]>([]);
  //const [report, setReport] = useState<string>();

  // TODO ERRORED STATE
  const onSave = async () => {

    const selector: Selector = {
      id: values.id,
      templateName: values.name,
      templateDescription: values.description,
      reportId: values.reportId,
      groups: values.groups,
    }

    const selectorClient = new SelectorClient;

    if (selector.id)
      selectorClient.updateSelector(selector);
    else
      selectorClient.createSelector(selector);


    returnFn();
    /*
    try {
      if (!validator.allValid()) {
        showValidationMessage(true);
        return;
      }
      setIsLoading(true);
      const accessToken = await getAccessToken();
      mapping
        ? await mappingClient.updateMapping(accessToken, iModelId, mapping.id ?? "", {
          mappingName: values.name,
          description: values.description,
          extractionEnabled: values.extractionEnabled,
        })
        : await mappingClient.createMapping(accessToken, iModelId, {
          mappingName: values.name,
          description: values.description,
          extractionEnabled: values.extractionEnabled,
        });
      await returnFn();
    } catch (error: any) {
      handleError(error.status);
      setIsLoading(false);
    }
    */
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

  const ReportOptions = useMemo(() => {
    const newGroupOptions: SelectOption<string>[] = [];


    for (const name of availableReports) {
      newGroupOptions.push({
        label: name.displayName ?? "",
        value: name.id ?? "",
        key: name,
      });
    }
    return newGroupOptions;
  }, [availableReports]);

  return (
    <>
      <WidgetHeader
        title={selector ? "Modify Template" : "Create Template"}
        returnFn={returnFn}
      />
      <div className='details-form-container'>
        <Fieldset legend='Template Details' className='details-form'>
          <Small className='field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>
          <LabeledInput
            id='name'
            name='name'
            label='Name'
            value={values.name}
            required
            onChange={(event) => {
              handleInputChange(event, values, setValues);
              //validator.showMessageFor("name");
            }}

          />
          <LabeledInput
            id='description'
            name='description'
            label='Description'
            value={values.description}
            onChange={(event) => {
              handleInputChange(event, values, setValues);
            }}
          />

          <Label htmlFor="material-combo-input" required>
            Report
          </Label>
          <ComboBox

            id='report'
            //label='Description'
            options={ReportOptions}
            value={values.reportId}
            onChange={async (value) => {
              values.reportId = value;
              //handleInputChange(value, values, setValues);
              //setReport(value);
              //groupLabel?.element.material = value;
              //handleInputChange(event, value, setGroup);
              //setMaterialColumn(value);
              //await runExtraction(value);
            }}
            inputProps={{
              id: "report-combo-input",
              placeholder: "Report",
            }}
          />

        </Fieldset>
      </div>
      <ActionPanel
        onSave={onSave}
        onCancel={returnFn}
        isSavingDisabled={!values.name}
        isLoading={isLoading}
      />
    </>
  );
};

export default TemplateAction;

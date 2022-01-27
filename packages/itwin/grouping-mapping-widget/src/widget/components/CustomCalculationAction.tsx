/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Fieldset,
  LabeledInput,
  LabeledSelect,
  LabeledTextarea,
  Small,
} from "@itwin/itwinui-react";
import React, { useState } from "react";
import { reportingClientApi } from "../../api/reportingClient";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { WidgetHeader } from "./utils";
import "./CalculatedPropertyAction.scss";
import { CustomCalculation } from "./CustomCalculationTable";
import { CustomCalculationCreateReportingAPI } from "../../api/generated/api";
import "./CustomCalculationAction.scss";
import { quantityTypesSelectionOptions } from "./GroupPropertyAction";

interface CalculatedPropertyActionProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  customCalculation?: CustomCalculation;
  returnFn: () => Promise<void>;
}

const CustomCalculationAction = ({
  iModelId,
  mappingId,
  groupId,
  customCalculation,
  returnFn,
}: CalculatedPropertyActionProps) => {
  const [propertyName, setPropertyName] = useState<string>(
    customCalculation?.propertyName ?? "",
  );
  const [formula, setFormula] = useState<string>(
    customCalculation?.formula ?? "",
  );
  const [quantityType, setQuantityType] = useState<string>("Undefined");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formulaErrorMessage, setFormulaErrorMessage] = useState<string>("");
  const [validator, showValidationMessage] = useValidator();

  const onSave = async () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    try {
      setIsLoading(true);

      const newCustomCalculation: CustomCalculationCreateReportingAPI = {
        propertyName,
        formula,
        quantityType,
      };

      customCalculation
        ? await reportingClientApi.updateCustomCalculation(
          iModelId,
          mappingId,
          groupId,
          customCalculation.id ?? "",
          newCustomCalculation,
        )
        : await reportingClientApi.createCustomCalculation(
          iModelId,
          mappingId,
          groupId,
          newCustomCalculation,
        );
      await returnFn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // error instanceof Response refuses to be true when it should be.
      if (error.status === 422) {
        error = error as Response;
        const erroredResponse = await error.json();
        if (
          erroredResponse.error.code === "InvalidInsightsRequest" &&
          erroredResponse.error.target === "formula"
        ) {
          setFormulaErrorMessage(erroredResponse.error.message);
        }
      }
      setIsLoading(false);
    }
  };

  return (
    <>
      <WidgetHeader
        title={
          customCalculation
            ? `${customCalculation?.propertyName ?? ""}`
            : "Create Custom Calculation"
        }
        returnFn={returnFn}
      />
      <div className='custom-calculation-action-container'>
        <Fieldset legend='Custom Calculation Details' className='details-form'>
          <Small className='field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>
          <LabeledInput
            value={propertyName}
            required
            name='name'
            label='Name'
            disabled={isLoading}
            onChange={(event) => {
              setPropertyName(event.target.value);
              validator.showMessageFor("name");
            }}
            message={validator.message("name", propertyName, NAME_REQUIREMENTS)}
            status={
              validator.message("name", propertyName, NAME_REQUIREMENTS)
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("name");
            }}
            onBlurCapture={(event) => {
              setPropertyName(event.target.value);
              validator.showMessageFor("name");
            }}
          />
          <LabeledTextarea
            value={formula}
            required
            name='formula'
            label='Formula'
            disabled={isLoading}
            onChange={(event) => {
              setFormula(event.target.value);
            }}
            message={formulaErrorMessage}
            status={formulaErrorMessage ? "negative" : undefined}
          />
          <LabeledSelect<string>
            label='Quantity Type'
            disabled={isLoading}
            options={quantityTypesSelectionOptions}
            value={quantityType}
            onChange={setQuantityType}
          />
        </Fieldset>
      </div>
      <ActionPanel
        onSave={onSave}
        onCancel={returnFn}
        disabled={!(formula && propertyName)}
        isLoading={isLoading}
      />
    </>
  );
};

export default CustomCalculationAction;

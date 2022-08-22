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
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, WidgetHeader } from "./utils";
import "./CalculatedPropertyAction.scss";
import type { CustomCalculationType } from "./CustomCalculationTable";
import "./CustomCalculationAction.scss";
import { quantityTypesSelectionOptions } from "./GroupPropertyAction";
import { useFormulaValidation } from "../hooks/useFormulaValidation";
import type { PropertyMap } from "../../formula/Types";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";

interface CalculatedPropertyActionProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  properties: PropertyMap;
  customCalculation?: CustomCalculationType;
  returnFn: (modified: boolean) => Promise<void>;
}

const CustomCalculationAction = ({
  iModelId,
  mappingId,
  groupId,
  properties,
  customCalculation,
  returnFn,
}: CalculatedPropertyActionProps) => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [propertyName, setPropertyName] = useState<string>(
    customCalculation?.propertyName ?? "",
  );
  const [formula, setFormula] = useState<string>(
    customCalculation?.formula ?? "",
  );
  const [quantityType, setQuantityType] = useState<string>(customCalculation?.quantityType ?? "Undefined");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formulaErrorMessage, setFormulaErrorMessage] = useState<string>("");
  const [validator, showValidationMessage] = useValidator();
  const { isValid, forceValidation } = useFormulaValidation(propertyName.toLowerCase(), formula, properties, setFormulaErrorMessage);

  const onSave = async () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    if (!forceValidation()) {
      return;
    }
    try {
      setIsLoading(true);
      const accessToken = await getAccessToken();
      customCalculation
        ? await mappingClient.updateCustomCalculation(
          accessToken,
          iModelId,
          mappingId,
          groupId,
          customCalculation.id ?? "",
          {
            propertyName,
            formula,
            quantityType,
          }
        )
        : await mappingClient.createCustomCalculation(
          accessToken,
          iModelId,
          mappingId,
          groupId,
          {
            propertyName,
            formula,
            quantityType,
          }
        );
      await returnFn(true);
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
      } else {
        handleError(error.status);
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
        returnFn={async () => returnFn(false)}
      />
      <div className='gmw-custom-calculation-action-container'>
        <Fieldset legend='Custom Calculation Details' className='gmw-details-form'>
          <Small className='gmw-field-legend'>
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
            onShow={() => { }}
            onHide={() => { }}
          />
        </Fieldset>
      </div>
      <ActionPanel
        onSave={onSave}
        onCancel={async () => returnFn(false)}
        isSavingDisabled={!(formula && propertyName && isValid)}
        isLoading={isLoading}
      />
    </>
  );
};

export default CustomCalculationAction;

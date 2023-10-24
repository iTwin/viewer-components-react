/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Alert,
  Fieldset,
  LabeledInput,
  LabeledSelect,
  LabeledTextarea,
  Text,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useState } from "react";
import ActionPanel from "../../SharedComponents/ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError } from "../../../common/utils";
import "./CustomCalculationAction.scss";
import { quantityTypesSelectionOptions } from "../GroupProperties/GroupPropertyAction";
import { useFormulaValidation } from "../hooks/useFormulaValidation";
import type { PossibleDataType, PropertyMap } from "../../../formula/Types";
import { useMappingClient } from "../../context/MappingClientContext";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import type { CalculatedProperty, CustomCalculation, GroupProperty } from "@itwin/insights-client";
import { QuantityType } from "@itwin/insights-client";
import { usePropertiesContext } from "../../context/PropertiesContext";

export interface CustomCalculationActionProps {
  mappingId: string;
  groupId: string;
  customCalculation?: CustomCalculation;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
}

const stringToPossibleDataType = (str?: string): PossibleDataType => {
  switch (str?.toLowerCase()) {
    case "double":
    case "number": return "Number";
    case "string": return "String";
    case "boolean": return "Boolean";
    default: return "Undefined";
  }
};

const convertToPropertyMap = (
  groupProperties: GroupProperty[],
  calculatedProperties: CalculatedProperty[],
  customCalculations: CustomCalculation[],
  selectedPropertyName?: string
): PropertyMap => {
  const map: PropertyMap = {};
  const selectedLowerName = selectedPropertyName?.toLowerCase();

  groupProperties.forEach((p) => {
    const lowerName = p.propertyName?.toLowerCase();
    if (lowerName && lowerName !== selectedLowerName)
      map[lowerName] = stringToPossibleDataType(p.dataType);
  });

  calculatedProperties.forEach((p) => {
    const lowerName = p.propertyName?.toLowerCase();
    if (lowerName)
      map[lowerName] = "Number";
  });

  customCalculations.forEach((p) => {
    const lowerName = p.propertyName?.toLowerCase();
    if (lowerName && lowerName !== selectedLowerName)
      map[lowerName] = stringToPossibleDataType(p.dataType);
  });

  return map;
};

export const CustomCalculationAction = ({
  mappingId,
  groupId,
  customCalculation,
  onSaveSuccess,
  onClickCancel,
}: CustomCalculationActionProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [propertyName, setPropertyName] = useState<string>(
    customCalculation?.propertyName ?? "",
  );
  const [formula, setFormula] = useState<string>(
    customCalculation?.formula ?? "",
  );
  const {
    groupProperties,
    setGroupProperties,
    calculatedProperties,
    setCalculatedProperties,
    customCalculationProperties,
    setCustomCalculationProperties,
  } = usePropertiesContext();
  const [quantityType, setQuantityType] = useState<QuantityType>(customCalculation?.quantityType ?? QuantityType.Undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [formulaErrorMessage, setFormulaErrorMessage] = useState<string>("");
  const [validator, showValidationMessage] = useValidator();
  const [properties, setProperties] = useState<PropertyMap>({});
  const { isValid, forceValidation } = useFormulaValidation(propertyName.toLowerCase(), formula, properties, setFormulaErrorMessage);

  const initialize = useCallback(async () => {
    const accessToken = await getAccessToken();
    const [groupProps, calcProps, customCalcProps] = await Promise.all([
      mappingClient.getGroupProperties(accessToken, iModelId, mappingId, groupId),
      mappingClient.getCalculatedProperties(accessToken, iModelId, mappingId, groupId),
      mappingClient.getCustomCalculations(accessToken, iModelId, mappingId, groupId),
    ]);
    setGroupProperties(groupProps);
    setCalculatedProperties(calcProps);
    setCustomCalculationProperties(customCalcProps);
  }, [getAccessToken, groupId, iModelId, mappingClient, mappingId, setCalculatedProperties, setCustomCalculationProperties, setGroupProperties]);

  const fetchAllProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!groupProperties || !calculatedProperties || !customCalculationProperties) {
        await initialize();
      }
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  }, [calculatedProperties, customCalculationProperties, groupProperties, initialize]);

  useEffect(() => {
    const propertiesMap = convertToPropertyMap(groupProperties ?? [], calculatedProperties ?? [], customCalculationProperties ?? []);
    setProperties(propertiesMap);
  }, [calculatedProperties, customCalculationProperties, groupProperties]);

  useEffect(() => {
    void fetchAllProperties();
  }, [fetchAllProperties]);

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
          customCalculation.id,
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
      onSaveSuccess();
      setPropertyName("");
      setFormula("");
      setQuantityType(QuantityType.Undefined);
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className='gmw-custom-calculation-action-container'>
        <Fieldset legend='Custom Calculation Details' className='gmw-details-form'>
          <Text variant='small' as='small' className='gmw-field-legend'>
            Asterisk * indicates mandatory fields.
          </Text>
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
          <Alert
            type='informational'
            clickableText='Click here.'
            clickableTextProps={{ href: "https://developer.bentley.com/apis/insights/operations/create-customcalculation/", target: "_blank", rel: "noreferrer" }}
          >
            To learn more about creating custom calculation formulas, view the documentation.
          </Alert>
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
            onBlurCapture={() => {
              forceValidation();
            }}
          />
          <LabeledSelect<QuantityType>
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
        onCancel={onClickCancel}
        isSavingDisabled={!(formula && propertyName && isValid)}
        isLoading={isLoading}
      />
    </>
  );
};

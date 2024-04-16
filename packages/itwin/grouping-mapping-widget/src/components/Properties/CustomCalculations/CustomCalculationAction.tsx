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
import React, { useEffect, useState } from "react";
import ActionPanel from "../../SharedComponents/ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError } from "../../../common/utils";
import "./CustomCalculationAction.scss";
import { quantityTypesSelectionOptions } from "../GroupProperties/GroupPropertyAction";
import { useFormulaValidation } from "../hooks/useFormulaValidation";
import type { PossibleDataType, PropertyMap } from "../../../formula/Types";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import type { Property , QuantityType } from "@itwin/insights-client";
import { DataType } from "@itwin/insights-client";
import { useCalculatedPropertiesQuery } from "../hooks/useCalculatedPropertiesQuery";
import { useCustomCalculationsQuery } from "../hooks/useCustomCalculationsQuery";
import { useGroupPropertiesQuery } from "../hooks/useGroupPropertiesQuery";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePropertiesClient } from "../../context/PropertiesClientContext";

export interface CustomCalculationActionProps {
  mappingId: string;
  groupId: string;
  customCalculation?: Property;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
}

const stringToPossibleDataType = (str?: string): PossibleDataType => {
  switch (str?.toLowerCase()) {
    case "double":
    case "integer": return "Number";
    case "string": return "String";
    case "boolean": return "Boolean";
    default: return "Undefined";
  }
};

const convertToPropertyMap = (
  groupProperties: Property[],
  calculatedProperties: Property[],
  customCalculations: Property[],
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
  const propertiesClient = usePropertiesClient();
  const [propertyName, setPropertyName] = useState<string>(
    customCalculation?.propertyName ?? "",
  );
  const [formula, setFormula] = useState<string>(
    customCalculation?.formula ?? "",
  );
  const [quantityType, setQuantityType] = useState<QuantityType | undefined>(customCalculation?.quantityType ?? undefined);
  const [formulaErrorMessage, setFormulaErrorMessage] = useState<string>("");
  const [validator, showValidationMessage] = useValidator();
  const [properties, setProperties] = useState<PropertyMap>({});
  const { isValid, forceValidation } = useFormulaValidation(propertyName.toLowerCase(), formula, properties, setFormulaErrorMessage);
  const queryClient = useQueryClient();

  const { data: groupProperties, isFetching: isLoadingGroupProperties } = useGroupPropertiesQuery(iModelId, mappingId, groupId, getAccessToken, propertiesClient);
  const { data: calculatedProperties, isFetching: isLoadingCalculatedProperties } = useCalculatedPropertiesQuery(iModelId, mappingId, groupId, getAccessToken, propertiesClient);
  const { data: customCalculationProperties, isFetching: isLoadingCustomCalculations } = useCustomCalculationsQuery(iModelId, mappingId, groupId, getAccessToken, propertiesClient);

  useEffect(() => {
    const propertiesMap = convertToPropertyMap(groupProperties?.properties ?? [], calculatedProperties?.properties ?? [], customCalculationProperties?.properties ?? []);
    setProperties(propertiesMap);
  }, [calculatedProperties, customCalculationProperties, groupProperties]);

  const { mutate: saveMutation, isLoading: isSaving } = useMutation(async () => {

    const accessToken = await getAccessToken();

    return customCalculation
      ? propertiesClient.updateProperty(
        accessToken,
        mappingId,
        groupId,
        customCalculation.id,
        {
          propertyName,
          dataType: customCalculation.dataType,
          formula,
          quantityType,
        }
      )
      : propertiesClient.createProperty(
        accessToken,
        mappingId,
        groupId,
        {
          propertyName,
          dataType: DataType.Double,
          formula,
          quantityType,
        }
      );
  }, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customCalculations", iModelId, mappingId, groupId] });
      onSaveSuccess();
      setPropertyName("");
      setFormula("");
      setQuantityType(undefined);
    },
    onError: async (error: any) => {
      if (error.status === 422) {
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
    },
  });

  const onSave = () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    if (!forceValidation()) {
      return;
    }
    saveMutation();
  };

  const isLoading = isSaving || isLoadingGroupProperties || isLoadingCalculatedProperties || isLoadingCustomCalculations;

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
            clickableTextProps={{ href: "https://developer.bentley.com/apis/grouping-and-mapping/operations/create-property/#customcalculations", target: "_blank", rel: "noreferrer" }}
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
          <LabeledSelect<QuantityType | undefined>
            label='Quantity Type'
            disabled={isLoading}
            options={quantityTypesSelectionOptions}
            value={quantityType}
            onChange={setQuantityType}
            onShow={() => { }}
            onHide={() => { }}
            placeholder = "No Quantity Type"
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

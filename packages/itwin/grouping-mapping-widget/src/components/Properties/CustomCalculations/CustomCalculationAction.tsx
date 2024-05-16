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
import type { DataType as FormulaDataType } from "../../../formula/Types";
import { usePropertiesQuery } from "../hooks/usePropertiesQuery";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePropertiesClient } from "../../context/PropertiesClientContext";

/**
 * Props for the {@link CustomCalculationAction} component.
 * @public
 */
export interface CustomCalculationActionProps {
  mappingId: string;
  groupId: string;
  customCalculation?: Property;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
}

const stringToPossibleDataType = (str?: string): PossibleDataType => {
  switch (str?.toLowerCase()) {
    case "double": return "Double";
    case "integer": return "Integer";
    case "string": return "String";
    case "boolean": return "Boolean";
    default: return "Undefined";
  }
};

const convertToPropertyMap = (
  properties: Property[],
  selectedPropertyName?: string
): PropertyMap => {
  const map: PropertyMap = {};
  const selectedLowerName = selectedPropertyName?.toLowerCase();

  properties.forEach((p) => {
    const lowerName = p.propertyName?.toLowerCase();
    if (lowerName && lowerName !== selectedLowerName)
      map[lowerName] = stringToPossibleDataType(p.dataType);
  });

  return map;
};

const inferToPropertyDataType = (value: FormulaDataType): DataType => {
  switch(value){
    case "Double":
      return DataType.Double;
    case "Integer":
      return DataType.Integer;
    case "String":
      return DataType.String;
    case "Boolean":
      return DataType.Boolean;
    default:
      return DataType.String;
  }
};

/**
 * Component to create or update a custom calculation property.
 * @public
 */
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
  const { isValid, forceValidation, inferredDataType } = useFormulaValidation(propertyName.toLowerCase(), formula, properties, setFormulaErrorMessage);
  const queryClient = useQueryClient();

  const { data: groupProperties, isFetching: isLoadingGroupProperties } = usePropertiesQuery(iModelId, mappingId, groupId, getAccessToken, propertiesClient);

  useEffect(() => {
    const propertiesMap = convertToPropertyMap(groupProperties?.properties ?? []);
    setProperties(propertiesMap);
  }, [groupProperties]);

  const { mutate: saveMutation, isLoading: isSaving } = useMutation(async () => {

    const accessToken = await getAccessToken();

    if(customCalculation){
      return propertiesClient.updateProperty(
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
      );
    }

    if(inferredDataType){
      return propertiesClient.createProperty(
        accessToken,
        mappingId,
        groupId,
        {
          propertyName,
          dataType: inferToPropertyDataType(inferredDataType),
          formula,
          quantityType,
        }
      );
    }
    return;
  }, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties", iModelId, mappingId, groupId] });
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

  const isLoading = isSaving || isLoadingGroupProperties;

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

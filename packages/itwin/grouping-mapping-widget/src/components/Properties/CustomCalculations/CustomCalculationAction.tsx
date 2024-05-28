/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Alert,
  Fieldset,
  LabeledTextarea,
} from "@itwin/itwinui-react";
import React, { useEffect, useState } from "react";
import "./CustomCalculationAction.scss";
import { useFormulaValidation } from "../hooks/useFormulaValidation";
import type { PossibleDataType, PropertyMap } from "../../../formula/Types";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import type { Property } from "@itwin/insights-client";
import { DataType } from "@itwin/insights-client";
import type { DataType as FormulaDataType } from "../../../formula/Types";
import { usePropertiesQuery } from "../hooks/usePropertiesQuery";
import { usePropertiesClient } from "../../context/PropertiesClientContext";

/**
 * Props for the {@link CustomCalculationAction} component.
 * @public
 */
export interface CustomCalculationActionProps {
  mappingId: string;
  groupId: string;
  propertyName: string;
  // dataType: DataType;
  formula?: string;
  setFormula: (formula: string | undefined) => void;
  isSaving: boolean;
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

const inferToPropertyDataType = (value: FormulaDataType | undefined): DataType => {
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
  propertyName,
  // dataType,
  formula,
  setFormula,
  isSaving,

}: CustomCalculationActionProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const propertiesClient = usePropertiesClient();
  const [formulaErrorMessage, setFormulaErrorMessage] = useState<string>("");
  const [properties, setProperties] = useState<PropertyMap>({});
  const { isValid, forceValidation, inferredDataType } = useFormulaValidation(propertyName.toLowerCase(), formula ?? "", properties, setFormulaErrorMessage);

  const { data: groupProperties, isFetching: isLoadingGroupProperties } = usePropertiesQuery(iModelId, mappingId, groupId, getAccessToken, propertiesClient);

  useEffect(() => {
    const propertiesMap = convertToPropertyMap(groupProperties?.properties ?? []);
    setProperties(propertiesMap);
  }, [groupProperties]);

  const isLoading = isSaving || isLoadingGroupProperties;

  // eslint-disable-next-line no-console
  console.log(isValid, inferToPropertyDataType(inferredDataType));

  return (
    <>
      <div className='gmw-custom-calculation-action-container'>
        <Fieldset legend='Custom Calculation Details' className='gmw-details-form'>
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
        </Fieldset>
      </div>
    </>
  );
};

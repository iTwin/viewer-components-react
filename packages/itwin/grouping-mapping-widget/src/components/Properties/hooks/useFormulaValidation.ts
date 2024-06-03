/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useState } from "react";
import { resolveFormulaDataType } from "../../../formula/FormulaDataTypeResolver";
import type { DataType as FormulaDataType, PossibleDataType, PropertyMap } from "../../../formula/Types";
import { debounce } from "../../../common/utils";
import type { Property } from "@itwin/insights-client";
import { DataType } from "@itwin/insights-client";

function validate(formulaName: string, formula: string | undefined, properties: PropertyMap, setFormulaErrorMessage: (s: string | undefined) => void, setIsFormulaValid: (b: boolean) => void, setDataType: (inferredDataType: DataType | undefined) => void, providedDataType?: DataType): boolean {
  if (!formula) {
    setFormulaErrorMessage(undefined);
    setIsFormulaValid(false);
    setDataType(undefined);
    return false;
  }

  const resolveFormulaType = resolveFormulaDataType(formulaName, formula, properties, providedDataType);
  const error = resolveFormulaType.errorMessage;
  setFormulaErrorMessage(error);
  setIsFormulaValid(!error);
  setDataType(inferToPropertyDataType(resolveFormulaType.value));
  return !error;
}

const debouncedValidationFunc = debounce(validate, 2000);

export function useFormulaValidation(formulaName: string, formula: string | undefined, groupProperties: Property[], setFormulaErrorMessage: (s: string | undefined) => void, providedDataType?: DataType) {
  const [isFormulaValid, setIsFormulaValid] = useState(false);
  const [inferredDataType, setDataType] = useState<DataType | undefined>(undefined);
  const [propertyMap, setPropertyMap] = useState<PropertyMap>({});
  useEffect(() => setPropertyMap(convertToPropertyMap(groupProperties)), [groupProperties]);
  useEffect(() => debouncedValidationFunc(formulaName, formula, propertyMap, setFormulaErrorMessage, setIsFormulaValid, setDataType, providedDataType), [formulaName, formula, groupProperties, setFormulaErrorMessage, propertyMap, providedDataType]);
  return { isFormulaValid, inferredDataType, forceValidation: () => validate(formulaName, formula, propertyMap, setFormulaErrorMessage, setIsFormulaValid, setDataType, providedDataType) };
}

export const inferToPropertyDataType = (value: FormulaDataType | undefined): DataType => {
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

const stringToPossibleDataType = (str?: string): PossibleDataType => {
  switch (str?.toLowerCase()) {
    case "double": return "Double";
    case "integer": return "Integer";
    case "string": return "String";
    case "boolean": return "Boolean";
    default: return "Undefined";
  }
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useState } from "react";
import { resolveFormulaDataType } from "../../../formula/FormulaDataTypeResolver";
import type { DataType, PropertyMap } from "../../../formula/Types";
import { debounce } from "../../../common/utils";

function validate(formulaName: string, formula: string, properties: PropertyMap, setFormulaErrorMessage: (s: string) => void, setIsValid: (b: boolean) => void, setDataType: (inferredDataType: DataType | undefined) => void ): boolean {
  if (!formula) {
    setFormulaErrorMessage("");
    setIsValid(false);
    setDataType(undefined);
    return false;
  }

  const resolveFormulaType = resolveFormulaDataType(formulaName, formula, properties);
  const error = resolveFormulaType.errorMessage ?? "";
  setFormulaErrorMessage(error);
  setIsValid(!error);
  setDataType(resolveFormulaType.value);
  return !error;
}

const debouncedValidationFunc = debounce(validate, 5000);

export function useFormulaValidation(formulaName: string, formula: string, properties: PropertyMap, setFormulaErrorMessage: (s: string) => void) {
  const [isValid, setIsValid] = useState(false);
  const [inferredDataType, setDataType] = useState<DataType | undefined>(undefined);
  useEffect(() => debouncedValidationFunc(formulaName, formula, properties, setFormulaErrorMessage, setIsValid, setDataType), [formulaName, formula, properties, setFormulaErrorMessage]);
  return { isValid, inferredDataType, forceValidation: () => validate(formulaName, formula, properties, setFormulaErrorMessage, setIsValid, setDataType) };
}

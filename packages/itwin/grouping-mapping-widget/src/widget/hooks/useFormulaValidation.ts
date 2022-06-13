/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useState } from "react";
import { validateFormula } from "../../formula/FormulaValidator";
import type { PropertyMap } from "../../formula/Types";
import { debounce } from "../utils";

function validate(formulaName: string, formula: string, properties: PropertyMap, setFormulaErrorMessage: (s: string) => void, setIsValid: (b: boolean) => void): boolean {
  if (!formula) {
    setFormulaErrorMessage("");
    setIsValid(false);
    return false;
  }

  const error = validateFormula(formulaName, formula, properties);
  setFormulaErrorMessage(error);
  setIsValid(!error);
  return !error;
}

const debouncedValidationFunc = debounce(validate, 1000);

export function useFormulaValidation(formulaName: string, formula: string, properties: PropertyMap, setFormulaErrorMessage: (s: string) => void) {
  const [isValid, setIsValid] = useState(false);
  useEffect(() => debouncedValidationFunc(formulaName, formula, properties, setFormulaErrorMessage, setIsValid), [formulaName, formula, properties, setFormulaErrorMessage]);
  return { isValid, forceValidation: () => validate(formulaName, formula, properties, setFormulaErrorMessage, setIsValid) };
}

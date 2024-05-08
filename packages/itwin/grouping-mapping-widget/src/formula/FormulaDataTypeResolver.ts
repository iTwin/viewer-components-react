/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { splitFormula } from "./FormulaSplitter";
import { resolveTokensDataType } from "./FormulaTokensDataTypeResolver";
import { convertInfixToPostfix } from "./InfixToPostfixConverter";
import type { IResult } from "./IResult";
import { ParenthesisState, validateParenthesis } from "./ParenthesisValidator";
import type { DataType, PropertyMap } from "./Types";

/**
 * Resolves DataType of the given formula.
 * @param formulaName Name of the current formula. Expected to be lowercase.
 * @param formula The formula itself.
 * @param properties All available properties or variables with their data types
 * that could be used in formula. Names are expected to be lowercase.
 * @returns `dataType` if formula is valid. `errorMessage` otherwise.
 * @public
 */
export function resolveFormulaDataType(formulaName: string, formula: string, properties: PropertyMap): IResult<DataType> {
  const parenthesisState = validateParenthesis(formula);
  if (ParenthesisState.NotClosed === parenthesisState) {
    return { errorMessage: "Opened but not closed parenthesis found." };
  } else if (ParenthesisState.NotOpened === parenthesisState) {
    return { errorMessage: "Closed but not opened parenthesis found." };
  }

  let infixFormulaTokens;
  try {
    infixFormulaTokens = splitFormula(formula);
  } catch (ex) {
    if (ex instanceof Error) {
      return { errorMessage: ex.message };
    } else {
      // eslint-disable-next-line no-console
      console.error("Unknown error.", ex);
      return { errorMessage: "Unknown error." };
    }
  }

  const postfixFormulaTokens = convertInfixToPostfix(infixFormulaTokens);

  if (undefined === postfixFormulaTokens.value) {
    return { errorMessage: postfixFormulaTokens.errorMessage ?? "Unknown error." };
  }

  return resolveTokensDataType(formulaName, postfixFormulaTokens.value, properties);
}

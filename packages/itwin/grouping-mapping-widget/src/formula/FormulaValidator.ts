/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { splitFormula } from "./FormulaSplitter";
import { validateTokens } from "./FormulaTokensValidator";
import { convertInfixToPostfix } from "./InfixToPostfixConverter";
import { ParenthesisState, validateParenthesis } from "./ParenthesisValidator";
import type { PropertyMap } from "./Types";

export function validateFormula(formulaName: string, formula: string, properties: PropertyMap): string {
  const parenthesisState = validateParenthesis(formula);
  if (ParenthesisState.NotClosed === parenthesisState) {
    return "Opened but not closed parenthesis found.";
  } else if (ParenthesisState.NotOpened === parenthesisState) {
    return "Closed but not opened parenthesis found.";
  }

  let infixFormulaTokens;
  try {
    infixFormulaTokens = splitFormula(formula);
  } catch (ex) {
    return (ex as Error).message;
  }

  const postfixFormulaTokens = convertInfixToPostfix(infixFormulaTokens);

  if (undefined === postfixFormulaTokens.value) {
    return postfixFormulaTokens.errorMessage ?? "Unknown error";
  }

  return validateTokens(formulaName, postfixFormulaTokens.value, properties);
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IResult } from "./IResult";
import type { DataType, PossibleDataType } from "./Types";
import { formatNumericalPositionString } from "./Utils";

export interface FormulaFunctionArgument {
  dataType?: DataType;
  canBeAny?: boolean;
  canBeUndefined?: boolean;
}

export interface FormulaFunction {
  argumentCountBounds: [number, number];
  expectedArguments: FormulaFunctionArgument[];
  returnType?: DataType;
  typesMatchFromIndex?: number;
  isreturnTypeFromTypeMatch?: boolean;
}

interface ArgumentValidationResult {
  isValid: boolean;
  matchingType?: PossibleDataType;
  invalidReason?: string;
}

function isValidArgument(arg: PossibleDataType, argPos: number, expectedArg: FormulaFunctionArgument): ArgumentValidationResult {
  let isValid: boolean;
  if (arg === "Undefined") {
    isValid = !!expectedArg.canBeUndefined;
    return { isValid, invalidReason: isValid ? undefined : `Expected ${formatNumericalPositionString(argPos + 1)} argument to not be null.` };
  }

  isValid = expectedArg.canBeAny || arg === expectedArg.dataType;
  return { isValid, invalidReason: isValid ? undefined : `Expected ${formatNumericalPositionString(argPos + 1)} argument to be of type ${expectedArg.dataType}.` };
}

function validateArgumentsWithTypeMatching(): (arg: PossibleDataType, argPos: number, expectedArg: FormulaFunctionArgument, shouldTypeMatch: boolean) => ArgumentValidationResult {
  let matchType: PossibleDataType = "Undefined";
  return (arg: PossibleDataType, argPos: number, expectedArg: FormulaFunctionArgument, shouldMatchType: boolean) => {
    if (shouldMatchType && matchType === "Undefined")
      matchType = arg;

    const validation = isValidArgument(arg, argPos, expectedArg);
    if (!validation.isValid)
      return validation;

    const isValid = (matchType === "Undefined" || arg === matchType || (arg === "Undefined" && !!expectedArg.canBeUndefined));
    if (matchType !== "Undefined" && !isValid)
      return {
        isValid,
        matchingType: matchType,
        invalidReason: `Expected ${formatNumericalPositionString(argPos + 1)} argument to be of type ${matchType}.`,
      };

    return {
      isValid,
      matchingType: matchType,
      invalidReason: isValid ? undefined : `${formatNumericalPositionString(argPos + 1)} argument is invalid.`,
    };
  };
}

export function getFormulaFunctionReturnType(func: FormulaFunction, args: PossibleDataType[]): IResult<PossibleDataType> {
  const hasUnlimitedArguments = func.argumentCountBounds[1] === -1;
  if (args.length < func.argumentCountBounds[0])
    return { errorMessage: `Too few arguments received. Expected a minimum of ${func.argumentCountBounds[0]} argument(s)` };
  if (!hasUnlimitedArguments && args.length > func.argumentCountBounds[1])
    return { errorMessage: `Too many arguments received. Expected a maximum of ${func.argumentCountBounds[1]} argument(s)` };

  let returnType: PossibleDataType = func.returnType ?? "Undefined";
  const validationFunc = func.typesMatchFromIndex === undefined ? isValidArgument : validateArgumentsWithTypeMatching();

  for (let i = 0; i < args.length; i++) {
    const shouldTypeMatch = func.typesMatchFromIndex !== undefined && i >= func.typesMatchFromIndex;
    const expectedTypeIndex = hasUnlimitedArguments && i > func.argumentCountBounds[0] - 1 ? func.argumentCountBounds[0] - 1 : i;
    const expectedArg = func.expectedArguments[expectedTypeIndex];
    const validationResult = validationFunc(args[i], i, expectedArg, shouldTypeMatch);
    if (!validationResult.isValid)
      return { errorMessage: validationResult.invalidReason };

    if (func.isreturnTypeFromTypeMatch && shouldTypeMatch)
      returnType = validationResult.matchingType ?? "Undefined";
  }

  return { value: returnType };
}

function getNumericalFunction(name: string): FormulaFunction | undefined {
  switch (name) {
    case "abs": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "acos": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "acosh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "asin": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "asinh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "atan": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "atanh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "atan2": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "Number" }, { dataType: "Number" }], returnType: "Number" };
    case "cbrt": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "ceil": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "clz32": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "cos": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "cosh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "exp": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "expm1": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "floor": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "fround": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "hypot": return { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "Number" }, { dataType: "Number" }], returnType: "Number" };
    case "imul": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "Number" }, { dataType: "Number" }], returnType: "Number" };
    case "log": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "log1p": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "log10": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "log2": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "max": return { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "Number" }, { dataType: "Number" }], returnType: "Number" };
    case "min": return { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "Number" }, { dataType: "Number" }], returnType: "Number" };
    case "pow": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "Number" }, { dataType: "Number" }], returnType: "Number" };
    case "random": return { argumentCountBounds: [0, 0], expectedArguments: [], returnType: "Number" };
    case "round": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "sign": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "sin": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "sinh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "sqrt": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "tan": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "tanh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "trunc": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Number" }], returnType: "Number" };
    case "tonumber": return { argumentCountBounds: [1, 1], expectedArguments: [{ canBeAny: true }], returnType: "Number" };
    default: return undefined;
  }
}

function getStringFunction(name: string): FormulaFunction | undefined {
  switch (name) {
    case "charat": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String" }, { dataType: "Number" }], returnType: "String" };
    case "concat": return { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "String" }, { dataType: "String" }], returnType: "String" };
    case "padend": return { argumentCountBounds: [2, 3], expectedArguments: [{ dataType: "String" }, { dataType: "Number" }, { dataType: "String" }], returnType: "String" };
    case "padstart": return { argumentCountBounds: [2, 3], expectedArguments: [{ dataType: "String" }, { dataType: "Number" }, { dataType: "String" }], returnType: "String" };
    case "substring": return { argumentCountBounds: [2, 3], expectedArguments: [{ dataType: "String" }, { dataType: "Number" }, { dataType: "Number" }], returnType: "String" };
    case "indexof": return { argumentCountBounds: [2, 3], expectedArguments: [{ dataType: "String" }, { dataType: "String" }, { dataType: "Number" }], returnType: "Number" };
    case "tolowercase": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "String" }], returnType: "String" };
    case "touppercase": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "String" }], returnType: "String" };
    case "trim": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "String" }], returnType: "String" };
    case "trimend": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "String" }], returnType: "String" };
    case "trimstart": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "String" }], returnType: "String" };
    case "tostring": return { argumentCountBounds: [1, 1], expectedArguments: [{ canBeAny: true }], returnType: "String" };
    default: return undefined;
  }
}

function getConditionalFunction(name: string): FormulaFunction | undefined {
  switch (name) {
    case "if": return { argumentCountBounds: [3, 3], expectedArguments: [{ dataType: "Boolean" }, { canBeAny: true, canBeUndefined: true }, { canBeAny: true, canBeUndefined: true }], typesMatchFromIndex: 1, isreturnTypeFromTypeMatch: true };
    case "ifnull": return { argumentCountBounds: [2, 2], expectedArguments: [{ canBeAny: true, canBeUndefined: true }, { canBeAny: true }], typesMatchFromIndex: 0, isreturnTypeFromTypeMatch: true };
    case "ifnotnull": return { argumentCountBounds: [2, 2], expectedArguments: [{ canBeAny: true, canBeUndefined: true }, { canBeAny: true }], typesMatchFromIndex: 0, isreturnTypeFromTypeMatch: true };
    case "ifempty": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String" }, { dataType: "String" }], returnType: "String" };
    case "ifnotempty": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String" }, { dataType: "String" }], returnType: "String" };
    case "ifnullorempty": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String", canBeUndefined: true }, { dataType: "String" }], returnType: "String" };
    case "ifnotnullorempty": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String", canBeUndefined: true }, { dataType: "String" }], returnType: "String" };
    case "ifnullorwhitespace": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String", canBeUndefined: true }, { dataType: "String" }], returnType: "String" };
    case "ifnotnullorwhitespace": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String", canBeUndefined: true }, { dataType: "String" }], returnType: "String" };
    default: return undefined;
  }
}

function getBooleanFunction(name: string): FormulaFunction | undefined {
  switch (name) {
    case "isin": return { argumentCountBounds: [2, -1], expectedArguments: [{ canBeAny: true }, { canBeAny: true }], typesMatchFromIndex: 0, returnType: "Boolean"};
    case "toboolean": return { argumentCountBounds: [1, 1], expectedArguments: [{ canBeAny: true }], returnType: "Boolean"};
    default: return undefined;
  }
}

export function getFunction(name: string): FormulaFunction | undefined {
  const nameLowerCase = name.toLowerCase();
  return getNumericalFunction(nameLowerCase) || getStringFunction(nameLowerCase) || getConditionalFunction(nameLowerCase) || getBooleanFunction(nameLowerCase);
}

export function isFunction(name: string): boolean {
  return !!getFunction(name);
}

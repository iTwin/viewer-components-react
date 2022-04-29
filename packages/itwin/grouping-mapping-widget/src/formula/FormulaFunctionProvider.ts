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
  if (arg === "undefined") {
    isValid = !!expectedArg.canBeUndefined;
    return { isValid, invalidReason: isValid ? undefined : `Expected ${formatNumericalPositionString(argPos + 1)} argument to not be null.` };
  }

  isValid = expectedArg.canBeAny || arg === expectedArg.dataType;
  return { isValid, invalidReason: isValid ? undefined : `Expected ${formatNumericalPositionString(argPos + 1)} argument to be of type ${expectedArg.dataType}.` };
}

function validateArgumentsWithTypeMatching(): (arg: PossibleDataType, argPos: number, expectedArg: FormulaFunctionArgument, shouldTypeMatch: boolean) => ArgumentValidationResult {
  let matchType: PossibleDataType = "undefined";
  return (arg: PossibleDataType, argPos: number, expectedArg: FormulaFunctionArgument, shouldMatchType: boolean) => {
    if (shouldMatchType && matchType === "undefined")
      matchType = arg;

    const validation = isValidArgument(arg, argPos, expectedArg);
    if (!validation.isValid)
      return validation;

    const isValid = (matchType === "undefined" || arg === matchType || (arg === "undefined" && !!expectedArg.canBeUndefined));
    if (matchType !== "undefined" && !isValid)
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

  let returnType: PossibleDataType = func.returnType ?? "undefined";
  const validationFunc = func.typesMatchFromIndex === undefined ? isValidArgument : validateArgumentsWithTypeMatching();

  for (let i = 0; i < args.length; i++) {
    const shouldTypeMatch = func.typesMatchFromIndex !== undefined && i >= func.typesMatchFromIndex;
    const expectedTypeIndex = hasUnlimitedArguments && i > func.argumentCountBounds[0] - 1 ? func.argumentCountBounds[0] - 1 : i;
    const expectedArg = func.expectedArguments[expectedTypeIndex];
    const validationResult = validationFunc(args[i], i, expectedArg, shouldTypeMatch);
    if (!validationResult.isValid)
      return { errorMessage: validationResult.invalidReason };

    if (func.isreturnTypeFromTypeMatch && shouldTypeMatch)
      returnType = validationResult.matchingType ?? "undefined";
  }

  return { value: returnType };
}

function getNumericalFunction(name: string): FormulaFunction | undefined {
  switch (name) {
    case "abs": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "acos": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "acosh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "asin": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "asinh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "atan": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "atanh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "atan2": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "number" }, { dataType: "number" }], returnType: "number" };
    case "cbrt": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "ceil": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "clz32": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "cos": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "cosh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "exp": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "expm1": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "floor": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "fround": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "hypot": return { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "number" }, { dataType: "number" }], returnType: "number" };
    case "imul": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "number" }, { dataType: "number" }], returnType: "number" };
    case "log": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "log1p": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "log10": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "log2": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "max": return { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "number" }, { dataType: "number" }], returnType: "number" };
    case "min": return { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "number" }, { dataType: "number" }], returnType: "number" };
    case "pow": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "number" }, { dataType: "number" }], returnType: "number" };
    case "random": return { argumentCountBounds: [0, 0], expectedArguments: [], returnType: "number" };
    case "round": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "sign": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "sin": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "sinh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "sqrt": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "tan": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "tanh": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    case "trunc": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "number" }], returnType: "number" };
    default: return undefined;
  }
}

function getStringFunction(name: string): FormulaFunction | undefined {
  switch (name) {
    case "charat": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "string" }, { dataType: "number" }], returnType: "string" };
    case "concat": return { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "string" }, { dataType: "string" }], returnType: "string" };
    case "padend": return { argumentCountBounds: [2, 3], expectedArguments: [{ dataType: "string" }, { dataType: "number" }, { dataType: "string" }], returnType: "string" };
    case "padstart": return { argumentCountBounds: [2, 3], expectedArguments: [{ dataType: "string" }, { dataType: "number" }, { dataType: "string" }], returnType: "string" };
    case "substring": return { argumentCountBounds: [2, 3], expectedArguments: [{ dataType: "string" }, { dataType: "number" }, { dataType: "number" }], returnType: "string" };
    case "tolowercase": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "string" }], returnType: "string" };
    case "touppercase": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "string" }], returnType: "string" };
    case "trim": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "string" }], returnType: "string" };
    case "trimend": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "string" }], returnType: "string" };
    case "trimstart": return { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "string" }], returnType: "string" };
    default: return undefined;
  }
}

function getConditionalFunction(name: string): FormulaFunction | undefined {
  switch (name) {
    case "if": return { argumentCountBounds: [3, 3], expectedArguments: [{ dataType: "boolean" }, { canBeAny: true, canBeUndefined: true }, { canBeAny: true, canBeUndefined: true }], typesMatchFromIndex: 1, isreturnTypeFromTypeMatch: true };
    case "ifnull": return { argumentCountBounds: [2, 2], expectedArguments: [{ canBeAny: true, canBeUndefined: true }, { canBeAny: true }], typesMatchFromIndex: 0, isreturnTypeFromTypeMatch: true };
    case "ifnotnull": return { argumentCountBounds: [2, 2], expectedArguments: [{ canBeAny: true, canBeUndefined: true }, { canBeAny: true }], typesMatchFromIndex: 0, isreturnTypeFromTypeMatch: true };
    case "ifempty": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "string" }, { dataType: "string" }], returnType: "string" };
    case "ifnotempty": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "string" }, { dataType: "string" }], returnType: "string" };
    case "ifnullorempty": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "string", canBeUndefined: true }, { dataType: "string" }], returnType: "string" };
    case "ifnotnullorempty": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "string", canBeUndefined: true }, { dataType: "string" }], returnType: "string" };
    case "ifnullorwhitespace": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "string", canBeUndefined: true }, { dataType: "string" }], returnType: "string" };
    case "ifnotnullorwhitespace": return { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "string", canBeUndefined: true }, { dataType: "string" }], returnType: "string" };
    default: return undefined;
  }
}

export function getFunction(name: string): FormulaFunction | undefined {
  const nameLowerCase = name.toLowerCase();
  return getNumericalFunction(nameLowerCase) || getStringFunction(nameLowerCase) || getConditionalFunction(nameLowerCase);
}

export function isFunction(name: string): boolean {
  return !!getFunction(name);
}

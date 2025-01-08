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
  return {
    isValid,
    invalidReason: isValid ? undefined : `Expected ${formatNumericalPositionString(argPos + 1)} argument to be of type ${expectedArg.dataType}.`,
  };
}

function validateArgumentsWithTypeMatching(): (
  arg: PossibleDataType,
  argPos: number,
  expectedArg: FormulaFunctionArgument,
  shouldTypeMatch: boolean,
) => ArgumentValidationResult {
  let matchType: PossibleDataType = "Undefined";
  return (arg: PossibleDataType, argPos: number, expectedArg: FormulaFunctionArgument, shouldMatchType: boolean) => {
    if (shouldMatchType && matchType === "Undefined") matchType = arg;

    const validation = isValidArgument(arg, argPos, expectedArg);
    if (!validation.isValid) return validation;

    const isValid = matchType === "Undefined" || arg === matchType || (arg === "Undefined" && !!expectedArg.canBeUndefined);
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
    if (!validationResult.isValid) return { errorMessage: validationResult.invalidReason };

    if (func.isreturnTypeFromTypeMatch && shouldTypeMatch) returnType = validationResult.matchingType ?? "Undefined";
  }

  return { value: returnType };
}

const functions: Map<string, FormulaFunction> = new Map([
  // Numerical functions
  ["abs", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["acos", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["acosh", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["asin", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["asinh", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["atan", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["atanh", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["atan2", { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "Double" }, { dataType: "Double" }], returnType: "Double" }],
  ["cbrt", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["ceil", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["clz32", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["cos", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["cosh", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["exp", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["expm1", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["floor", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["fround", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["hypot", { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "Double" }, { dataType: "Double" }], returnType: "Double" }],
  ["imul", { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "Double" }, { dataType: "Double" }], returnType: "Double" }],
  ["log", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["log1p", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["log10", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["log2", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["max", { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "Double" }, { dataType: "Double" }], returnType: "Double" }],
  ["min", { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "Double" }, { dataType: "Double" }], returnType: "Double" }],
  ["pow", { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "Double" }, { dataType: "Double" }], returnType: "Double" }],
  ["random", { argumentCountBounds: [0, 0], expectedArguments: [], returnType: "Double" }],
  ["round", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["sign", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["sin", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["sinh", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["sqrt", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["tan", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["tanh", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["trunc", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "Double" }],
  ["tonumber", { argumentCountBounds: [1, 1], expectedArguments: [{ canBeAny: true }], returnType: "Double" }],

  // String functions
  ["charat", { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String" }, { dataType: "Double" }], returnType: "String" }],
  ["concat", { argumentCountBounds: [2, -1], expectedArguments: [{ dataType: "String" }, { dataType: "String" }], returnType: "String" }],
  ["padend", { argumentCountBounds: [2, 3], expectedArguments: [{ dataType: "String" }, { dataType: "Double" }, { dataType: "String" }], returnType: "String" }],
  ["padstart", { argumentCountBounds: [2, 3], expectedArguments: [{ dataType: "String" }, { dataType: "Double" }, { dataType: "String" }], returnType: "String" }],
  ["substring", { argumentCountBounds: [2, 3], expectedArguments: [{ dataType: "String" }, { dataType: "Double" }, { dataType: "Double" }], returnType: "String" }],
  ["indexof", { argumentCountBounds: [2, 3], expectedArguments: [{ dataType: "String" }, { dataType: "String" }, { dataType: "Double" }], returnType: "Double" }],
  ["tolowercase", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "String" }], returnType: "String" }],
  ["touppercase", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "String" }], returnType: "String" }],
  ["trim", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "String" }], returnType: "String" }],
  ["trimend", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "String" }], returnType: "String" }],
  ["trimstart", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "String" }], returnType: "String" }],
  ["tostring", { argumentCountBounds: [1, 1], expectedArguments: [{ canBeAny: true }], returnType: "String" }],

  // Conditional functions
  ["if", {
    argumentCountBounds: [3, 3],
    expectedArguments: [{ dataType: "Boolean" }, { canBeAny: true, canBeUndefined: true }, { canBeAny: true, canBeUndefined: true }],
    typesMatchFromIndex: 1,
    isreturnTypeFromTypeMatch: true,
  }],
  ["ifnull", {
    argumentCountBounds: [2, 2],
    expectedArguments: [{ canBeAny: true, canBeUndefined: true }, { canBeAny: true }],
    typesMatchFromIndex: 0,
    isreturnTypeFromTypeMatch: true,
  }],
  ["ifnotnull", {
    argumentCountBounds: [2, 2],
    expectedArguments: [{ canBeAny: true, canBeUndefined: true }, { canBeAny: true }],
    typesMatchFromIndex: 0,
    isreturnTypeFromTypeMatch: true,
  }],
  ["ifempty", { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String" }, { dataType: "String" }], returnType: "String" }],
  ["ifnotempty", { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String" }, { dataType: "String" }], returnType: "String" }],
  ["ifnullorempty", { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String", canBeUndefined: true }, { dataType: "String" }], returnType: "String" }],
  ["ifnotnullorempty", { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String", canBeUndefined: true }, { dataType: "String" }], returnType: "String" }],
  ["ifnullorwhitespace", { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String", canBeUndefined: true }, { dataType: "String" }], returnType: "String" }],
  ["ifnotnullorwhitespace", { argumentCountBounds: [2, 2], expectedArguments: [{ dataType: "String", canBeUndefined: true }, { dataType: "String" }], returnType: "String" }],

  // Boolean functions
  ["isin", { argumentCountBounds: [2, -1], expectedArguments: [{ canBeAny: true }, { canBeAny: true }], typesMatchFromIndex: 0, returnType: "Boolean" }],
  ["toboolean", { argumentCountBounds: [1, 1], expectedArguments: [{ canBeAny: true }], returnType: "Boolean" }],

  // Unit functions
  ["getpersistenceunit", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "String" }],
  ["getpresentationunits", { argumentCountBounds: [1, 1], expectedArguments: [{ dataType: "Double" }], returnType: "String" }],
]);

export function getFunction(name: string): FormulaFunction | undefined {
  const nameLowerCase = name.toLowerCase();
  return functions.get(nameLowerCase);
}

export function isFunction(name: string): boolean {
  return !!getFunction(name);
}

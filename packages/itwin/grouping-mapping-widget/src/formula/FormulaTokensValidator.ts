/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { getFormulaFunctionReturnType, getFunction } from "./FormulaFunctionProvider";
import { getOperatorArgumentCountBounds, getOperatorReturnType, isOperator } from "./FormulaOperatorsProvider";
import type { Token } from "./InfixToPostfixConverter";
import { TokenType } from "./InfixToPostfixConverter";
import type { Queue } from "./Queue";
import { Stack } from "./Stack";
import type { PossibleDataType, PropertyMap } from "./Types";

function isNumericalConstant(name: string): boolean {
  return [
    "e",
    "ln2",
    "ln10",
    "log2e",
    "log10e",
    "pi",
    "sqrt1_2",
    "sqrt2",
  ].includes(name.toLowerCase());
}

export function validateTokens(formulaName: string, tokens: Queue<Token>, properties: PropertyMap): string {
  if (tokens.length === 0)
    return "Formula cannot be empty.";

  const argStack = new Stack<PossibleDataType>();

  while (tokens.length > 0) {
    const token = tokens.dequeue()!;

    switch (token.type) {
      case TokenType.Number:
        argStack.push("number");
        break;
      case TokenType.String:
        argStack.push("string");
        break;
      case TokenType.Boolean:
        argStack.push("boolean");
        break;
      case TokenType.Null:
        argStack.push("undefined");
        break;
      case TokenType.Variable:
        const isConstant = isNumericalConstant(token.value);
        if (isConstant) {
          argStack.push("number");
        } else {
          if (token.value === formulaName)
            return "Formula cannot reference itself.";

          const prop = properties[token.value];
          if (!prop)
            return `Variable "${token.value}" is not available.`;

          argStack.push(prop);
        }
        break;
      case TokenType.Operator:
        if (!isOperator(token.value))
          return `Operator "${token.value}" is not supported.`;

        const operatorBounds = getOperatorArgumentCountBounds(token.value);
        if (!operatorBounds)
          return `Operator "${token.value}" is not supported.`;

        if (operatorBounds[0] === 2 && token.argCount === 1)
          return `Unary operator "${token.value}" is not supported.`;

        if (argStack.length < token.argCount) {
          return `Too few arguments given for ${token.argCount === 1 ? "unary" : "binary"} operator "${token.value}".`;
        }
        const opArgs = argStack.popN(token.argCount).reverse();
        let operationResult;
        if (opArgs.length === 1)
          operationResult = getOperatorReturnType(token.value, opArgs[0]);
        else if (opArgs.length === 2)
          operationResult = getOperatorReturnType(token.value, opArgs[0], opArgs[1]);
        else
          return `Operator "${token.value}" does not support ${token.argCount} operands.`;

        if (operationResult.errorMessage)
          return operationResult.errorMessage;
        else
          argStack.push(operationResult.value!);

        break;
      case TokenType.Function:
        const fnArg = getFunction(token.value);
        if (!fnArg)
          return `Function "${token.value}" is not supported.`;

        const fnArgBounds = fnArg.argumentCountBounds;
        if (fnArgBounds[0] === 0 && fnArgBounds[1] === 0 && token.argCount > 0) {
          return `Function "${token.value}" does not accept any arguments.`;
        } else if (fnArgBounds[1] === -1 && token.argCount < fnArgBounds[0]) {
          if (fnArgBounds[0] === 1) {
            return `Function "${token.value}" requires at least 1 argument.`;
          } else {
            if (token.argCount === 1) {
              return `Function "${token.value}" requires at least ${fnArgBounds[0]} arguments, but only 1 argument was given.`;
            } else {
              return `Function "${token.value}" requires at least ${fnArgBounds[0]} arguments, but only ${token.argCount} arguments were given.`;
            }
          }
        } else if (fnArgBounds[0] === fnArgBounds[1] && token.argCount !== fnArgBounds[0]) {
          if (fnArgBounds[0] === 1) {
            return `Function "${token.value}" requires exactly 1 argument, but ${token.argCount} arguments were given.`;
          } else {
            if (token.argCount === 1) {
              return `Function "${token.value}" requires exactly ${fnArgBounds[0]} arguments, but 1 argument was given.`;
            } else {
              return `Function "${token.value}" requires exactly ${fnArgBounds[0]} arguments, but ${token.argCount} arguments were given.`;
            }
          }
        }

        const fArgs = argStack.popN(token.argCount).reverse();
        if (fArgs.length < token.argCount) {
          return `Too few arguments given for function "${token.value}".`;
        }

        const functionResult = getFormulaFunctionReturnType(fnArg, fArgs);
        if (functionResult.errorMessage)
          return `Function "${token.value}" is invalid. ${functionResult.errorMessage}`;
        else
          argStack.push(functionResult.value!);

        break;
    }
  }

  if (argStack.length !== 1) {
    return "Formula is invalid.";
  }

  const resultType = argStack.pop();
  if (!resultType || resultType === "undefined") {
    return "Formula cannot always return null.";
  }

  return "";
}


/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { IResult } from "./IResult";
import type { DataType, PossibleDataType } from "./Types";

const allOperators = [
  "+",
  "-",
  "*",
  "%",
  "**",
  "/",
  "`",
  "~",
  "!",
  "@",
  "#",
  "$",
  "^",
  "&",
  "=",
  "[",
  "]",
  "{",
  "}",
  "\\",
  "|",
  ";",
  ":",
  "'",
  '"',
  "<",
  ">",
  "?",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "^=",
  "|=",
  "?=",
  "==",
  "!=",
  ">=",
  "<=",
  "++",
  "--",
  "<<",
  ">>",
  "&&",
  "||",
  "??",
  "?.",
  "**=",
  "<<=",
  ">>=",
  "&&=",
  "||=",
  "??=",
  "===",
  "!==",
  ">>>",
  ">>>=",
];

export enum OperatorType {
  UnaryPlus,
  UnaryNegation,
  Exponentiation,
  Multiplication,
  Division,
  Remainder,
  Addition,
  Subtraction,
  LogicalNot,
  LessThan,
  LessThanOrEqual,
  GreaterThan,
  GreaterThanOrEqual,
  Equality,
  Inequality,
  LogicalAnd,
  LogicalOr,
}

export enum OperatorAssociativity {
  Left,
  Right,
}

export function isOperator(token: string): boolean {
  return allOperators.includes(token);
}

export function getBinaryOperator(token: string): OperatorType | undefined {
  switch (token) {
    case "**":
      return OperatorType.Exponentiation;
    case "*":
      return OperatorType.Multiplication;
    case "/":
      return OperatorType.Division;
    case "%":
      return OperatorType.Remainder;
    case "+":
      return OperatorType.Addition;
    case "-":
      return OperatorType.Subtraction;
    case "<":
      return OperatorType.LessThan;
    case "<=":
      return OperatorType.LessThanOrEqual;
    case ">":
      return OperatorType.GreaterThan;
    case ">=":
      return OperatorType.GreaterThanOrEqual;
    case "==":
      return OperatorType.Equality;
    case "!=":
      return OperatorType.Inequality;
    case "&&":
      return OperatorType.LogicalAnd;
    case "||":
      return OperatorType.LogicalOr;
    default:
      return undefined;
  }
}

export function getUnaryOperator(token: string): OperatorType | undefined {
  switch (token) {
    case "+":
      return OperatorType.UnaryPlus;
    case "-":
      return OperatorType.UnaryNegation;
    case "!":
      return OperatorType.LogicalNot;
    default:
      return undefined;
  }
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
export function getOperatorPrecedence(op: OperatorType | undefined): number {
  switch (op) {
    case OperatorType.UnaryPlus:
    case OperatorType.UnaryNegation:
    case OperatorType.LogicalNot:
      return 15;
    case OperatorType.Exponentiation:
      return 14;
    case OperatorType.Multiplication:
    case OperatorType.Division:
    case OperatorType.Remainder:
      return 13;
    case OperatorType.Subtraction:
    case OperatorType.Addition:
      return 12;
    case OperatorType.LessThan:
    case OperatorType.LessThanOrEqual:
    case OperatorType.GreaterThan:
    case OperatorType.GreaterThanOrEqual:
      return 10;
    case OperatorType.Equality:
    case OperatorType.Inequality:
      return 9;
    case OperatorType.LogicalAnd:
      return 5;
    case OperatorType.LogicalOr:
      return 4;
    default:
      return 1;
  }
}

export function getOperatorAssociativity(op: OperatorType | undefined): number {
  switch (op) {
    case OperatorType.UnaryPlus:
    case OperatorType.UnaryNegation:
    case OperatorType.Exponentiation:
    case OperatorType.LogicalNot:
      return OperatorAssociativity.Right;
    case OperatorType.Multiplication:
    case OperatorType.Division:
    case OperatorType.Remainder:
    case OperatorType.Addition:
    case OperatorType.Subtraction:
    case OperatorType.LessThan:
    case OperatorType.LessThanOrEqual:
    case OperatorType.GreaterThan:
    case OperatorType.GreaterThanOrEqual:
    case OperatorType.Equality:
    case OperatorType.Inequality:
    case OperatorType.LogicalAnd:
    case OperatorType.LogicalOr:
      return OperatorAssociativity.Left;
    default:
      return OperatorAssociativity.Left;
  }
}

export function isSupportedOperator(token: string): boolean {
  return undefined !== getUnaryOperator(token) || undefined !== getBinaryOperator(token);
}

export function getOperatorArgumentCountBounds(token: string): [number, number] | undefined {
  switch (token) {
    case "**":
      return [2, 2];
    case "*":
      return [2, 2];
    case "/":
      return [2, 2];
    case "%":
      return [2, 2];
    case "+":
      return [1, 2];
    case "-":
      return [1, 2];
    case "!":
      return [1, 1];
    case "<":
      return [2, 2];
    case "<=":
      return [2, 2];
    case ">":
      return [2, 2];
    case ">=":
      return [2, 2];
    case "==":
      return [2, 2];
    case "!=":
      return [2, 2];
    case "&&":
      return [2, 2];
    case "||":
      return [2, 2];
    default:
      return undefined;
  }
}

export function getOperatorReturnType(token: string, arg1: PossibleDataType, arg2?: PossibleDataType): IResult<DataType> {
  if (!arg2 && !getUnaryOperator(token)) return { errorMessage: `Unary operator "${token}" is not supported.` };

  if (arg2 && !getBinaryOperator(token)) return { errorMessage: `Binary operator "${token}" is not supported.` };

  if ((arg1 === "Undefined" || arg2 === "Undefined") && token !== "==" && token !== "!=")
    return { errorMessage: `${!arg2 ? "Unary" : "Binary"} operator "${token}" does not support null operands.` };

  switch (token) {
    case "**":
    case "*":
    case "/":
    case "%":
      return arg1 === "String" || arg2 === "String" ? { errorMessage: `Binary operator "${token}" does not support string operands.` } : { value: "Double" };
    case "-":
      return arg1 === "String" || arg2 === "String"
        ? { errorMessage: `${!arg2 ? "Unary" : "Binary"} operator "${token}" does not support string operands.` }
        : { value: "Double" };
    case "+":
      if (!arg2) return { value: arg1 as DataType };
      else return arg1 === "String" || arg2 === "String" ? { value: "String" } : { value: "Double" };
    case "!":
    case "<":
    case "<=":
    case ">":
    case ">=":
    case "==":
    case "!=":
    case "&&":
    case "||":
      return { value: "Boolean" };
    default:
      return { errorMessage: `Operator "${token}" is not supported.` };
  }
}

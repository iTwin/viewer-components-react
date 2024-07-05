/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { isFunction } from "./FormulaFunctionProvider";
import {
  getBinaryOperator,
  getOperatorAssociativity,
  getOperatorPrecedence,
  getUnaryOperator,
  isOperator,
  isSupportedOperator,
  OperatorAssociativity,
} from "./FormulaOperatorsProvider";
import type { IResult } from "./IResult";
import { Queue } from "./Queue";
import { Stack } from "./Stack";
import { isStringDelimiter } from "./Utils";

function isNumber(part: string): boolean {
  return !isNaN(Number(part)) || !isNaN(parseFloat(part));
}

function isStringLiteral(token: string): boolean {
  if (token.length < 2) {
    return false;
  }

  const firstCharacter = token[0];
  const lastCharacter = token[token.length - 1];
  return firstCharacter === lastCharacter && isStringDelimiter(firstCharacter);
}

function isBoolean(token: string): boolean {
  const lower = token.toLowerCase();
  return lower === "true" || lower === "false";
}

function isNull(token: string): boolean {
  return token.toLowerCase() === "null";
}

export enum TokenType {
  Number = 0,
  Function = 1,
  Operator = 2,
  Variable = 3,
  String = 4,
  Boolean = 5,
  Null = 6,
}

enum InternalTokenType {
  Number = 0,
  Function = 1,
  Operator = 2,
  Variable = 3,
  OpeningParenthesis = 4,
  ClosingParenthesis = 5,
  ArgumentSeparator = 6,
  String = 7,
  Boolean = 8,
  Null = 9,
}

export interface Token {
  value: string;
  type: TokenType;
  argCount: number;
}

interface InternalToken {
  value: string;
  type: InternalTokenType;
  argCount: number;
  argCountIncremented: boolean;
}

function getExternalQueue(internal: Queue<InternalToken>): IResult<Queue<Token>> {
  const external = new Queue<Token>();
  while (internal.length > 0) {
    const t = internal.dequeue()!;

    switch (t.type) {
      case InternalTokenType.Number:
        external.enqueue({ value: t.value, type: TokenType.Number, argCount: t.argCount });
        break;
      case InternalTokenType.Function:
        external.enqueue({ value: t.value, type: TokenType.Function, argCount: t.argCount });
        break;
      case InternalTokenType.Operator:
        external.enqueue({ value: t.value, type: TokenType.Operator, argCount: t.argCount });
        break;
      case InternalTokenType.Variable:
        external.enqueue({ value: t.value, type: TokenType.Variable, argCount: t.argCount });
        break;
      case InternalTokenType.String:
        external.enqueue({ value: t.value, type: TokenType.String, argCount: t.argCount });
        break;
      case InternalTokenType.Boolean:
        external.enqueue({ value: t.value, type: TokenType.Boolean, argCount: t.argCount });
        break;
      case InternalTokenType.Null:
        external.enqueue({ value: t.value, type: TokenType.Null, argCount: t.argCount });
        break;
      default:
        return { errorMessage: `Missing closing parenthesis ")".` };
    }
  }

  return { value: external };
}

interface IConverterContext {
  resultQueue: Queue<InternalToken>;
  operatorStack: Stack<InternalToken>;
  currentToken: string;
  currentTokenType: InternalTokenType;
  previousToken?: string;
  previousTokenType?: InternalTokenType;
}

type TokenInterpreter = (ctx: IConverterContext) => IResult<boolean>;

function incrementArgCount(token: InternalToken) {
  if (!token.argCountIncremented) {
    token.argCount++;
    token.argCountIncremented = true;
  }
}

function addOperand(ctx: IConverterContext, type: InternalTokenType) {
  ctx.resultQueue.enqueue({ value: ctx.currentToken, type, argCount: 0, argCountIncremented: false });

  const currentOperators = ctx.operatorStack.peekN(2);
  const op1 = currentOperators[0];
  if (undefined !== op1) {
    incrementArgCount(op1);
    if (op1.argCount === 1) {
      const op2 = currentOperators[1];
      if (undefined !== op2 && op2.argCount !== 0) {
        incrementArgCount(op2);
      }
    }
  }
}

const addNumber: TokenInterpreter = (ctx: IConverterContext) => {
  addOperand(ctx, InternalTokenType.Number);
  return { value: true };
};

const addVariable: TokenInterpreter = (ctx: IConverterContext) => {
  ctx = { ...ctx, currentToken: ctx.currentToken.toLowerCase() };
  if (undefined !== ctx.previousToken && isNumber(ctx.previousToken)) {
    addOperator({ ...ctx, currentToken: "*" });
    addOperand({ ...ctx, previousToken: "*" }, InternalTokenType.Variable);
  } else {
    addOperand(ctx, InternalTokenType.Variable);
  }
  return { value: true };
};

const addFunction: TokenInterpreter = (ctx: IConverterContext) => {
  const currentOperator = ctx.operatorStack.peek();
  if (undefined !== currentOperator) {
    incrementArgCount(currentOperator);
  }

  ctx.operatorStack.push({ value: ctx.currentToken, type: InternalTokenType.Function, argCount: 0, argCountIncremented: false });
  return { value: true };
};

const addOperator: TokenInterpreter = (ctx: IConverterContext) => {
  if (!isSupportedOperator(ctx.currentToken)) {
    return { errorMessage: `Operator "${ctx.currentToken}" is not supported.` };
  }

  const binary = undefined !== ctx.previousToken && "(" !== ctx.previousToken && "," !== ctx.previousToken && !isOperator(ctx.previousToken);
  const unary = !binary;

  const op = unary ? getUnaryOperator(ctx.currentToken) : getBinaryOperator(ctx.currentToken);
  if (unary && undefined === op) {
    return { errorMessage: `Unary "${ctx.currentToken}" is not supported.` };
  }

  const o1 = ctx.currentToken;
  const o1Associativity = getOperatorAssociativity(op);
  const o1Precedence = getOperatorPrecedence(op);
  while (ctx.operatorStack.length > 0) {
    const o2 = ctx.operatorStack.peek()!;

    if (o2.value === "(") {
      break;
    }

    const o2Unary = o2.argCount === 0 || (o2.argCount === 1 && o2.argCountIncremented === true);
    const op2 = o2Unary ? getUnaryOperator(o2.value) : getBinaryOperator(o2.value);
    const o2Precedence = getOperatorPrecedence(op2);
    if (!(o2Precedence > o1Precedence || (o2Precedence === o1Precedence && o1Associativity === OperatorAssociativity.Left))) {
      break;
    }

    ctx.resultQueue.enqueue(ctx.operatorStack.pop()!);

    const currentOperator = ctx.operatorStack.peek();
    if (undefined !== currentOperator) {
      incrementArgCount(currentOperator);
    }
  }

  ctx.operatorStack.push({
    value: o1,
    type: InternalTokenType.Operator,
    argCount: binary ? 1 : 0,
    argCountIncremented: false,
  });

  return { value: true };
};

const openParenthesis: TokenInterpreter = (ctx: IConverterContext) => {
  if (undefined !== ctx.previousToken) {
    if (InternalTokenType.Number === ctx.previousTokenType || InternalTokenType.ClosingParenthesis === ctx.previousTokenType) {
      addOperator({ ...ctx, currentToken: "*" });
    } else if (InternalTokenType.Variable === ctx.previousTokenType) {
      return { errorMessage: `Function "${ctx.previousToken}" is not supported.` };
    }
  }

  const currentOperator = ctx.operatorStack.peek();
  if (undefined !== currentOperator && currentOperator.type !== InternalTokenType.Function) {
    incrementArgCount(currentOperator);
  }

  ctx.operatorStack.push({ value: "(", type: InternalTokenType.OpeningParenthesis, argCount: 0, argCountIncremented: false });
  return { value: true };
};

const closeParenthesis: TokenInterpreter = (ctx: IConverterContext) => {
  while (ctx.operatorStack.length > 0 && ctx.operatorStack.peek()!.value !== "(") {
    ctx.resultQueue.enqueue(ctx.operatorStack.pop()!);
  }

  const leftParenthesis = ctx.operatorStack.pop();
  if (undefined === leftParenthesis) {
    return { errorMessage: `Closing parenthesis ")" found, but the opening parenthesis "(" is missing.` };
  }

  const potentialFnToken = ctx.operatorStack.peek();
  if (undefined !== potentialFnToken && isFunction(potentialFnToken.value)) {
    potentialFnToken.argCount = leftParenthesis.argCount;
    ctx.resultQueue.enqueue(ctx.operatorStack.pop()!);
  }

  return { value: true };
};

const addString: TokenInterpreter = (ctx: IConverterContext) => {
  const withoutDelimiters = ctx.currentToken.substring(1, ctx.currentToken.length - 1);
  addOperand({ ...ctx, currentToken: withoutDelimiters }, InternalTokenType.String);
  return { value: true };
};

const addBoolean: TokenInterpreter = (ctx: IConverterContext) => {
  addOperand({ ...ctx, currentToken: ctx.currentToken.toLowerCase() }, InternalTokenType.Boolean);
  return { value: true };
};

const addNull: TokenInterpreter = (ctx: IConverterContext) => {
  addOperand({ ...ctx, currentToken: ctx.currentToken.toLowerCase() }, InternalTokenType.Null);
  return { value: true };
};

const separateFunctionArgumentSeparator: TokenInterpreter = (ctx: IConverterContext) => {
  while (ctx.operatorStack.length > 0 && ctx.operatorStack.peek()!.value !== "(") {
    ctx.resultQueue.enqueue(ctx.operatorStack.pop()!);

    const currentOperator = ctx.operatorStack.peek();
    if (undefined !== currentOperator) {
      incrementArgCount(currentOperator);
    }
  }

  const last2Operators = ctx.operatorStack.peekN(2);
  if (last2Operators.length < 2 || last2Operators[0].type !== InternalTokenType.OpeningParenthesis || last2Operators[1].type !== InternalTokenType.Function) {
    return { errorMessage: `Function argument separator "," found outside of a function call.` };
  }

  last2Operators[0].argCountIncremented = false;
  return { value: true };
};

function getTokenType(token: string, nextToken: string | undefined): InternalTokenType {
  if (isNumber(token)) {
    return InternalTokenType.Number;
  } else if (isStringLiteral(token)) {
    return InternalTokenType.String;
  } else if (isBoolean(token)) {
    return InternalTokenType.Boolean;
  } else if (isNull(token)) {
    return InternalTokenType.Null;
  } else if (isFunction(token) && "(" === nextToken) {
    return InternalTokenType.Function;
  } else if (isOperator(token)) {
    return InternalTokenType.Operator;
  } else if ("(" === token) {
    return InternalTokenType.OpeningParenthesis;
  } else if (")" === token) {
    return InternalTokenType.ClosingParenthesis;
  } else if ("," === token) {
    return InternalTokenType.ArgumentSeparator;
  } else {
    return InternalTokenType.Variable;
  }
}

const tokenInterpreters: Map<InternalTokenType, TokenInterpreter> = new Map([
  [InternalTokenType.Number, addNumber],
  [InternalTokenType.ArgumentSeparator, separateFunctionArgumentSeparator],
  [InternalTokenType.ClosingParenthesis, closeParenthesis],
  [InternalTokenType.Function, addFunction],
  [InternalTokenType.OpeningParenthesis, openParenthesis],
  [InternalTokenType.Operator, addOperator],
  [InternalTokenType.Variable, addVariable],
  [InternalTokenType.String, addString],
  [InternalTokenType.Boolean, addBoolean],
  [InternalTokenType.Null, addNull],
]);

export function convertInfixToPostfix(infix: string[]): IResult<Queue<Token>> {
  const resultQueue = new Queue<InternalToken>();
  const operatorStack = new Stack<InternalToken>();

  for (let index = 0; index < infix.length; index++) {
    const token = infix[index];

    const ctx: IConverterContext = {
      resultQueue,
      operatorStack,
      currentToken: token,
      currentTokenType: getTokenType(token, index < infix.length - 1 ? infix[index + 1] : undefined),
      previousToken: index > 0 ? infix[index - 1] : undefined,
      previousTokenType: index > 0 ? getTokenType(infix[index - 1], token) : undefined,
    };

    const fn = tokenInterpreters.get(ctx.currentTokenType)!;

    const tmpResult = fn(ctx);
    if (undefined === tmpResult.value) {
      return { errorMessage: tmpResult.errorMessage };
    }
  }

  while (operatorStack.length > 0) {
    resultQueue.enqueue(operatorStack.pop()!);

    const currentOperator = operatorStack.peek();
    if (undefined !== currentOperator) {
      incrementArgCount(currentOperator);
    }
  }

  return getExternalQueue(resultQueue);
}

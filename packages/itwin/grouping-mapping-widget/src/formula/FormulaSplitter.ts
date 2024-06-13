/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { InputStream } from "./InputStream";
import { StringBuilder } from "./StringBuilder";
import { isDecimalSeparator, isDigit, isLetterOrUnderscore, isStringDelimiter, isWhitespace } from "./Utils";

const fourSymbolCombinations = [">>>="];
const threeSymbolCombinations = ["**=", "<<=", ">>=", "&&=", "||=", "??=", "===", "!==", ">>>"];
const twoSymbolCombinations = [
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
  "**",
  "<<",
  ">>",
  "&&",
  "||",
  "??",
  "?.",
];
const oneSymbolCombinations = [
  "~",
  "!",
  "@",
  "#",
  "$",
  "%",
  "^",
  "&",
  "*",
  "(",
  ")",
  "-",
  "=",
  "+",
  "[",
  "]",
  "{",
  "}",
  "\\",
  "|",
  ";",
  ":",
  ",",
  ".",
  "<",
  ">",
  "/",
  "?",
];

const symbolCombinations: string[][] = [fourSymbolCombinations, threeSymbolCombinations, twoSymbolCombinations, oneSymbolCombinations];

function parseScientificNotation(stream: InputStream) {
  const notationBuilder = new StringBuilder();

  const nextChar = stream.next;
  const afterEChar = stream.peek;
  if (isDigit(afterEChar) || afterEChar === "+" || afterEChar === "-") {
    notationBuilder.push(nextChar);
    notationBuilder.push(stream.next);
    while (isDigit(stream.peek)) {
      notationBuilder.push(stream.next);
    }
    if (isDecimalSeparator(stream.peek)) {
      throw new Error("The exponent in scientific notation must be an integer.");
    }
  } else {
    stream.undo;
  }

  return notationBuilder.value;
}

function parseNumber(stream: InputStream): string {
  const numberBuilder = new StringBuilder(stream.current);
  let hasSeparator = isDecimalSeparator(stream.current);

  while (true) {
    const peekedChar = stream.peek;
    if (peekedChar.toLowerCase() === "e") {
      numberBuilder.push(parseScientificNotation(stream));
      break;
    }

    if (isDecimalSeparator(peekedChar)) {
      if (hasSeparator) {
        throw new Error("A number cannot have multiple decimal separators.");
      }
      hasSeparator = true;
      numberBuilder.push(stream.next);
      continue;
    }

    if (isDigit(peekedChar)) {
      numberBuilder.push(stream.next);
    } else {
      break;
    }
  }

  return numberBuilder.value;
}

function unescape(char: string): string {
  switch (char) {
    case "n":
      return "\n";
    case "t":
      return "\t";
    default:
      return char;
  }
}

function parseStringLiteral(stream: InputStream): string {
  const stringBuilder = new StringBuilder(stream.current);
  const delimiter = stream.current;

  while (stream.next !== delimiter) {
    if (stream.isEOF) {
      throw new Error(`Missing closing string delimiter (${delimiter}).`);
    }

    stringBuilder.push(stream.current === "\\" ? unescape(stream.next) : stream.current);
  }

  stringBuilder.push(stream.current);
  return stringBuilder.value;
}

function parseVariable(stream: InputStream): string {
  const variableBuilder = new StringBuilder(stream.current);

  while (isLetterOrUnderscore(stream.peek) || isDigit(stream.peek)) {
    variableBuilder.push(stream.next);
  }

  if (isDecimalSeparator(stream.peek)) {
    throw new Error("Decimal separator in variable.");
  }

  return variableBuilder.value;
}

function parseSymbolCombination(stream: InputStream): string {
  const symbolComboBuilder = new StringBuilder(stream.current);
  while (symbolComboBuilder.length < symbolCombinations.length && oneSymbolCombinations.includes(stream.peek)) {
    symbolComboBuilder.push(stream.next);
  }

  for (let i = symbolCombinations.length - symbolComboBuilder.length; i < symbolCombinations.length - 1; i++) {
    const symbolCombo = symbolComboBuilder.value;
    if (symbolCombinations[i].includes(symbolCombo)) {
      return symbolCombo;
    }
    symbolComboBuilder.pop();
    stream.undo;
  }

  return symbolComboBuilder.value;
}

function parseFormula(formula: string): string[] {
  const tokens: string[] = [];
  const stream = new InputStream(formula);
  while (!stream.isEOF) {
    const char = stream.next;
    if (isWhitespace(char)) {
      continue;
    }

    if (isDigit(char) || isDecimalSeparator(char)) {
      tokens.push(parseNumber(stream));
    } else if (isLetterOrUnderscore(char)) {
      tokens.push(parseVariable(stream));
    } else if (isStringDelimiter(char)) {
      tokens.push(parseStringLiteral(stream));
    } else if (oneSymbolCombinations.includes(char)) {
      tokens.push(parseSymbolCombination(stream));
    } else {
      throw new Error(`Unknown symbol received "${char}".`);
    }
  }

  return tokens;
}

export function splitFormula(formula: string): string[] {
  return parseFormula(formula);
}

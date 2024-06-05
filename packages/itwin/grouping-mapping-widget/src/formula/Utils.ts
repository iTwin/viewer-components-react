/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
export function isDigit(char: string): boolean {
  return /^\d/.test(char);
}

export function isLetterOrUnderscore(char: string): boolean {
  return /^[\p{L}_]/u.test(char);
}

export function isStringDelimiter(char: string): boolean {
  return ['"', "'", "`"].includes(char);
}

export function isWhitespace(char: string): boolean {
  return /^\s/.test(char);
}

export function isDecimalSeparator(char: string): boolean {
  return char === ".";
}

export function formatNumericalPositionString(num: number): string {
  const str = num.toString();
  if (str.endsWith("1") && num !== 11) return `${str}st`;
  if (str.endsWith("2") && num !== 12) return `${str}nd`;
  if (str.endsWith("3") && num !== 13) return `${str}rd`;

  return `${str}th`;
}

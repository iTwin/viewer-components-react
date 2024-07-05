/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Stack } from "./Stack";

export enum ParenthesisState {
  Valid = 0,
  NotClosed = 1,
  NotOpened = 2,
}

export function validateParenthesis(infixFormula: string): ParenthesisState {
  const s = new Stack<string>();
  for (const c of infixFormula) {
    if (c === "(") {
      s.push("(");
    } else if (c === ")") {
      if (s.peek() === undefined) {
        return ParenthesisState.NotOpened;
      }
      s.pop();
    }
  }
  if (s.length !== 0) {
    return ParenthesisState.NotClosed;
  }
  return ParenthesisState.Valid;
}

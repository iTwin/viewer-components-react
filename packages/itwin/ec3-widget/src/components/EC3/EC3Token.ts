/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * EC3 Token
 * @public
 */
export interface EC3Token {
  token: string;
  exp: number;
  source: string;
}

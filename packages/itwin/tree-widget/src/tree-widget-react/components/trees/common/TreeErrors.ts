/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Error that is thrown when too many matches are found while searching the tree.
 * @beta
 */
export class SearchLimitExceededError extends Error {
  public constructor(public readonly limit: number) {
    super("Too many search matches");
  }
}

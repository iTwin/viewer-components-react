/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Error that is thrown when too many matches are found while filtering the tree.
 * @beta
 */
export class FilterLimitExceededError extends Error {
  public constructor(public readonly limit: number) {
    super("Too many filter matches");
  }
}

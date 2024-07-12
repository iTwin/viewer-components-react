/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Error that is thrown when tree filtering exceeds a limit.
 * @beta
 */
export class FilterLimitExceededError extends Error {
  public constructor() {
    super("Too many filter matches");
  }
}

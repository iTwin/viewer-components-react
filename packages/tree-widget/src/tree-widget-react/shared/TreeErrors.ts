/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SearchLimitExceededError as TreeDefinitionsSearchLimitExceededError } from "@itwin/presentation-tree-definitions";

/**
 * Error that is thrown when too many matches are found while searching the tree.
 * @beta
 */
export class SearchLimitExceededError extends Error {
  public constructor(public readonly limit: number) {
    super("Too many search matches");
  }
}

/**
 * Re-throws `SearchLimitExceededError` of `@itwin/presentation-tree-definitions`, thrown while iterating the given
 * iterator, as tree widget's `SearchLimitExceededError`.
 * @internal
 */
export async function* mapSearchLimitExceededError<T>(iterator: AsyncIterableIterator<T>): AsyncIterableIterator<T> {
  try {
    yield* iterator;
  } catch (e) {
    if (e instanceof TreeDefinitionsSearchLimitExceededError) {
      throw new SearchLimitExceededError(e.limit);
    }
    throw e;
  }
}

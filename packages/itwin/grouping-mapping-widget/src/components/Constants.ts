/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export const STATUS_CHECK_INTERVAL = 5000;
export const ANIMATION_DELAY = "3s";
export const ANIMATION_DURATION = "1s";

// Types of error codes that get handled by query cache error handler.
export enum TErrCodes {
  QUERY_HILITE_FETCH_FAILED // Error code when failing to fetch hilite ids for a group.
}

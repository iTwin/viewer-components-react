/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import * as React from "react";
import { createContext } from "react";
import type { BulkExtractor } from "../components/BulkExtractor";

export type GetAccessTokenFn = () => Promise<AccessToken>;

export interface BulkExtractorContextProps {
  bulkExtractor?: BulkExtractor;
}

export const BulkExtractorContext = createContext<BulkExtractorContextProps>({});

export const useBulkExtractor = () => {
  const context = React.useContext(BulkExtractorContext);
  if (!context) {
    throw new Error("useBulkExtractor should be used within a BulkExtractorContext provider");
  }
  return context;
};

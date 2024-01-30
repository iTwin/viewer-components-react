/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

export interface ExtractionStatusJob {
  mappingIdJobInfo: Map<string, string>;
  setMappingIdJobInfo: (mappingIdJobInfo: Map<string, string> | ((mappingIdJobInfo: Map<string, string>) => Map<string, string>)) => void;
}

export const ExtractionStatusJobContext = React.createContext<ExtractionStatusJob>({
  mappingIdJobInfo: new Map(),
  setMappingIdJobInfo: () => { },
});

export const useExtractionStateJobContext = (): ExtractionStatusJob => {
  const context = React.useContext(ExtractionStatusJobContext);
  if (!context) {
    throw new Error(
      "useExtractionStateJobContext should be used within a ExtractionStatusJobContext provider"
    );
  }
  return context;
};

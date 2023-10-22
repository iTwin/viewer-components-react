/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createContext, useContext } from "react";

export interface ExtractionStatusData {
  iconStatus: "negative" | "positive" | "warning" | undefined;
  iconMessage: string;
}

export interface ExtractionMessageData {
  date: string;
  category: string;
  level: string;
  message: string;
}

export interface IExtractionStatusDataProps {
  extractionStatusIcon: ExtractionStatusData;
  extractionMessageData: ExtractionMessageData[];
  setExtractionStatusIcon: (extractionStatusIcon: ExtractionStatusData | ((extractionStatusIcon: ExtractionStatusData) => ExtractionStatusData)) => void;
  setExtractionMessageData: (extractionMessageData: ExtractionMessageData[]) => void;
}

export const ExtractionStatusDataContext = createContext<IExtractionStatusDataProps>({
  extractionStatusIcon: {
    iconStatus: undefined,
    iconMessage: "",
  },
  extractionMessageData: [],
  setExtractionStatusIcon: () => { },
  setExtractionMessageData: () => { },
});

export const useExtractionStatusDataContext = (): IExtractionStatusDataProps => {
  const context = useContext(ExtractionStatusDataContext);

  if(!context){
    throw new Error(
      "useExtractionStatusIconContext should be used within a ExtractionStatusIconContext provider"
    );
  }
  return context;
};

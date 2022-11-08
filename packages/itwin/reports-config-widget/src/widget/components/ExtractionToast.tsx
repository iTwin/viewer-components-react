/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { Text } from "@itwin/itwinui-react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";

interface ExtractionToastProps {
  iModelName: string;
  odataFeedUrl?: string;
}

export const SuccessfulExtractionToast = ({ iModelName, odataFeedUrl }: ExtractionToastProps) => {
  return (
    <div>
      <Text>{ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ExtractionSuccess")}{iModelName} </Text>
      <a href="javascript:;" onClick={async () => { await navigator.clipboard.writeText(odataFeedUrl!); }}>{ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:CopyODataUrl")}</a>
    </div>
  );
};

export const FailedExtractionToast = ({ iModelName }: ExtractionToastProps) => {
  return (
    <div>
      <Text>{ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ExtractionFailed")}{iModelName}</Text>
    </div>
  );
};

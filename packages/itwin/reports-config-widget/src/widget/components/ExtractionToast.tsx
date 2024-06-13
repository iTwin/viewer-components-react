/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { Text } from "@itwin/itwinui-react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";

interface SuccessfulExtractionToastProps extends ExtractionToastProps {
  odataFeedUrl: string;
}

interface ExtractionToastProps {
  iModelName: string;
}

export const SuccessfulExtractionToast = ({ iModelName, odataFeedUrl }: SuccessfulExtractionToastProps) => {
  const onClick = async (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault();
    await navigator.clipboard.writeText(odataFeedUrl);
  };
  return (
    <div>
      <Text>
        {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ExtractionSuccess")}
        {iModelName}
      </Text>
      <a href="#" onClick={onClick}>
        {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:CopyODataUrl")}
      </a>
    </div>
  );
};

export const FailedExtractionToast = ({ iModelName }: ExtractionToastProps) => {
  return (
    <div>
      <Text>
        {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ExtractionFailed")}
        {iModelName}
      </Text>
    </div>
  );
};

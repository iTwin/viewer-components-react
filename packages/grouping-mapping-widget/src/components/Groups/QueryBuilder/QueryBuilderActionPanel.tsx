/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import React from "react";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";

export interface QueryBuilderActionPanelProps {
  onClickNext: () => void;
  isNextDisabled?: boolean;
}

export const QueryBuilderActionPanel = ({ onClickNext, isNextDisabled }: QueryBuilderActionPanelProps) => {
  return (
    <Button styleType="high-visibility" id="save-app" onClick={onClickNext} disabled={isNextDisabled}>
      {GroupingMappingWidget.translate("common.next")}
    </Button>
  );
};

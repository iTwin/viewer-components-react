/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import React from "react";

export interface QueryBuilderActionPanelProps {
  onClickNext: () => void;
  isNextDisabled?: boolean;
}

export const QueryBuilderActionPanel = ({ onClickNext, isNextDisabled }: QueryBuilderActionPanelProps) => {
  return (
    <Button styleType="high-visibility" id="save-app" onClick={onClickNext} disabled={isNextDisabled}>
      Next
    </Button>
  );
};

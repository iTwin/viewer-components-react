/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import React from "react";

export interface QueryBuilderActionPanelProps {
  onClickNext: () => void;
}

export const QueryBuilderActionPanel = ({ onClickNext }: QueryBuilderActionPanelProps) => {
  return (
    <Button styleType="high-visibility" id="save-app" onClick={onClickNext}>
      Next
    </Button>
  );
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import React from "react";

export interface GroupDetailsActionPanelProps {
  isSaveDisabled: boolean;
  onClickBack: () => void;
  onClickSave: () => void;
}

export const GroupDetailsActionPanel = ({
  isSaveDisabled,
  onClickBack,
  onClickSave,
}: GroupDetailsActionPanelProps) => {
  return (
    <>
      <Button onClick={onClickBack}>Back</Button>
      <Button
        disabled={isSaveDisabled}
        styleType="high-visibility"
        onClick={onClickSave}
      >
        Save
      </Button>
    </>
  );
};

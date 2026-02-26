/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import React from "react";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";

export interface GroupDetailsActionPanelProps {
  isSaveDisabled: boolean;
  onClickBack: () => void;
  onClickSave: () => void;
}

export const GroupDetailsActionPanel = ({ isSaveDisabled, onClickBack, onClickSave }: GroupDetailsActionPanelProps) => {
  return (
    <>
      <Button onClick={onClickBack}>{GroupingMappingWidget.translate("common.back")}</Button>
      <Button disabled={isSaveDisabled} styleType="high-visibility" onClick={onClickSave}>
        {GroupingMappingWidget.translate("common.save")}
      </Button>
    </>
  );
};

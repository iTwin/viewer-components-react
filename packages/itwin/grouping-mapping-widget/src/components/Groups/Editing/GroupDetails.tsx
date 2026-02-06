/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { LabeledInput, Text } from "@itwin/itwinui-react";
import React from "react";
import type SimpleReactValidator from "simple-react-validator";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";
import { handleInputChange } from "../../../common/utils";
import { NAME_REQUIREMENTS } from "../../Properties/hooks/useValidator";

export interface GroupDetailsType {
  groupName: string;
  description: string;
}

export interface GroupDetailsProps {
  details: GroupDetailsType;
  setDetails: (newDetails: GroupDetailsType) => void;
  validator: SimpleReactValidator;
}

export const GroupDetails = ({ details, setDetails, validator }: GroupDetailsProps) => {
  return (
    <>
      <Text variant="small" as="small" className="gmw-field-legend">
        {GroupingMappingWidget.translate("common.mandatoryFields")}
      </Text>
      <LabeledInput
        id="groupName"
        name="groupName"
        label={GroupingMappingWidget.translate("common.name")}
        value={details.groupName}
        required
        onChange={(event) => {
          handleInputChange(event, details, setDetails);
          validator.showMessageFor("groupName");
        }}
        message={validator.message("groupName", details.groupName, NAME_REQUIREMENTS)}
        status={validator.message("groupName", details.groupName, NAME_REQUIREMENTS) ? "negative" : undefined}
        onBlur={() => {
          validator.showMessageFor("groupName");
        }}
        onBlurCapture={(event) => {
          handleInputChange(event, details, setDetails);
          validator.showMessageFor("groupName");
        }}
      />
      <LabeledInput
        id="description"
        name="description"
        label={GroupingMappingWidget.translate("common.description")}
        value={details.description}
        onChange={(event) => {
          handleInputChange(event, details, setDetails);
        }}
      />
    </>
  );
};

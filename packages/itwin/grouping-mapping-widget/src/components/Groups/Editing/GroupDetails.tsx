/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { LabeledInput, Text } from "@itwin/itwinui-react";
import React from "react";
import type SimpleReactValidator from "simple-react-validator";
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

export const GroupDetails = ({
  details,
  setDetails,
  validator,
}: GroupDetailsProps) => {
  return (
    <>
      <Text variant="small" as="small" className="gmw-field-legend">
        Asterisk * indicates mandatory fields.
      </Text>
      <LabeledInput
        id="groupName"
        name="groupName"
        label="Name"
        value={details.groupName}
        required
        onChange={(event) => {
          handleInputChange(event, details, setDetails);
          validator.showMessageFor("groupName");
        }}
        message={validator.message(
          "groupName",
          details.groupName,
          NAME_REQUIREMENTS,
        )}
        status={
          validator.message(
            "groupName",
            details.groupName,
            NAME_REQUIREMENTS,
          )
            ? "negative"
            : undefined
        }
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
        label="Description"
        value={details.description}
        onChange={(event) => {
          handleInputChange(event, details, setDetails);
        }}
      />
    </>
  );
};

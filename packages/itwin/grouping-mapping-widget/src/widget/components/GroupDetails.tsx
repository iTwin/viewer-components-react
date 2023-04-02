import { LabeledInput, Small } from "@itwin/itwinui-react";
import React from "react";
import type SimpleReactValidator from "simple-react-validator";
import { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleInputChange } from "./utils";

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
      <Small className="gmw-field-legend">
        Asterisk * indicates mandatory fields.
      </Small>
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

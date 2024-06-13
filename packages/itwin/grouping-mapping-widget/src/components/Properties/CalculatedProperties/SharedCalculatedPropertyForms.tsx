/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { CalculatedPropertyType } from "@itwin/insights-client";
import React, { useCallback } from "react";
import { NAME_REQUIREMENTS } from "../hooks/useValidator";
import type { SelectOption } from "@itwin/itwinui-react";
import { LabeledInput, LabeledSelect } from "@itwin/itwinui-react";
import type SimpleReactValidator from "simple-react-validator";

interface SharedCalculatedPropertyFormsProps {
  propertyName: string;
  setPropertyName: (value: string) => void;
  type: CalculatedPropertyType | undefined;
  setType: (value: CalculatedPropertyType | undefined) => void;
  validator: SimpleReactValidator;
  itemRenderer?: (option: SelectOption<string>) => JSX.Element;
  selectedItemRenderer?: (option: SelectOption<string>) => JSX.Element;
}

export const SharedCalculatedPropertyForms = ({
  propertyName,
  setPropertyName,
  type,
  setType,
  validator,
  itemRenderer,
  selectedItemRenderer,
}: SharedCalculatedPropertyFormsProps) => {
  const generateOptionsFromCalculatedPropertyType = useCallback(() => {
    const options: SelectOption<CalculatedPropertyType>[] = [];

    const indexableEnum = CalculatedPropertyType as unknown as { [key: string]: string };

    for (const key in indexableEnum) {
      if (typeof indexableEnum[key] === "string" && key !== "Undefined") {
        // Generate labels by adding space between capitals
        const label = key
          .replace(/([A-Z])/g, " $1")
          .trim()
          .replace(/^\w/, (c) => c.toUpperCase());
        options.push({ value: indexableEnum[key] as CalculatedPropertyType, label });
      }
    }
    return options;
  }, []);

  return (
    <>
      <LabeledInput
        value={propertyName}
        required
        name="name"
        label="Name"
        onChange={(event) => {
          setPropertyName(event.target.value);
          validator.showMessageFor("name");
        }}
        message={validator.message("name", propertyName, NAME_REQUIREMENTS)}
        status={validator.message("name", propertyName, NAME_REQUIREMENTS) ? "negative" : undefined}
        onBlur={() => {
          validator.showMessageFor("name");
        }}
        onBlurCapture={(event) => {
          setPropertyName(event.target.value);
          validator.showMessageFor("name");
        }}
      />
      <LabeledSelect<CalculatedPropertyType>
        label="Quantity Type"
        required
        options={generateOptionsFromCalculatedPropertyType()}
        value={type}
        onChange={setType}
        itemRenderer={itemRenderer}
        selectedItemRenderer={selectedItemRenderer}
        onShow={() => {}}
        onHide={() => {}}
      />
    </>
  );
};

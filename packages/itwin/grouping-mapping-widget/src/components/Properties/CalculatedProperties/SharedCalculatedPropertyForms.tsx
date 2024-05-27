/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  CalculatedPropertyType,
} from "@itwin/insights-client";
import React, { useCallback } from "react";
import type { SelectOption } from "@itwin/itwinui-react";
import { LabeledSelect } from "@itwin/itwinui-react";

interface SharedCalculatedPropertyFormsProps {
  calculatedPropertyType: CalculatedPropertyType | undefined;
  setCalculatedPropertyType: (value: CalculatedPropertyType | undefined) => void;
  itemRenderer?: (option: SelectOption<string | undefined>) => JSX.Element;
  selectedItemRenderer?: (option: SelectOption<string | undefined>) => JSX.Element;
}

export const SharedCalculatedPropertyForms = ({
  calculatedPropertyType,
  setCalculatedPropertyType,
  itemRenderer,
  selectedItemRenderer,
}: SharedCalculatedPropertyFormsProps) => {

  const generateOptionsFromCalculatedPropertyType = useCallback(() => {
    const options: SelectOption<CalculatedPropertyType | undefined>[] = [];

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
    options.push({value: undefined, label: "No Calculated Property Type"});
    return options;
  }, []);

  return (
    <>
      <LabeledSelect<CalculatedPropertyType | undefined>
        label="Calculated Property Type"
        options={generateOptionsFromCalculatedPropertyType()}
        value={calculatedPropertyType}
        onChange={setCalculatedPropertyType}
        itemRenderer={itemRenderer}
        selectedItemRenderer={selectedItemRenderer}
        placeholder = 'No Calculated Property Type'
        onShow={() => { }}
        onHide={() => { }}
      />
    </>
  );
};

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Alert, InputGroup, LabeledTextarea } from "@itwin/itwinui-react";
import React from "react";
import "./CustomCalculationAction.scss";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";

/**
 * Props for the {@link CustomCalculationAction} component.
 * @internal
 */
export interface CustomCalculationActionProps {
  formula?: string;
  setFormula: (formula: string | undefined) => void;
  formulaErrorMessage?: string;
  forceValidation: () => void;
  disabled?: boolean;
}

/**
 * Component to create or update a custom calculation property.
 * @internal
 */
export const CustomCalculationAction = ({ formula, setFormula, formulaErrorMessage, forceValidation, disabled }: CustomCalculationActionProps) => {
  return (
    <InputGroup className="gmw-custom-calculation-action-container">
      <Alert
        type="informational"
        clickableText={GroupingMappingWidget.translate("properties.formulaDocLink")}
        clickableTextProps={{
          href: "https://developer.bentley.com/apis/grouping-and-mapping/operations/create-property/#customcalculations",
          target: "_blank",
          rel: "noreferrer",
        }}
      >
        {GroupingMappingWidget.translate("properties.formulaDocMessage")}
      </Alert>
      <LabeledTextarea
        className="gmw-details-form"
        value={formula}
        name="formula"
        label={GroupingMappingWidget.translate("properties.formula")}
        disabled={disabled}
        onChange={(event) => {
          setFormula(event.target.value);
        }}
        message={formulaErrorMessage}
        status={formulaErrorMessage ? "negative" : undefined}
        onBlur={(event) => {
          if (event.target.textLength === 0) setFormula(undefined);
        }}
        onBlurCapture={() => {
          forceValidation();
        }}
      />
    </InputGroup>
  );
};

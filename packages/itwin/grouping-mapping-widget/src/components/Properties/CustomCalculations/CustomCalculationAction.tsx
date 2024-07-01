/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Alert, InputGroup, LabeledTextarea } from "@itwin/itwinui-react";
import React from "react";
import "./CustomCalculationAction.scss";

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
        clickableText="Click here."
        clickableTextProps={{
          href: "https://developer.bentley.com/apis/grouping-and-mapping/operations/create-property/#customcalculations",
          target: "_blank",
          rel: "noreferrer",
        }}
      >
        To learn more about creating custom calculation formulas, view the documentation.
      </Alert>
      <LabeledTextarea
        className="gmw-details-form"
        value={formula}
        name="formula"
        label="Formula"
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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Alert,
  ExpandableBlock,
  Icon,
  InputGroup,
  LabeledTextarea,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useRef } from "react";
import "./CustomCalculationAction.scss";
import { SvgFunction } from "@itwin/itwinui-icons-react";

/**
 * Props for the {@link CustomCalculationAction} component.
 * @public
 */
export interface CustomCalculationActionProps {
  formula?: string;
  setFormula: (formula: string | undefined) => void;
  formulaErrorMessage?: string;
  forceValidation: () => void;
  disabled?: boolean;
  parentRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Component to create or update a custom calculation property.
 * @public
 */
export const CustomCalculationAction = ({
  formula,
  setFormula,
  formulaErrorMessage,
  forceValidation,
  disabled,
  parentRef,
}: CustomCalculationActionProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const scrollToBlock = useCallback(() => {
    setTimeout(() => {
      if(ref.current && parentRef?.current){
        parentRef.current.scrollTo({
          top: ref.current.offsetTop,
          behavior: "smooth",
        });
      }
    }, 500);
  }, [parentRef]);

  useEffect(()=> {
    if(formulaErrorMessage){
      scrollToBlock();
    }
  }, [formulaErrorMessage, scrollToBlock]);

  return (
    <div ref={ref}>
      <ExpandableBlock
        title={"Custom Calculation"}
        endIcon={
          <Icon fill={formula ? "informational" : "default"}>
            <SvgFunction />
          </Icon>
        }
        isExpanded={formula ? true : false}
        onToggle={(isExpanding)=> {
          if(isExpanding === true)
            scrollToBlock();
        }}>
        <InputGroup
          className='gmw-custom-calculation-action-container'>
          <Alert
            type='informational'
            clickableText='Click here.'
            clickableTextProps={{ href: "https://developer.bentley.com/apis/grouping-and-mapping/operations/create-property/#customcalculations", target: "_blank", rel: "noreferrer" }}
          >
            To learn more about creating custom calculation formulas, view the documentation.
          </Alert>
          <LabeledTextarea
            className='gmw-details-form'
            value={formula}
            name='formula'
            label='Formula'
            disabled={disabled}
            onChange={(event) => {
              setFormula(event.target.value);
            }}
            message={formulaErrorMessage}
            status={formulaErrorMessage ? "negative" : undefined}
            onBlurCapture={() => {
              forceValidation();
            }}
          />
        </InputGroup>
      </ExpandableBlock>
    </div>
  );
};

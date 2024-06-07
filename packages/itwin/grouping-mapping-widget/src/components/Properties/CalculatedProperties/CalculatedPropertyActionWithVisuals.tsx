/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import type {
  SelectOption,
} from "@itwin/itwinui-react";
import {
  ExpandableBlock,
  Icon,
  InputGroup,
  MenuItem,
  ToggleSwitch,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BboxDimension,
  BboxDimensionsDecorator,
} from "../../../decorators/BboxDimensionsDecorator";
import { visualizeElements, zoomToElements } from "../../../common/viewerUtils";
import "./CalculatedPropertyActionWithVisuals.scss";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import type { CalculatedPropertyType, GroupMinimal} from "@itwin/insights-client";
import { SharedCalculatedPropertyForms } from "./SharedCalculatedPropertyForms";
import { useGroupKeySetQuery } from "../../Groups/hooks/useKeySetHiliteQueries";
import { SvgMeasure } from "@itwin/itwinui-icons-react";

/**
 * Props for the {@link CalculatedPropertyActionWithVisuals} component.
 * @public
 */
export interface CalculatedPropertyActionWithVisualsProps {
  group: GroupMinimal;
  calculatedPropertyType?: CalculatedPropertyType;
  isLoading?: boolean;
  setCalculatedPropertyType: (calculatedPropertyType: CalculatedPropertyType | undefined) => void;
  parentRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Component to create or update a calculated property with visualizations.
 * @public
 */
export const CalculatedPropertyActionWithVisuals = ({
  group,
  calculatedPropertyType,
  isLoading,
  setCalculatedPropertyType,
  parentRef,
}: CalculatedPropertyActionWithVisualsProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { iModelConnection } = useGroupingMappingApiConfig();
  if (!iModelConnection) {
    throw new Error("This component requires an active iModelConnection.");
  }

  const [bboxDecorator, setBboxDecorator] = useState<BboxDimensionsDecorator | undefined>();
  const [inferredSpatialData, setInferredSpatialData] = useState<Map<BboxDimension, number> | undefined>();
  const [colorProperty, setColorProperty] = useState<boolean>(false);
  const { data } = useGroupKeySetQuery(group, iModelConnection, true);

  const resolvedHiliteIds = useMemo(() => {
    // Resolved ids, default to an empty array if not available
    return data?.result?.ids ?? [];
  }, [data?.result?.ids]);

  useEffect(() => {
    const decorator = new BboxDimensionsDecorator();
    IModelApp.viewManager.addDecorator(decorator);
    setBboxDecorator(decorator);
    return () => {
      IModelApp.viewManager.dropDecorator(decorator);
    };
  }, []);

  useEffect(() => {
    if (!colorProperty || resolvedHiliteIds.length === 0) {
      return;
    }
    visualizeElements(resolvedHiliteIds, "red");
    void zoomToElements(resolvedHiliteIds);
  }, [calculatedPropertyType, colorProperty, resolvedHiliteIds]);

  useEffect(() => {
    if (!colorProperty || resolvedHiliteIds.length === 0) {
      return;
    }
    const setContext = async () => {
      if (bboxDecorator) {
        await bboxDecorator.setContext(resolvedHiliteIds[0]);
        setInferredSpatialData(bboxDecorator.getInferredSpatialData());
      }
    };
    void setContext();
  }, [bboxDecorator, calculatedPropertyType, colorProperty, resolvedHiliteIds]);

  useEffect(() => {
    if (bboxDecorator && calculatedPropertyType && inferredSpatialData) {
      inferredSpatialData.has(BboxDimension[calculatedPropertyType as keyof typeof BboxDimension]) && colorProperty
        ? bboxDecorator.drawContext(
          BboxDimension[calculatedPropertyType as keyof typeof BboxDimension],
        )
        : bboxDecorator.clearContext();
    } else {
      bboxDecorator?.clearContext();
    }
  }, [bboxDecorator, colorProperty, inferredSpatialData, calculatedPropertyType]);

  const getSpatialData = (value: string | undefined) =>
    value && inferredSpatialData?.has(
      BboxDimension[value as keyof typeof BboxDimension],
    ) && (
      <div>
        {`${inferredSpatialData
          ?.get(BboxDimension[value as keyof typeof BboxDimension])
          ?.toPrecision(4)}m`}
      </div>
    );

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

  return (
    <div ref={ref}>
      <ExpandableBlock title={"Calculated Property"}
        endIcon={
          <Icon fill={calculatedPropertyType ? "informational" : "default"}>
            <SvgMeasure />
          </Icon>
        }
        isExpanded={calculatedPropertyType ? true : false}
        onToggle={(isExpanding)=> {
          if(isExpanding === true)
            scrollToBlock();
        }}>
        <div className='gmw-calculated-properties-action-container'>
          <InputGroup className='gmw-details-form'>
            <ToggleSwitch
              className="gmw-field-legend-container"
              label='Visualize Dimensions'
              labelPosition='left'
              disabled={isLoading}
              checked={colorProperty}
              onChange={() => setColorProperty((b) => !b)}
            >
            </ToggleSwitch>
            <SharedCalculatedPropertyForms
              calculatedPropertyType={calculatedPropertyType}
              setCalculatedPropertyType={setCalculatedPropertyType}
              itemRenderer={(option: SelectOption<string | undefined>) => (
                <MenuItem>
                  <div className='gmw-gr-cp-menu-item'>
                    <div>{option.label}</div>
                    {getSpatialData(option.value)}
                  </div>
                </MenuItem>
              )}
              selectedItemRenderer={(option: SelectOption<string | undefined>) => (
                <div className='gmw-select-item'>
                  <div>{option.label}</div>
                  {getSpatialData(option.value)}
                </div>
              )}
            />
          </InputGroup>
        </div>
      </ExpandableBlock>
    </div>
  );
};

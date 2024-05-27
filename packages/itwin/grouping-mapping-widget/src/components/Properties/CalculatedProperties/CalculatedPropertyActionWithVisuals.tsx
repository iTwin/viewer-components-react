/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import type {
  SelectOption,
} from "@itwin/itwinui-react";
import {
  Fieldset,
  MenuItem,
  ToggleSwitch,
} from "@itwin/itwinui-react";
import React, { useEffect, useMemo, useState } from "react";
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

/**
 * Props for the {@link CalculatedPropertyActionWithVisuals} component.
 * @public
 */
export interface CalculatedPropertyActionWithVisualsProps {
  group: GroupMinimal;
  calculatedPropertyType?: CalculatedPropertyType;
  isLoading?: boolean;
  setCalculatedPropertyType: (calculatedPropertyType: CalculatedPropertyType | undefined) => void;
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
}: CalculatedPropertyActionWithVisualsProps) => {
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

  return (
    <div className='gmw-calculated-properties-action-container'>
      <Fieldset legend='Calculated Property Details' className='gmw-details-form'>
        <div className='gmw-field-legend-container'>
          <ToggleSwitch
            label='Visualize Dimensions'
            labelPosition='left'
            disabled={isLoading}
            checked={colorProperty}
            onChange={() => setColorProperty((b) => !b)}
          ></ToggleSwitch>
        </div>
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
      </Fieldset>
    </div>
  );
};

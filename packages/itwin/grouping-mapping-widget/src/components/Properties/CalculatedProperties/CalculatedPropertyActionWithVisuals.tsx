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
  Text,
  ToggleSwitch,
} from "@itwin/itwinui-react";
import React, { useEffect, useMemo, useState } from "react";
import ActionPanel from "../../SharedComponents/ActionPanel";
import {
  BboxDimension,
  BboxDimensionsDecorator,
} from "../../../decorators/BboxDimensionsDecorator";
import useValidator from "../hooks/useValidator";
import { visualizeElements, zoomToElements } from "../../../common/viewerUtils";
import "./CalculatedPropertyActionWithVisuals.scss";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { CalculatedPropertyType, DataType } from "@itwin/insights-client";
import type { Group, Property } from "@itwin/insights-client";
import { SharedCalculatedPropertyForms } from "./SharedCalculatedPropertyForms";
import { useGroupKeySetQuery } from "../../Groups/hooks/useKeySetHiliteQueries";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePropertiesClient } from "../../context/PropertiesClientContext";

export interface CalculatedPropertyActionWithVisualsProps {
  mappingId: string;
  group: Group;
  calculatedProperty?: Property;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
}

export const CalculatedPropertyActionWithVisuals = ({
  mappingId,
  group,
  calculatedProperty,
  onSaveSuccess,
  onClickCancel,
}: CalculatedPropertyActionWithVisualsProps) => {
  const { getAccessToken, iModelId, iModelConnection } = useGroupingMappingApiConfig();
  if (!iModelConnection) {
    throw new Error("This component requires an active iModelConnection.");
  }
  const propertiesClient = usePropertiesClient();
  const [propertyName, setPropertyName] = useState<string>(
    calculatedProperty?.propertyName ?? "",
  );
  const [type, setType] = useState<CalculatedPropertyType | undefined>(calculatedProperty?.calculatedPropertyType);
  const [bboxDecorator, setBboxDecorator] = useState<BboxDimensionsDecorator | undefined>();
  const [inferredSpatialData, setInferredSpatialData] = useState<Map<BboxDimension, number> | undefined>();
  const [validator, showValidationMessage] = useValidator();
  const [colorProperty, setColorProperty] = useState<boolean>(false);
  const { data } = useGroupKeySetQuery(group, iModelConnection, true);
  const queryClient = useQueryClient();

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
  }, [colorProperty, resolvedHiliteIds]);

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
  }, [bboxDecorator, colorProperty, resolvedHiliteIds]);

  useEffect(() => {
    if (bboxDecorator && type && inferredSpatialData) {
      inferredSpatialData.has(BboxDimension[type as keyof typeof BboxDimension]) && colorProperty
        ? bboxDecorator.drawContext(
          BboxDimension[type as keyof typeof BboxDimension],
        )
        : bboxDecorator.clearContext();
    }
  }, [bboxDecorator, colorProperty, inferredSpatialData, type]);

  const { mutate: saveMutation, isLoading } = useMutation(async (type: CalculatedPropertyType) => {
    const accessToken = await getAccessToken();

    return calculatedProperty
      ? propertiesClient.updateProperty(
        accessToken,
        mappingId,
        group.id,
        calculatedProperty.id,
        {
          propertyName,
          dataType: calculatedProperty.dataType,
          calculatedPropertyType: type,
        },
      )
      : propertiesClient.createProperty(
        accessToken,
        mappingId,
        group.id,
        {
          propertyName,
          dataType: DataType.Undefined,
          calculatedPropertyType: type,
        },
      );
  }, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calculatedProperties", iModelId, mappingId, group.id] });
      onSaveSuccess();
      setPropertyName("");
      setType(CalculatedPropertyType.Undefined);
    },
  });

  const onSave = () => {
    if (!validator.allValid() || !type) {
      showValidationMessage(true);
      return;
    }

    saveMutation(type);
  };

  const getSpatialData = (value: string) =>
    inferredSpatialData?.has(
      BboxDimension[value as keyof typeof BboxDimension],
    ) && (
      <div>
        {`${inferredSpatialData
          ?.get(BboxDimension[value as keyof typeof BboxDimension])
          ?.toPrecision(4)}m`}
      </div>
    );

  return (
    <>
      <div className='gmw-calculated-properties-action-container'>
        <Fieldset legend='Calculated Property Details' className='gmw-details-form'>
          <div className='gmw-field-legend-container'>
            <Text variant='small' as='small' className='gmw-field-legend'>
              Asterisk * indicates mandatory fields.
            </Text>
            <ToggleSwitch
              label='Visualize Dimensions'
              labelPosition='left'
              disabled={isLoading}
              checked={colorProperty}
              onChange={() => setColorProperty((b) => !b)}
            ></ToggleSwitch>
          </div>
          <SharedCalculatedPropertyForms
            validator={validator}
            propertyName={propertyName}
            setPropertyName={setPropertyName}
            type={type}
            setType={setType}
            itemRenderer={(option: SelectOption<string>) => (
              <MenuItem>
                <div className='gmw-gr-cp-menu-item'>
                  <div>{option.label}</div>
                  {getSpatialData(option.value)}
                </div>
              </MenuItem>
            )}
            selectedItemRenderer={(option: SelectOption<string>) => (
              <div className='gmw-select-item'>
                <div>{option.label}</div>
                {getSpatialData(option.value)}
              </div>
            )}
          />
        </Fieldset>
      </div>
      <ActionPanel
        onSave={onSave}
        onCancel={onClickCancel}
        isSavingDisabled={!(type && propertyName)}
        isLoading={isLoading}
      />
    </>
  );
};

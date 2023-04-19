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
  Small,
  ToggleSwitch,
} from "@itwin/itwinui-react";
import React, { useEffect, useState } from "react";
import ActionPanel from "./ActionPanel";
import {
  BboxDimension,
  BboxDimensionsDecorator,
} from "../../decorators/BboxDimensionsDecorator";
import useValidator from "../hooks/useValidator";
import { handleError } from "./utils";
import { clearEmphasizedOverriddenElements, visualizeElements, zoomToElements } from "./viewerUtils";
import "./CalculatedPropertyActionWithVisuals.scss";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import type { CalculatedProperty, Group } from "@itwin/insights-client";
import { CalculatedPropertyType } from "@itwin/insights-client";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { getHiliteIdsAndKeysetFromGroup } from "./groupsHelpers";
import { SharedCalculatedPropertyForms } from "./SharedCalculatedPropertyForms";

export interface CalculatedPropertyActionWithVisualsProps {
  mappingId: string;
  group: Group;
  calculatedProperty?: CalculatedProperty;
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
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [propertyName, setPropertyName] = useState<string>(
    calculatedProperty?.propertyName ?? "",
  );
  const iModelConnection = useActiveIModelConnection();
  const [type, setType] = useState<CalculatedPropertyType>(calculatedProperty?.type ?? CalculatedPropertyType.Undefined);
  const [bboxDecorator, setBboxDecorator] = useState<BboxDimensionsDecorator | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { hilitedElementsQueryCache } = useGroupHilitedElementsContext();
  const [inferredSpatialData, setInferredSpatialData] = useState<Map<BboxDimension, number> | undefined>();
  const [validator, showValidationMessage] = useValidator();
  const [resolvedHiliteIds, setResolvedHiliteIds] = useState<string[]>([]);
  const [colorProperty, setColorProperty] = useState<boolean>(false);

  useEffect(() => {
    const decorator = new BboxDimensionsDecorator();
    IModelApp.viewManager.addDecorator(decorator);
    setBboxDecorator(decorator);
    return () => {
      IModelApp.viewManager.dropDecorator(decorator);
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      if (!iModelConnection) return;
      clearEmphasizedOverriddenElements();
      if (!colorProperty) return;
      setIsLoading(true);
      const result = await getHiliteIdsAndKeysetFromGroup(iModelConnection, group, hilitedElementsQueryCache);
      setResolvedHiliteIds(result.ids);
      setIsLoading(false);
    };
    void initialize();
  }, [iModelConnection, hilitedElementsQueryCache, group, colorProperty]);

  useEffect(() => {
    if (!colorProperty || resolvedHiliteIds.length === 0) {
      return;
    }
    visualizeElements([resolvedHiliteIds[0]], "red");
    void zoomToElements([resolvedHiliteIds[0]]);
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

  const onSave = async () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    try {
      setIsLoading(true);

      const accessToken = await getAccessToken();

      calculatedProperty
        ? await mappingClient.updateCalculatedProperty(
          accessToken,
          iModelId,
          mappingId,
          group.id,
          calculatedProperty.id,
          {
            propertyName,
            type,
          },
        )
        : await mappingClient.createCalculatedProperty(
          accessToken,
          iModelId,
          mappingId,
          group.id,
          {
            propertyName,
            type,
          },
        );
      onSaveSuccess();
      setPropertyName("");
      setType(CalculatedPropertyType.Undefined);
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
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
            <Small className='gmw-field-legend'>
              Asterisk * indicates mandatory fields.
            </Small>
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

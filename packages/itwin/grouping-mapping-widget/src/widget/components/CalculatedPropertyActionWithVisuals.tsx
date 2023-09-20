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
import type { CalculatedProperty, CalculatedPropertyType, Group } from "@itwin/insights-client";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import { getHiliteIdsAndKeysetFromGroup } from "./groupsHelpers";
import { SharedCalculatedPropertyForms } from "./SharedCalculatedPropertyForms";
import { SaveValidationModal } from "./SaveValidationModal";
import type { invalids } from "./PropertyValidationUtils";
import { PropertyValidation } from "./PropertyValidationUtils";

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
  const { getAccessToken, iModelId, iModelConnection } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [propertyName, setPropertyName] = useState<string>(
    calculatedProperty?.propertyName ?? "",
  );
  const [type, setType] = useState<CalculatedPropertyType | undefined>(calculatedProperty?.type);
  const [bboxDecorator, setBboxDecorator] = useState<BboxDimensionsDecorator | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { hilitedElementsQueryCache } = useGroupHilitedElementsContext();
  const [inferredSpatialData, setInferredSpatialData] = useState<Map<BboxDimension, number> | undefined>();
  const [validator, showValidationMessage] = useValidator();
  const [resolvedHiliteIds, setResolvedHiliteIds] = useState<string[]>([]);
  const [colorProperty, setColorProperty] = useState<boolean>(false);
  const origPropertyName = calculatedProperty?.propertyName ?? "";
  const [showSaveValidationModal, setShowSaveValidationModal] = useState<boolean>(false);
  const [invalidCustomCalcs, setInvalidCustomCalcs] = useState<invalids[]>([]);

  async function checkOutliers(changedPropName: string): Promise<invalids[]> {
    const accessToken = await getAccessToken();
    const [customCalcProps] = await Promise.all([
      mappingClient.getCustomCalculations(accessToken, iModelId, mappingId, group.id),
    ]);
    const changes: invalids[] = await PropertyValidation({origPropertyName, changedPropertyName: changedPropName, customCalcProps});
    setInvalidCustomCalcs(changes);
    return Promise.resolve(changes);
  }

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

  const handleCustomCalcUpdate = async (customCalculation: {id: string, propertyName: string, formula: string}) => {
    try {
      const accessToken = await getAccessToken();
      const origCustomCalc = await mappingClient.getCustomCalculation(accessToken, iModelId, mappingId, group.id, customCalculation.id);
      await mappingClient.updateCustomCalculation(
        accessToken,
        iModelId,
        mappingId,
        group.id,
        customCalculation.id,
        {
          propertyName: customCalculation.propertyName,
          formula: customCalculation.formula,
          quantityType: origCustomCalc.quantityType,
        }
      );
    } catch (error: any) {
      if (error.status === 422) {
        error = error as Response;
        const erroredResponse = await error.json();
        if (
          erroredResponse.error.code === "InvalidInsightsRequest" &&
          erroredResponse.error.target === "formula"
        ) {}
      } else {
        handleError(error.status);
      }
    } finally {
    }
  };

  const onSave = async (selectedRows: {id: string, customCalcName: string, formula: string}[]) => {
    if (!validator.allValid() || !type) {
      showValidationMessage(true);
      return;
    }
    try {
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
      const promises: any[] = [];
      selectedRows.forEach(async (ele: {id: string, customCalcName: string, formula: string}) => {
        const customCalculation = {
          id: ele.id,
          propertyName: ele.customCalcName,
          formula: ele.formula,
        };
        promises.push(handleCustomCalcUpdate(customCalculation));
      });
      await Promise.all(promises);
      onSaveSuccess();
      setPropertyName("");
      setType(undefined);
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClick = async () => {
    if (!validator.allValid() || !type) {
      showValidationMessage(true);
      return;
    }
    if (origPropertyName !== propertyName && origPropertyName !== "") {
      const changedPropName = propertyName;
      const changes = await checkOutliers(changedPropName);
      if (changes.length > 0) {
        setShowSaveValidationModal(true);
      } else {
        await onSave([]);
      }
    } else {
      await onSave([]);
    }
  };

  const handleSaveValidationModal = async (rows: string) => {
    try {
      setIsLoading(true);
      let updatedRows: any = [];
      const selectedRows: {id: string, customCalcName: string, formula: string}[] = [];
      if (rows !== "") {
        updatedRows = JSON.parse(rows);
        if (updatedRows.length > 0) {
          updatedRows.forEach((ele: invalids) => {
            selectedRows.push({
              id: ele.id,
              customCalcName: ele.customCalcName,
              formula: ele.changedFormula,
            });
          });
        }
      } else {
        updatedRows = [];
      }
      await onSave(selectedRows);
    } catch (error: any) {
      handleError(error.status);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseSaveValidationModal = () => {
    setShowSaveValidationModal(false);
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
              onChange={() => setColorProperty((b: any) => !b)}
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
        onSave={handleSaveClick}
        onCancel={onClickCancel}
        isSavingDisabled={!(type && propertyName)}
        isLoading={isLoading}
      />
      <SaveValidationModal
        onSave={handleSaveValidationModal}
        onClose={handleCloseSaveValidationModal}
        showSaveValidationModal={showSaveValidationModal}
        invalidCustomCalcs={invalidCustomCalcs}
        setInvalidCustomCalcs={setInvalidCustomCalcs}
      />
    </>
  );
};

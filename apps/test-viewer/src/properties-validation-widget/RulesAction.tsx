/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Alert, Fieldset, Icon, LabeledInput, Text } from "@itwin/itwinui-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "./hooks/useValidator";
import { DataType } from "@itwin/insights-client";
import type { GroupMinimal, Property, PropertyModify } from "@itwin/insights-client";
import "./GroupPropertyAction.scss";
import { clearAll } from "./viewerUtils";
import { SaveModal } from "./SaveModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SvgFunction } from "@itwin/itwinui-icons-react";
import { handleError } from "./utils";
import { usePropertiesQuery } from "./hooks/usePropertiesQuery";
import { useFormulaValidation } from "./hooks/useFormulaValidation";
import { ScrollableExpandableBlock } from "./ScrollableExpandableBlock";
import { useGroupingMappingApiConfig, usePropertiesClient } from "@itwin/grouping-mapping-widget";
import { FunctionType, PropertiesValidationAction } from "./PropertiesValidation/PropertiesValidationAction";
import { ValidationRule } from "./PropertyTable/PropertyMenu";
import { aggregationFunctions } from "./PropertyTable/PropertyTable";

/**
 * Props for the {@link GroupPropertyAction} component.
 * @public
 */
export interface RulesActionProps {
  mappingId: string;
  group: GroupMinimal;
  rule?: ValidationRule;
  onSaveSuccess: (newRule: ValidationRule, oldRule: ValidationRule | undefined) => void;
  onClickCancel?: () => void;
}

/**
 * Component to create or update a group.
 * @public
 */
export const RulesAction = ({ mappingId, group, rule, onSaveSuccess, onClickCancel }: RulesActionProps) => {
  const actionContainerRef = useRef<HTMLDivElement>(null);
  const propertiesValidationActionRef = useRef<HTMLDivElement>(null);
  const propertiesClient = usePropertiesClient();
  const queryClient = useQueryClient();

  const [propertyName, setPropertyName] = useState<string>("");
  const [oldPropertyName, setOldPropertyName] = useState<string>("");
  const [propertyDescription, setPropertyDescription] = useState<string>("");
  const [selectedProperty, setSelectedProperty] = useState<Property | undefined>(undefined);
  const [selectedFunction, setSelectedFunction] = useState<FunctionType | undefined>(undefined);
  const [minValue, setMinValue] = useState<number | undefined>(undefined);
  const [maxValue, setMaxValue] = useState<number | undefined>(undefined);
  const [propertiesNotFoundAlert, setPropertiesNotFoundAlert] = useState<boolean>(false);
  const [validator, showValidationMessage] = useValidator();
  const [showSaveConfirmationModal, setShowSaveConfirmationModal] = useState<boolean>(false);
  const [formula, setFormula] = useState<string | undefined>(rule?.property.formula ?? undefined);
  const [formulaErrorMessage, setFormulaErrorMessage] = useState<string | undefined>(undefined);
  const [dataType, setDataType] = useState<DataType>(DataType.Boolean);

  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const { data: groupProperties, isFetching: isLoadingGroupProperties } = usePropertiesQuery(iModelId, mappingId, group.id, getAccessToken, propertiesClient);
  const { forceValidation } = useFormulaValidation(propertyName.toLowerCase(), formula, groupProperties?.properties ?? [], setFormulaErrorMessage, dataType);

  const reset = useCallback(() => {
    setPropertyName("");
    setPropertyDescription("");
    setFormula(undefined);
    setSelectedProperty(undefined);
    setSelectedFunction(undefined);
    setMinValue(undefined);
    setMaxValue(undefined);
  }, []);

  useEffect(() => {
    if (rule) {
      setPropertyName(rule.name);
      setOldPropertyName(rule.name);
      setPropertyDescription(rule.description);
      setSelectedProperty(rule.onProperty);
      setSelectedFunction(rule.function);
      setMinValue(rule.min);
      setMaxValue(rule.max);
    }
  }, [rule]);

  useEffect(() => {
    const isAgg = aggregationFunctions.includes(selectedFunction ?? FunctionType.AtLeast);
    setDataType(isAgg ? DataType.Double : DataType.Boolean);
  }, [selectedFunction]);

  const { mutate: onSave, isLoading: isSaving } = useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      const newGroupProperty: PropertyModify = {
        propertyName,
        dataType: dataType,
        formula,
      };

      return rule
        ? propertiesClient.updateProperty(accessToken, mappingId, group.id, rule.property.id, newGroupProperty)
        : propertiesClient.createProperty(accessToken, mappingId, group.id, newGroupProperty);
    },
    onSuccess: async (data) => {
      const newRule: ValidationRule = {
        name: propertyName,
        description: propertyDescription,
        onProperty: selectedProperty ?? data,
        property: data,
        function: selectedFunction ?? FunctionType.AtLeast,
        min: minValue,
        max: maxValue,
      };
      onSaveSuccess(newRule, rule);
      reset();
      await queryClient.invalidateQueries(["properties", iModelId, mappingId, group.id]);
    },
    onError(error: any) {
      handleError(error.status);
    },
  });

  const handleSaveClick = async () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    if (oldPropertyName !== propertyName && oldPropertyName !== "") {
      setShowSaveConfirmationModal(true);
    } else {
      onSave();
    }
  };

  const handleCloseSaveModal = () => {
    setShowSaveConfirmationModal(false);
  };

  const isLoading = isSaving || isLoadingGroupProperties;

  return (
    <>
      <div className="gmw-group-property-action-container" ref={actionContainerRef}>
        <Fieldset disabled={isLoading} className="gmw-property-options" legend="Property Details">
          <Text variant="small" as="small" className="gmw-field-legend">
            Asterisk * indicates mandatory fields.
          </Text>
          <LabeledInput
            id="propertyName"
            label="Property Name"
            value={propertyName}
            required
            onChange={(event) => {
              setPropertyName(event.target.value);
              validator.showMessageFor("propertyName");
            }}
            message={validator.message("propertyName", propertyName, NAME_REQUIREMENTS)}
            status={validator.message("propertyName", propertyName, NAME_REQUIREMENTS) ? "negative" : undefined}
            onBlur={() => {
              validator.showMessageFor("propertyName");
            }}
          />
          <LabeledInput
            id="propertyDescription"
            label="Property Description"
            value={propertyDescription}
            onChange={(event) => {
              setPropertyDescription(event.target.value);
            }}
          />
        </Fieldset>
        {propertiesNotFoundAlert && (
          <Alert type="warning">
            Warning: Could not match saved properties from the current generated list. It does not confirm or deny validity. Overwriting will occur if a new
            selection is made and saved.
          </Alert>
        )}
        <ScrollableExpandableBlock
          parentRef={actionContainerRef}
          ref={propertiesValidationActionRef}
          title={"Properties Validation"}
          endIcon={
            <Icon fill={formula ? "informational" : "default"}>
              <SvgFunction />
            </Icon>
          }
          isExpanded
          setIsExpanded={() => {}}
        >
          <PropertiesValidationAction
            propertyName={propertyName}
            properties={groupProperties?.properties ?? []}
            minValue={minValue}
            maxValue={maxValue}
            setFormula={setFormula}
            selectedFunction={selectedFunction}
            selectedProperty={selectedProperty}
            setSelectedFunction={setSelectedFunction}
            setSelectedProperty={setSelectedProperty}
            setMaxValue={setMaxValue}
            setMinValue={setMinValue}
          />
        </ScrollableExpandableBlock>
      </div>
      <ActionPanel
        onSave={handleSaveClick}
        onCancel={onClickCancel}
        onSaveCapture={clearAll}
        onCancelCapture={clearAll}
        isLoading={isLoading}
        isSavingDisabled={!propertyName || formulaErrorMessage !== undefined}
      />
      <SaveModal onSave={onSave} onClose={handleCloseSaveModal} showSaveModal={showSaveConfirmationModal} />
    </>
  );
};

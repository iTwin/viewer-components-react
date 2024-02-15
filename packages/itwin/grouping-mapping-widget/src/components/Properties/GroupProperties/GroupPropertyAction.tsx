/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyValueFormat } from "@itwin/presentation-common";
import type { SelectOption } from "@itwin/itwinui-react";
import {
  Alert,
  Button,
  Fieldset,
  LabeledInput,
  LabeledSelect,
  Text,
} from "@itwin/itwinui-react";
import React, { useCallback, useState } from "react";
import ActionPanel from "../../SharedComponents/ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { useMappingClient } from "../../context/MappingClientContext";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { HorizontalTile } from "../../SharedComponents/HorizontalTile";
import { DataType, QuantityType } from "@itwin/insights-client";
import type {
  Group,
  GroupProperty,
  GroupPropertyCreate,
} from "@itwin/insights-client";
import "./GroupPropertyAction.scss";
import type { PropertyMetaData } from "./GroupPropertyUtils";
import {
  convertPresentationFields,
  convertToECProperties,
  fetchPresentationDescriptor,
  findProperties,
} from "./GroupPropertyUtils";
import { manufactureKeys } from "../../../common/viewerUtils";
import { SaveModal } from "./SaveModal";
import { GroupsPropertiesSelectionModal } from "./GroupsPropertiesSelectionModal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface GroupPropertyActionProps {
  mappingId: string;
  group: Group;
  groupProperty?: GroupProperty;
  onSaveSuccess: () => void;
  onClickCancel?: () => void;
}

export const quantityTypesSelectionOptions: SelectOption<QuantityType>[] = [
  { value: QuantityType.Area, label: "Area" },
  { value: QuantityType.Distance, label: "Distance" },
  { value: QuantityType.Force, label: "Force" },
  { value: QuantityType.Mass, label: "Mass" },
  { value: QuantityType.Monetary, label: "Monetary" },
  { value: QuantityType.Time, label: "Time" },
  { value: QuantityType.Volume, label: "Volume" },
  { value: QuantityType.Undefined, label: "No Quantity Type" },
];

export const GroupPropertyAction = ({
  mappingId,
  group,
  groupProperty,
  onSaveSuccess,
  onClickCancel,
}: GroupPropertyActionProps) => {
  const { getAccessToken, iModelId, iModelConnection } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [propertyName, setPropertyName] = useState<string>("");
  const [oldPropertyName, setOldPropertyName] = useState<string>("");
  const [dataType, setDataType] = useState<DataType>(DataType.Undefined);
  const [quantityType, setQuantityType] = useState<QuantityType>(QuantityType.Undefined);
  const [selectedProperties, setSelectedProperties] = useState<PropertyMetaData[]>([]);
  const [propertiesMetaData, setPropertiesMetaData] = useState<PropertyMetaData[]>([]);
  const [propertiesNotFoundAlert, setPropertiesNotFoundAlert] = useState<boolean>(false);
  const [validator, showValidationMessage] = useValidator();
  const [showPropertiesSelectionModal, setShowPropertiesSelectionModal] = useState<boolean>(false);
  const [showSaveConfirmationModal, setShowSaveConfirmationModal] = useState<boolean>(false);
  const queryClient = useQueryClient();

  const reset = useCallback(() => {
    setPropertyName("");
    setDataType(DataType.Undefined);
    setSelectedProperties([]);
  }, []);

  // useEffect(() => {
  //   const generateProperties = async () => {
  //     setIsLoading(true);

  //     if (!iModelConnection) return;

  //     const result = await manufactureKeys(group.query, iModelConnection);

  //     const descriptor = await fetchPresentationDescriptor(iModelConnection, result);

  //     // Only allow primitives and structs
  //     const propertyFields =
  //       descriptor?.fields.filter(
  //         (field) =>
  //           field.type.valueFormat === PropertyValueFormat.Primitive ||
  //           field.type.valueFormat === PropertyValueFormat.Struct
  //       ) ?? [];

  //     const propertiesMetaData = convertPresentationFields(propertyFields);

  //     setPropertiesMetaData(propertiesMetaData);

  //     if (groupProperty) {
  //       const accessToken = await getAccessToken();
  //       let response: GroupProperty | undefined;
  //       try {
  //         response = await mappingClient.getGroupProperty(
  //           accessToken,
  //           iModelId,
  //           mappingId,
  //           group.id,
  //           groupProperty.id
  //         );

  //         setPropertyName(response.propertyName);
  //         setOldPropertyName(response.propertyName);
  //         setDataType(response.dataType);
  //         setQuantityType(response.quantityType);
  //         const properties = findProperties(response.ecProperties, propertiesMetaData);
  //         if (properties.length === 0) {
  //           setPropertiesNotFoundAlert(true);
  //         }

  //         setSelectedProperties(properties);
  //       } catch (error: any) {
  //         handleError(error.status);
  //       }
  //     }

  //     setIsLoading(false);
  //   };
  //   void generateProperties();
  // }, [getAccessToken, mappingClient, iModelConnection, iModelId, groupProperty, mappingId, group]);

  const fetchProperties = useCallback(async () => {
    if (!iModelConnection) return;

    const result = await manufactureKeys(group.query, iModelConnection);
    const descriptor = await fetchPresentationDescriptor(iModelConnection, result);

    // Only allow primitives and structs
    const propertyFields = descriptor?.fields.filter(
      (field) =>
        field.type.valueFormat === PropertyValueFormat.Primitive ||
        field.type.valueFormat === PropertyValueFormat.Struct
    ) ?? [];

    const propertiesMetaData = convertPresentationFields(propertyFields);

    let groupPropertyDetails = null;
    if (groupProperty) {
      const accessToken = await getAccessToken();
      groupPropertyDetails = await mappingClient.getGroupProperty(
        accessToken,
        iModelId,
        mappingId,
        group.id,
        groupProperty.id
      );
    }

    return { propertiesMetaData, groupPropertyDetails };
  }, [getAccessToken, group.id, group.query, groupProperty, iModelConnection, iModelId, mappingClient, mappingId]);

  const onSuccess = useCallback((data) => {
    setPropertiesMetaData(data.propertiesMetaData);

    if (data.groupPropertyDetails) {
      const { propertyName, dataType, quantityType, ecProperties } = data.groupPropertyDetails;
      setPropertyName(propertyName);
      setOldPropertyName(propertyName);
      setDataType(dataType);
      setQuantityType(quantityType);

      const properties = findProperties(ecProperties, data.propertiesMetaData);
      if (properties.length === 0) {
        setPropertiesNotFoundAlert(true);
      }

      setSelectedProperties(properties);
    }
  }, []);

  const { isLoading: isLoadingProperties } = useQuery(["properties", iModelId, mappingId, group.id], fetchProperties, {
    onSuccess,
  });

  const { mutate: onSave, isLoading: isSaving } = useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      const newGroupProperty: GroupPropertyCreate = {
        propertyName,
        dataType,
        quantityType,
        ecProperties: selectedProperties.map((p) => convertToECProperties(p)).flat(),
      };

      return groupProperty
        ? mappingClient.updateGroupProperty(
          accessToken,
          iModelId,
          mappingId,
          group.id,
          groupProperty.id,
          newGroupProperty
        )
        : mappingClient.createGroupProperty(
          accessToken,
          iModelId,
          mappingId,
          group.id,
          newGroupProperty
        );
    },
    onSuccess: async () => {
      onSaveSuccess();
      reset();
      await queryClient.invalidateQueries(["groupProperties"]);
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

  const isLoading = isLoadingProperties || isSaving;

  return (
    <>
      <div className='gmw-group-property-action-container'>
        <Fieldset disabled={isLoading} className='gmw-property-options' legend='Property Details'>
          <Text variant='small' as='small' className='gmw-field-legend'>
            Asterisk * indicates mandatory fields.
          </Text>
          <LabeledInput
            id='propertyName'
            label='Property Name'
            value={propertyName}
            required
            onChange={(event) => {
              setPropertyName(event.target.value);
              validator.showMessageFor("propertyName");
            }}
            message={validator.message(
              "propertyName",
              propertyName,
              NAME_REQUIREMENTS
            )}
            status={
              validator.message("propertyName", propertyName, NAME_REQUIREMENTS)
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("propertyName");
            }}
          />
          <LabeledSelect<DataType>
            label={"Data Type"}
            id='dataType'
            options={[
              { value: DataType.Boolean, label: "Boolean" },
              { value: DataType.Number, label: "Number" },
              { value: DataType.String, label: "String" },
            ]}
            required
            value={dataType}
            onChange={(value) => {
              validator.showMessageFor("dataType");
              setDataType(value);
            }}
            message={validator.message("dataType", propertyName, "required")}
            status={
              validator.message("dataType", propertyName, "required")
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("dataType");
            }}
            onShow={() => { }}
            onHide={() => { }}
          />
          <LabeledSelect<QuantityType>
            label='Quantity Type'
            options={quantityTypesSelectionOptions}
            value={quantityType}
            onChange={setQuantityType}
            onShow={() => { }}
            onHide={() => { }}
          />
        </Fieldset>
        {propertiesNotFoundAlert &&
          <Alert type="warning">
            Warning: Could not match saved properties from the current generated list. It does not confirm or deny validity. Overwriting will occur if a new selection is made and saved.
          </Alert>
        }
        <Fieldset className='gmw-property-view-container' legend="Mapped Properties">
          <div className="gmw-property-view-button">
            <Button
              onClick={async () => setShowPropertiesSelectionModal(true)}
              disabled={isLoading}
            >
              Select Properties
            </Button>
          </div>
          <div className="gmw-properties-list">
            {selectedProperties.length === 0 && !isLoading ?
              <div className="gmw-empty-selection">
                <Text>No properties selected.</Text>
                <Text>Press the &quot;Select Properties&quot; button for options.</Text>
              </div> :
              selectedProperties.map((property) => (
                <HorizontalTile
                  key={property.key}
                  title={`${property.displayLabel} (${property.propertyType})`}
                  titleTooltip={`${property.actualECClassName}`}
                  subText={property.categoryLabel}
                  actionGroup={null}
                />
              ))}
          </div>
        </Fieldset>
      </div>
      <ActionPanel
        onSave={handleSaveClick}
        onCancel={onClickCancel}
        isLoading={isLoading}
        isSavingDisabled={
          selectedProperties.length === 0 || !propertyName || dataType === DataType.Undefined
        }
      />
      <GroupsPropertiesSelectionModal
        showModal={showPropertiesSelectionModal}
        setShowModal={setShowPropertiesSelectionModal}
        selectedProperties={selectedProperties}
        setSelectedProperties={setSelectedProperties}
        propertiesMetaData={propertiesMetaData}
      />
      <SaveModal
        onSave={onSave}
        onClose={handleCloseSaveModal}
        showSaveModal={showSaveConfirmationModal}
      />
    </>
  );
};

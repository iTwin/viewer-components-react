/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IModelConnection } from "@itwin/core-frontend";
import type {
  ContentDescriptorRequestOptions,
  Field,
  KeySet,
  NestedContentField,
  PropertiesField,
  Ruleset,
  RulesetVariable,
  StructFieldMemberDescription,
} from "@itwin/presentation-common";
import {
  ContentSpecificationTypes,
  DefaultContentDisplayTypes,
  PropertyValueFormat,
  RelationshipMeaning,
  RuleTypes,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import {
  SvgChevronDown,
  SvgChevronUp,
  SvgRemove,
} from "@itwin/itwinui-icons-react";
import type {
  SelectOption,
} from "@itwin/itwinui-react";
import {
  Alert,
  ComboBox,
  Fieldset,
  IconButton,
  LabeledInput,
  LabeledSelect,
  Small,
  Text,
} from "@itwin/itwinui-react";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";

import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, WidgetHeader } from "./utils";
import "./GroupPropertyAction.scss";
import type { ECProperty, GroupPropertyCreate } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import { ApiContext } from "./GroupingMapping";

interface GroupPropertyActionProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  groupPropertyId?: string;
  groupPropertyName?: string;
  keySet: KeySet;
  returnFn: () => Promise<void>;
}

export const quantityTypesSelectionOptions: SelectOption<string>[] = [
  { value: "Area", label: "Area" },
  { value: "Distance", label: "Distance" },
  { value: "Force", label: "Force" },
  { value: "Mass", label: "Mass" },
  { value: "Monetary", label: "Monetary" },
  { value: "Time", label: "Time" },
  { value: "Volume", label: "Volume" },
  { value: "Undefined", label: "No Quantity Type" },
];
interface Property {
  name: string;
  label: string;
  type: string;
}

interface NavigationProperty {
  navigationName: string;
  rootClassName: string;
}

const extractPrimitive = (
  propertiesField: PropertiesField,
  classToPropertiesMapping: Map<string, Property[]>,
  navigation?: NavigationProperty
) => {
  // There are rare cases which only happens in multiple selections where it returns more than one.
  // This also checks if this property comes from a navigation property
  const className =
    navigation?.rootClassName ??
    propertiesField.properties[0].property.classInfo.name;
  // Sometimes class names are not defined. Type error. Not guaranteed.
  if (!className) {
    return;
  }

  if (!classToPropertiesMapping.has(className)) {
    classToPropertiesMapping.set(className, []);
  }

  // Gets property name. Appends path if from navigation.
  const propertyName = navigation
    ? `${navigation.navigationName}.${propertiesField.properties[0].property.name}`
    : propertiesField.properties[0].property.name;

  const label = navigation
    ? `${propertiesField.label} (${navigation?.navigationName})`
    : propertiesField.label;

  // Ignore hardcoded BisCore navigation properties
  if (propertiesField.type.typeName === "navigation") {
    return;
  } else {
    classToPropertiesMapping.get(className)?.push({
      name: propertyName,
      label,
      type: propertiesField.properties[0].property.type,
    });
  }
};

const extractStructProperties = (
  name: string,
  className: string,
  classToPropertiesMapping: Map<string, Property[]>,
  members: StructFieldMemberDescription[]
) => {
  for (const member of members) {
    if (member.type.valueFormat === PropertyValueFormat.Primitive) {
      if (!classToPropertiesMapping.has(className)) {
        classToPropertiesMapping.set(className, []);
      }

      classToPropertiesMapping.get(className)?.push({
        name: `${name}.${member.name}`,
        label: member.label,
        type: member.type.typeName,
      });
    } else if (member.type.valueFormat === PropertyValueFormat.Struct) {
      extractStructProperties(
        `${name}.${member.name}`,
        className,
        classToPropertiesMapping,
        member.type.members
      );
    }
  }
};

const extractProperties = (
  properties: Field[],
  classToPropertiesMapping: Map<string, Property[]>,
  navigation?: NavigationProperty
) => {
  for (const property of properties) {
    switch (property.type.valueFormat) {
      case PropertyValueFormat.Primitive: {
        extractPrimitive(
          property as PropertiesField,
          classToPropertiesMapping,
          navigation
        );
        break;
      }
      // Get structs
      case PropertyValueFormat.Struct: {
        const nestedContentField = property as NestedContentField;
        // Only handling single path and not handling nested content fields within navigations
        if (
          nestedContentField.pathToPrimaryClass &&
          nestedContentField.pathToPrimaryClass.length > 1
        ) {
          break;
        }

        switch (nestedContentField.relationshipMeaning) {
          case RelationshipMeaning.SameInstance: {
            // Check for aspects. Ignore them if coming from navigation.
            if (
              !navigation &&
              (nestedContentField.pathToPrimaryClass[0].relationshipInfo
                .name === "BisCore:ElementOwnsUniqueAspect" ||
                nestedContentField.pathToPrimaryClass[0].relationshipInfo
                  .name === "BisCore:ElementOwnsMultiAspects")
            ) {
              const className = nestedContentField.contentClassInfo.name;
              if (!classToPropertiesMapping.has(className)) {
                classToPropertiesMapping.set(className, []);
              }

              extractProperties(
                nestedContentField.nestedFields,
                classToPropertiesMapping,
                navigation
              );
            }

            break;
          }
          // Navigation properties
          case RelationshipMeaning.RelatedInstance: {
            if (
              // Deal with a TypeDefinition
              nestedContentField.pathToPrimaryClass[0].relationshipInfo.name ===
              "BisCore:GeometricElement3dHasTypeDefinition"
            ) {
              const className =
                nestedContentField.pathToPrimaryClass[0].targetClassInfo.name;
              extractProperties(
                nestedContentField.nestedFields,
                classToPropertiesMapping,
                {
                  navigationName: "TypeDefinition",
                  rootClassName: className,
                }
              );
              // Hardcoded BisCore navigation properties for the type definition.
              classToPropertiesMapping.get(className)?.push({
                name: "TypeDefinition.Model.ModeledElement.UserLabel",
                label: "Model UserLabel (TypeDefinition)",
                type: "string",
              });

              classToPropertiesMapping.get(className)?.push({
                name: "TypeDefinition.Model.ModeledElement.CodeValue",
                label: "Model CodeValue (TypeDefinition)",
                type: "string",
              });

            }
            break;
          }
          default: {
            // Some elements don't have a path to primary class or relationship meaning..
            // Most likely a simple struct property
            if (!nestedContentField.pathToPrimaryClass) {
              const columnName = (property as PropertiesField).properties[0]
                .property.name;
              const className = (property as PropertiesField).properties[0]
                .property.classInfo.name;
              extractStructProperties(
                navigation
                  ? `${navigation.navigationName}.${columnName}`
                  : columnName,
                navigation ? navigation.rootClassName : className,
                classToPropertiesMapping,
                property.type.members
              );

            }
          }
        }
      }
    }
  }
};

const GroupPropertyAction = ({
  iModelId,
  mappingId,
  groupId,
  groupPropertyId,
  groupPropertyName,
  keySet,
  returnFn,
}: GroupPropertyActionProps) => {
  const iModelConnection = useActiveIModelConnection() as IModelConnection;
  const apiContext = useContext(ApiContext);
  const [propertyName, setPropertyName] = useState<string>("");
  const [dataType, setDataType] = useState<string | undefined>();
  const [quantityType, setQuantityType] = useState<string>("Undefined");
  const [classToPropertiesMapping, setClassToPropertiesMapping] =
    useState<Map<string, Property[]>>();
  const [ecProperties, setEcProperties] = useState<ECProperty[]>(
    []
  );
  const [validator, showValidationMessage] = useValidator();
  const [propertyAlert, setPropertyAlert] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const getContent = async () => {
      setIsLoading(true);
      const ruleSet: Ruleset = {
        id: "element-properties",
        rules: [
          {
            ruleType: RuleTypes.Content,
            specifications: [
              {
                specType: ContentSpecificationTypes.SelectedNodeInstances,
              },
            ],
          }],
      };
      const requestOptions: ContentDescriptorRequestOptions<
      IModelConnection,
      KeySet,
      RulesetVariable
      > = {
        imodel: iModelConnection,
        keys: keySet,
        rulesetOrId: ruleSet,
        displayType: DefaultContentDisplayTypes.PropertyPane,
      };
      const content = await Presentation.presentation.getContentDescriptor(
        requestOptions
      );

      // Only primitives and structs for now
      const properties =
        content?.fields.filter(
          (field) =>
            field.type.valueFormat === PropertyValueFormat.Primitive ||
            field.type.valueFormat === PropertyValueFormat.Struct
        ) ?? [];

      // Map properties to their classes
      const classToPropertiesMapping = new Map<string, Property[]>();

      extractProperties(properties, classToPropertiesMapping);

      const rootClassName = keySet.instanceKeys.keys().next().value;

      // Hardcoded BisCore navigation properties.
      classToPropertiesMapping.get(rootClassName)?.push({
        name: "Model.ModeledElement.UserLabel",
        label: "Model UserLabel",
        type: "string",
      });

      classToPropertiesMapping.get(rootClassName)?.push({
        name: "Model.ModeledElement.CodeValue",
        label: "Model CodeValue",
        type: "string",
      });

      classToPropertiesMapping.get(rootClassName)?.push({
        name: "Category.CodeValue",
        label: "Category CodeValue",
        type: "string",
      });

      classToPropertiesMapping.get(rootClassName)?.push({
        name: "Category.UserLabel",
        label: "Category UserLabel",
        type: "string",
      });

      setClassToPropertiesMapping(classToPropertiesMapping);

      let newEcProperties: ECProperty[];
      const reportingClientApi = new ReportingClient(apiContext.prefix);
      // Fetch already existing ec properties then add all classes from presentation
      if (groupPropertyId) {
        // TODO Error handling
        const response = await reportingClientApi.getGroupProperty(
          apiContext.accessToken,
          iModelId,
          mappingId,
          groupId,
          groupPropertyId
        );
        newEcProperties = response.property?.ecProperties ?? [];

        let keys = Array.from(classToPropertiesMapping.keys()).reverse();
        for (const ecProperty of newEcProperties) {
          keys = keys.filter(
            (key) =>
              `${ecProperty.ecSchemaName}:${ecProperty.ecClassName}` !== key
          );
        }

        newEcProperties.push(
          ...keys.map((key) => ({
            ecSchemaName: key.split(":")[0],
            ecClassName: key.split(":")[1],
            // Placeholders for properties
            ecPropertyName: "",
            ecPropertyType: "",
          }))
        );

        setPropertyName(response.property?.propertyName ?? "");
        setDataType(response.property?.dataType ?? "");
        setQuantityType(response.property?.quantityType ?? "");
      } else {
        newEcProperties = Array.from(classToPropertiesMapping)
          .map(([key]) => ({
            ecSchemaName: key.split(":")[0],
            ecClassName: key.split(":")[1],
            // Placeholders for properties
            ecPropertyName: "",
            ecPropertyType: "",
          }))
          .reverse();
      }

      setEcProperties(newEcProperties);

      setIsLoading(false);
    };
    void getContent();
  }, [apiContext.accessToken, apiContext.prefix, groupId, groupPropertyId, iModelConnection, iModelId, keySet, mappingId]);

  const onSave = async () => {
    const filteredEcProperties = ecProperties.filter(
      (ecProperty) => ecProperty.ecPropertyName && ecProperty.ecPropertyType
    );
    if (!filteredEcProperties?.length || !validator.allValid()) {
      showValidationMessage(true);
      if (!filteredEcProperties?.length) {
        setPropertyAlert(true);
      }
      return;
    }
    try {
      setIsLoading(true);
      const groupProperty: GroupPropertyCreate = {
        propertyName,
        dataType,
        quantityType,
        ecProperties: filteredEcProperties,
      };
      const reportingClientApi = new ReportingClient(apiContext.prefix);
      groupPropertyId
        ? await reportingClientApi.updateGroupProperty(
          apiContext.accessToken,
          iModelId,
          mappingId,
          groupId,
          groupPropertyId,
          groupProperty
        )
        : await reportingClientApi.createGroupProperty(
          apiContext.accessToken,
          iModelId,
          mappingId,
          groupId,
          groupProperty
        );
      await returnFn();
    } catch (error: any) {
      handleError(error.status);
      setIsLoading(false);
    }
  };

  const onChange = useCallback((value: string, index: number) => {
    setPropertyAlert(false);
    const property = JSON.parse(value);
    setEcProperties((ecProperties) => {
      const updatedEcProperties = [...ecProperties];
      updatedEcProperties[index].ecPropertyName = property.name;

      // Unique types
      let type = "";
      switch (property.type) {
        case "long":
          type = "integer";
          break;
        default:
          type = property.type;
      }

      updatedEcProperties[index].ecPropertyType = type;
      return updatedEcProperties;
    });
  }, []);

  const propertyOptions = useMemo(() => {
    return ecProperties.map(
      (ecProperty: ECProperty) =>
        classToPropertiesMapping
          ?.get(`${ecProperty.ecSchemaName}:${ecProperty.ecClassName}`)
          ?.map((property) => ({
            value: JSON.stringify({
              name: property.name,
              type: property.type,
            }),
            label: property.label,
          })) ?? []
    );
  }, [classToPropertiesMapping, ecProperties]);

  const getValue = useCallback(
    (ecProperty: ECProperty, index: number) => {
      const property = classToPropertiesMapping
        ?.get(`${ecProperty.ecSchemaName}:${ecProperty.ecClassName}`)
        ?.find(
          (property) => property.name === ecProperties[index].ecPropertyName
        );
      const result = JSON.stringify({
        name: property?.name,
        type: property?.type,
      });
      return result;
    },
    [classToPropertiesMapping, ecProperties]
  );

  return (
    <>
      <WidgetHeader
        title={groupPropertyName ?? "Add Property"}
        returnFn={returnFn}
      />
      <div className='group-property-action-container'>
        <Fieldset className='property-options' legend='Property Details'>
          <Small className='field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>
          <LabeledInput
            id='propertyName'
            label='Property Name'
            value={propertyName}
            required
            disabled={isLoading}
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
          <LabeledSelect<string>
            label={"Data Type"}
            id='dataType'
            disabled={isLoading}
            options={[
              { value: "Boolean", label: "Boolean" },
              { value: "Number", label: "Number" },
              { value: "String", label: "String" },
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
          <LabeledSelect<string>
            label='Quantity Type'
            disabled={isLoading}
            options={quantityTypesSelectionOptions}
            value={quantityType}
            onChange={setQuantityType}
            onShow={() => { }}
            onHide={() => { }}
          />
        </Fieldset>
        <Fieldset className='property-selection-container' legend='Properties'>
          {propertyAlert && (
            <Alert type={"negative"}>
              Please select at least one property.
            </Alert>
          )}
          {isLoading &&
            Array(3)
              .fill(null)
              .map((_, index) => (
                <Text key={index} variant='headline' isSkeleton>
                  LOADING SKELETON
                </Text>
              ))}
          {ecProperties?.map((ecProperty, index) => {
            return (
              <div
                className='property-select-item'
                key={`${ecProperty.ecSchemaName}${ecProperty.ecClassName}`}
              >
                <Text variant='leading'>{ecProperty.ecClassName}</Text>
                <Text isMuted variant='small'>
                  {ecProperty.ecSchemaName}
                </Text>

                <div className='selection-and-reorder'>
                  <ComboBox<string>
                    options={propertyOptions[index]}
                    value={getValue(ecProperty, index)}
                    onChange={(value) => onChange(value, index)}
                    inputProps={{
                      placeholder: "<No Property Mapped>",
                    }}
                    style={{ width: "100%" }}
                  />
                  <IconButton
                    onClick={() => {
                      const updatedEcPropertyList = [...ecProperties];
                      updatedEcPropertyList[index] = {
                        ...updatedEcPropertyList[index],
                        ecPropertyName: "",
                        ecPropertyType: "",
                      };
                      setEcProperties(updatedEcPropertyList);
                    }}
                    disabled={
                      !ecProperty.ecPropertyName && !ecProperty.ecPropertyType
                    }
                  >
                    <SvgRemove />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      const tab = [...ecProperties];
                      const item = tab.splice(index, 1);
                      tab.splice(index - 1, 0, item[0]);
                      setEcProperties(tab);
                    }}
                    disabled={index === 0}
                  >
                    <SvgChevronUp />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      const tab = [...ecProperties];
                      const item = tab.splice(index, 1);
                      tab.splice(index + 1, 0, item[0]);
                      setEcProperties(tab);
                    }}
                    disabled={index === ecProperties.length - 1}
                  >
                    <SvgChevronDown />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </Fieldset>
      </div>
      {/* TODO: Disable when no properties are selected. Will do when I rework property selection. */}
      <ActionPanel onSave={onSave} onCancel={returnFn} isLoading={isLoading} />
    </>
  );
};

export default GroupPropertyAction;

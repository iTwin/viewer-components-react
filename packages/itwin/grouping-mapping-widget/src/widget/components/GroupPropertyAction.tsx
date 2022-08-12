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
import type { SelectOption } from "@itwin/itwinui-react";
import { MenuItem } from "@itwin/itwinui-react";
import { ComboBox } from "@itwin/itwinui-react";
import {
  Alert,
  Fieldset,
  LabeledInput,
  LabeledSelect,
  Small,
  Text,
} from "@itwin/itwinui-react";
import React, { useEffect, useMemo, useState } from "react";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, WidgetHeader } from "./utils";
import "./GroupPropertyAction.scss";
import type { ECProperty, GroupPropertyCreate } from "@itwin/insights-client";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";

interface GroupPropertyActionProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  groupPropertyId?: string;
  groupPropertyName?: string;
  keySet: KeySet;
  returnFn: (modified: boolean) => Promise<void>;
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

interface PropertyMetaData {
  // Display label
  label: string;
  // ECProperty source schema:class
  schema: string;
  className: string;
  // Property Type
  type: string;
  // The parent class of the property
  parentPropertyClassName: string;
  // ECProperty type traversal
  propertyTraversal: Array<string>;
  // The type of primitive navigation from Presentation
  primitiveNavigationClass: string;
}

const convertType = (type: string) =>{
  switch (type) {
    case "int":
    case "long":
      return "number";
    case "enum":
      return "string";
    default:
      return type;
  }
};

const extractPrimitive = (
  propertyTraversal: Array<string>,
  propertyField: PropertiesField
): PropertyMetaData => {
  const propertyName =  propertyField.properties[0].property.name;
  const label = propertyField.label;
  const type = convertType(propertyField.properties[0].property.type);
  //  It belongs to this parent class
  const parentPropertyClassName = propertyField.parent?.contentClassInfo.name ?? "*";
  const primitiveNavigationClass = propertyField.properties[0].property.navigationPropertyInfo?.classInfo.name ?? "";

  propertyTraversal.push(propertyName);

  return { label, schema: "*", className:"*", propertyTraversal, type, primitiveNavigationClass, parentPropertyClassName};
};

const extractPrimitiveStructProperties = (
  propertyTraversal: Array<string>,
  members: StructFieldMemberDescription[],
  parentPropertyClassName: string = "*"
) => {
  const ecPropertyMetaDetaList = new Array<PropertyMetaData>();
  for (const member of members) {
    if (member.type.valueFormat === PropertyValueFormat.Primitive) {

      const propertyName =  member.name;
      const label = member.label;
      const type = convertType(member.type.typeName);

      ecPropertyMetaDetaList.push({ label, schema: "*", className:"*", propertyTraversal: [...propertyTraversal, propertyName], type, primitiveNavigationClass:"", parentPropertyClassName});
    } else if (member.type.valueFormat === PropertyValueFormat.Struct) {
      ecPropertyMetaDetaList.push(...extractPrimitiveStructProperties(
        propertyTraversal,
        member.type.members,
        parentPropertyClassName
      ));
    }
  }
  return ecPropertyMetaDetaList;
};

const extractNested = ( propertyTraversal: Array<string>, propertyFields: Field[]) => {
  const ecPropertyMetaDetaList = new Array<PropertyMetaData>();
  for (const property of propertyFields) {

    // Generate base ECProperty
    switch (property.type.valueFormat) {
      case PropertyValueFormat.Primitive: {
        ecPropertyMetaDetaList.push(extractPrimitive([...propertyTraversal], property as PropertiesField));
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
          // Aspects are not looked at again. Extraction does not support aspects within navigations.
          // Navigation properties
          case RelationshipMeaning.RelatedInstance: {
            if (
            // Deal with a TypeDefinition
              nestedContentField.pathToPrimaryClass[0].relationshipInfo.name ===
                "BisCore:GeometricElement3dHasTypeDefinition"
            ) {
              ecPropertyMetaDetaList.push(...extractNested([...propertyTraversal, "TypeDefinition"], nestedContentField.nestedFields));
            }
            break;
          }
          default: {
            // Some elements don't have a path to primary class or relationship meaning..
            // Most likely a simple struct property
            if (!nestedContentField.pathToPrimaryClass) {
              const columnName = (property as PropertiesField).properties[0]
                .property.name;
              ecPropertyMetaDetaList.push(...extractPrimitiveStructProperties(
                [...propertyTraversal, columnName],
                property.type.members,
                // It belongs to this parent class
                property.parent?.contentClassInfo.name
              ));
            }
          }
        }
      }
    }
  }

  return ecPropertyMetaDetaList;

};

const convertPresentationProperties = (propertyFields: Field[])=>{

  const ecPropertyMetaDetaList = new Array<PropertyMetaData>();

  for (const property of propertyFields) {

    // Generate base ECProperty
    switch (property.type.valueFormat) {
      case PropertyValueFormat.Primitive: {

        const extractedPrimitive = extractPrimitive([], property as PropertiesField);
        extractedPrimitive.schema="*";
        extractedPrimitive.className="*";
        ecPropertyMetaDetaList.push(extractedPrimitive);
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
            // Check for aspects.
            if (
              (nestedContentField.pathToPrimaryClass[0].relationshipInfo
                .name === "BisCore:ElementOwnsUniqueAspect" ||
                  nestedContentField.pathToPrimaryClass[0].relationshipInfo
                    .name === "BisCore:ElementOwnsMultiAspects")
            ) {
              const fullClassName = nestedContentField.contentClassInfo.name;
              const schema= fullClassName.split(":")[0];
              const className= fullClassName.split(":")[1];
              const extractedNested = extractNested([], nestedContentField.nestedFields);
              const aspectExtractedNested = extractedNested.map((ecProperty)=>({...ecProperty, schema, className}));
              ecPropertyMetaDetaList.push(...aspectExtractedNested);

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
              ecPropertyMetaDetaList.push(...extractNested(["TypeDefinition"], nestedContentField.nestedFields));
            }
            break;
          }
          default: {
            // Some elements don't have a path to primary class or relationship meaning..
            // Most likely a simple struct property
            if (!nestedContentField.pathToPrimaryClass) {
              const columnName = (property as PropertiesField).properties[0]
                .property.name;
              ecPropertyMetaDetaList.push(...extractPrimitiveStructProperties(
                [columnName],
                property.type.members,
              ));
            }
          }
        }
      }
    }
  }
  return ecPropertyMetaDetaList;
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
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [propertyName, setPropertyName] = useState<string>("");
  const [dataType, setDataType] = useState<string | undefined>();
  const [quantityType, setQuantityType] = useState<string>("Undefined");
  // const [classToPropertiesMapping, setClassToPropertiesMapping] =
  //   useState<Map<string, Property[]>>();
  const [propertiesMetaData, setPropertiesMetaData] = useState<PropertyMetaData[]>(
    []
  );
  const [validator, showValidationMessage] = useValidator();
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
      const requestOptions: ContentDescriptorRequestOptions<IModelConnection, KeySet, RulesetVariable> = {
        imodel: iModelConnection,
        keys: keySet,
        rulesetOrId: ruleSet,
        displayType: DefaultContentDisplayTypes.PropertyPane,
      };
      const descriptor = await Presentation.presentation.getContentDescriptor(
        requestOptions
      );

      // Only primitives and structs for now
      const propertyFields =
        descriptor?.fields.filter(
          (field) =>
            field.type.valueFormat === PropertyValueFormat.Primitive ||
            field.type.valueFormat === PropertyValueFormat.Struct
        ) ?? [];

      const propertiesMetaData = convertPresentationProperties(propertyFields);

      setPropertiesMetaData(propertiesMetaData);

      setIsLoading(false);
    };
    void getContent();
  }, [getAccessToken, mappingClient, groupId, groupPropertyId, iModelConnection, iModelId, keySet, mappingId]);

  const onSave = async () => {

    if ( !validator.allValid()) {
      showValidationMessage(true);
    }
    try {
      setIsLoading(true);
      // const accessToken = await getAccessToken();
      // const groupProperty: GroupPropertyCreate = {
      //   propertyName,
      //   dataType,
      //   quantityType,
      //   ecProperties: filteredEcProperties,
      // };
      // groupPropertyId
      //   ? await mappingClient.updateGroupProperty(
      //     accessToken,
      //     iModelId,
      //     mappingId,
      //     groupId,
      //     groupPropertyId,
      //     groupProperty
      //   )
      //   : await mappingClient.createGroupProperty(
      //     accessToken,
      //     iModelId,
      //     mappingId,
      //     groupId,
      //     groupProperty
      //   );
      await returnFn(true);
    } catch (error: any) {
      handleError(error.status);
      setIsLoading(false);
    }
  };

  const options = useMemo(()=>propertiesMetaData.map((property)=>({
    label:property.label,
    value: property,
  })),[propertiesMetaData]);

  return (
    <>
      <WidgetHeader
        title={groupPropertyName ?? "Add Property"}
        returnFn={async () => returnFn(false)}
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
          <ComboBox
            options={options}
            itemRenderer={(option: SelectOption<PropertyMetaData>) => (
              <MenuItem>
                <div className='gm-gp-menu-item'>
                  <div>{option.label}</div>
                  <div>{option.value.parentPropertyClassName}</div>
                </div>
              </MenuItem>
            )}
          />
          {isLoading &&
            Array(3)
              .fill(null)
              .map((_, index) => (
                <Text key={index} variant='headline' isSkeleton>
                  LOADING SKELETON
                </Text>
              ))}
        </Fieldset>
      </div>
      {/* TODO: Disable when no properties are selected. Will do when I rework property selection. */}
      <ActionPanel onSave={onSave} onCancel={async () => returnFn(false)} isLoading={isLoading} />
    </>
  );
};

export default GroupPropertyAction;

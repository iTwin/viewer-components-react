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
import { Alert } from "@itwin/itwinui-react";
import { IconButton } from "@itwin/itwinui-react";
import { Label } from "@itwin/itwinui-react";
import {
  Fieldset,
  LabeledInput,
  LabeledSelect,
  Small,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, WidgetHeader } from "./utils";
import "./GroupPropertyAction.scss";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { HorizontalTile } from "./HorizontalTile";
import type { ECProperty, GroupPropertyCreate, GroupPropertySingle } from "@itwin/insights-client";
import { SvgClose, SvgSearch } from "@itwin/itwinui-icons-react";
import { deepEqual } from "fast-equals";

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
  key: string;
}

const convertType = (type: string) => {
  switch (type) {
    case "int":
    case "long":
      return "Integer";
    case "enum":
      return "String";
    default:
      // Capitilize first letter
      return `${type[0].toUpperCase()}${type.slice(1).toLowerCase()}`;
  }
};

const extractPrimitive = (
  propertyTraversal: Array<string>,
  propertyField: PropertiesField
): PropertyMetaData => {
  const propertyName = propertyField.properties[0].property.name;
  const label = propertyField.label;
  //  It belongs to this parent class
  const parentPropertyClassName = propertyField.parent?.contentClassInfo.name ?? "*";
  const primitiveNavigationClass = propertyField.properties[0].property.navigationPropertyInfo?.classInfo.name ?? "";
  const type = primitiveNavigationClass ? "String" : convertType(propertyField.properties[0].property.type);

  propertyTraversal.push(propertyName);

  return { label, schema: "*", className: "*", propertyTraversal, type, primitiveNavigationClass, parentPropertyClassName, key: propertyField.name };
};

const extractPrimitiveStructProperties = (
  propertyTraversal: Array<string>,
  members: StructFieldMemberDescription[],
  parentPropertyClassName: string = "*"
) => {
  const ecPropertyMetaDetaList = new Array<PropertyMetaData>();
  for (const member of members) {
    if (member.type.valueFormat === PropertyValueFormat.Primitive) {

      const propertyName = member.name;
      const label = member.label;
      const type = convertType(member.type.typeName);

      ecPropertyMetaDetaList.push({ label, schema: "*", className: "*", propertyTraversal: [...propertyTraversal, propertyName], type, primitiveNavigationClass: "", parentPropertyClassName, key: member.name });
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

const extractNested = (propertyTraversal: Array<string>, propertyFields: Field[]) => {
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

const convertPresentationFields = (propertyFields: Field[]) => {

  const ecPropertyMetaDetaList = new Array<PropertyMetaData>();

  for (const property of propertyFields) {

    // Generate base ECProperty
    switch (property.type.valueFormat) {
      case PropertyValueFormat.Primitive: {

        const extractedPrimitive = extractPrimitive([], property as PropertiesField);
        extractedPrimitive.schema = "*";
        extractedPrimitive.className = "*";
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
              const schema = fullClassName.split(":")[0];
              const className = fullClassName.split(":")[1];
              const extractedNested = extractNested([], nestedContentField.nestedFields);
              const aspectExtractedNested = extractedNested.map((ecProperty) => ({ ...ecProperty, schema, className }));
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

const convertECProperties = (property: PropertyMetaData): Array<ECProperty> => {
  const ecProperty: ECProperty = {
    ecSchemaName: property.schema,
    ecClassName: property.className,
    ecPropertyType: property.type,
  };
  switch (property.primitiveNavigationClass) {
    case "BisCore:ModelContainsElements": {
      return [
        {
          ...ecProperty,
          ecPropertyName: [
            ...property.propertyTraversal,
            "ModeledElement",
            "UserLabel",
          ].join("."),
        },
        {
          ...ecProperty,
          ecPropertyName: [
            ...property.propertyTraversal,
            "ModeledElement",
            "CodeValue",
          ].join("."),
        },
      ];
    }
    case "BisCore:GeometricElement3dIsInCategory":
      return [
        {
          ...ecProperty,
          ecPropertyName: [...property.propertyTraversal, "UserLabel"].join("."),
        },
        {
          ...ecProperty,
          ecPropertyName: [...property.propertyTraversal, "CodeValue"].join("."),
        },
      ];
    case "BisCore:PhysicalElementIsOfPhysicalMaterial": {
      return [
        {
          ...ecProperty,
          ecPropertyName: [...property.propertyTraversal.slice(0, -1), "Material", "UserLabel"].join("."),
        },
        {
          ...ecProperty,
          ecPropertyName: [...property.propertyTraversal.slice(0, -1), "Material", "CodeValue"].join("."),
        },
      ];
    }
    default: {
      return [
        {
          ...ecProperty,
          ecPropertyName: property.propertyTraversal.join("."),
        },
      ];
    }
  }
};

const findPropertyNaive = (ecProperties: ECProperty[], propertiesMetaData: PropertyMetaData[])=>{
  for(const property of propertiesMetaData ){
    const convertedECProperty = convertECProperties(property);
    if(deepEqual(convertedECProperty, ecProperties)){
      return property;
    }
  }
  return undefined;
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
  const [selectedProperty, setSelectedProperty] = useState<PropertyMetaData>();
  const [propertiesMetaData, setPropertiesMetaData] = useState<PropertyMetaData[]>(
    []
  );
  const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearchInput, setActiveSearchInput] = useState<string>("");
  const [searched, setSearched] = useState<boolean>(false);

  const filteredProperties = useMemo(
    () =>
      propertiesMetaData.filter((p) =>
        [p.label, p.parentPropertyClassName, p.schema, p.className]
          .join(" ")
          .toLowerCase()
          .includes(activeSearchInput.toLowerCase())
      ),
    [activeSearchInput, propertiesMetaData]
  );

  useEffect(() => {
    const generatedProperties = async () => {
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

      const propertiesMetaData = convertPresentationFields(propertyFields);

      setPropertiesMetaData(propertiesMetaData);

      if (groupPropertyId) {
        const accessToken = await getAccessToken();
        let response: GroupPropertySingle | undefined;
        try {
          response = await mappingClient.getGroupProperty(
            accessToken,
            iModelId,
            mappingId,
            groupId,
            groupPropertyId
          );

          setPropertyName(response.property?.propertyName ?? "");
          setDataType(response.property?.dataType ?? "");
          setQuantityType(response.property?.quantityType ?? "");
          const property = findPropertyNaive(response.property?.ecProperties??[], propertiesMetaData);
          setSelectedProperty(property);
        } catch (error: any) {
          handleError(error.status);
        }
      }

      setIsLoading(false);
    };
    void generatedProperties();
  }, [getAccessToken, mappingClient, groupId, groupPropertyId, iModelConnection, iModelId, keySet, mappingId]);

  const onSave = async () => {

    if (!validator.allValid()) {
      showValidationMessage(true);
    }
    try {
      setIsLoading(true);
      const accessToken = await getAccessToken();
      const groupProperty: GroupPropertyCreate = {
        propertyName,
        dataType,
        quantityType,
        ecProperties: selectedProperty && convertECProperties(selectedProperty),
      };
      groupPropertyId
        ? await mappingClient.updateGroupProperty(
          accessToken,
          iModelId,
          mappingId,
          groupId,
          groupPropertyId,
          groupProperty
        )
        : await mappingClient.createGroupProperty(
          accessToken,
          iModelId,
          mappingId,
          groupId,
          groupProperty
        );
      await returnFn(true);
    } catch (error: any) {
      handleError(error.status);
      setIsLoading(false);
    }
  };

  const startSearch = useCallback(() => {
    setActiveSearchInput(searchInput);
    setSearched(true);
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setActiveSearchInput("");
    setSearched(false);
  }, []);

  useEffect(() => {
    if (searchInput.length === 0) {
      setSearched(false);
      clearSearch();
    }
  }, [searchInput, setSearched, clearSearch]);

  return (
    <>
      <WidgetHeader
        title={groupPropertyName ?? "Add Property"}
        returnFn={async () => returnFn(false)}
      />
      <div className='gmw-group-property-action-container'>
        <Fieldset disabled={isLoading} className='gmw-property-options' legend='Property Details'>
          <Small className='field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>
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
          <LabeledSelect<string>
            label={"Data Type"}
            id='dataType'
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
            options={quantityTypesSelectionOptions}
            value={quantityType}
            onChange={setQuantityType}
            onShow={() => { }}
            onHide={() => { }}
          />

        </Fieldset>
        {groupPropertyId && !isLoading  && !selectedProperty && <Alert type="warning">Property could not be found. Warning: Overwriting will occur.</Alert>}
        <Fieldset className='gmw-property-selection-container' legend="Properties">
          <Label as="span">Selected Property</Label>
          <HorizontalTile
            title={selectedProperty?.label ?? "No Selection"}
            subText={selectedProperty?.parentPropertyClassName ?? "Parent: "}
            actionGroup={null}
          />
          <div className="gmw-available-properties">
            <Label as="span">Available Properties</Label>
            <LabeledInput
              displayStyle="inline"
              iconDisplayStyle="inline"
              className="search-input"
              value={searchInput}
              size="small"
              placeholder="Search...."
              onChange={(event) => {
                const {
                  target: { value },
                } = event;
                setSearchInput(value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  startSearch();
                }
              }}
              svgIcon={
                searched ? (
                  <IconButton onClick={clearSearch} styleType="borderless">
                    <SvgClose />
                  </IconButton>
                ) : (
                  <IconButton onClick={startSearch} styleType="borderless">
                    <SvgSearch />
                  </IconButton>
                )
              }
            />
          </div>
          <div className="gmw-properties-list">
            {filteredProperties.map((property) => (
              <HorizontalTile
                key={property.key}
                title={property.label}
                subText={`Parent: ${property.parentPropertyClassName}`}
                actionGroup={`${property.type}`}
                selected={selectedProperty?.key === property.key}
                onClick={() => setSelectedProperty(property)}
              />
            ))}
          </div>
          {/* {isLoading &&
            Array(3)
              .fill(null)
              .map((_, index) => (
                <Text key={index} variant='headline' isSkeleton>
                  LOADING SKELETON
                </Text>
              ))} */}
        </Fieldset>
      </div>
      <ActionPanel onSave={onSave} onCancel={async () => returnFn(false)} isLoading={isLoading} />
    </>
  );
};

export default GroupPropertyAction;

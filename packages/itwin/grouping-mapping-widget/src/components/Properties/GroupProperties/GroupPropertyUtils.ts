/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IModelConnection } from "@itwin/core-frontend";
import type { ECProperty } from "@itwin/insights-client";
import { DataType } from "@itwin/insights-client";
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
import { deepEqual } from "fast-equals";

export interface PropertyMetaData {
  displayLabel: string;
  sourceSchema: string;
  sourceClassName: string;
  categoryLabel: string;
  propertyType: DataType;
  actualECClassName: string;
  parentPropertyClassName: string | undefined;
  ecPropertyTraversal: string[];
  primitiveNavigationClass: string;
  key: string;
}

const convertType = (type: string): DataType => {
  switch (type) {
    case "int":
    case "enum":
    case "long":
      return DataType.Integer;
    case "boolean":
      return DataType.Boolean;
    case "double":
      return DataType.Double;
    case "number":
      return DataType.Number;
    default:
      return DataType.String;
  }
};

const generateKey = (
  parentPropertyClassName: string | undefined,
  actualECClassName: string,
  propertyTraversal: string[]
): string => {
  return `${parentPropertyClassName}|${actualECClassName}|${propertyTraversal.join("|")}`;
};

const extractPrimitives = (
  propertyTraversal: string[],
  propertyField: PropertiesField
): PropertyMetaData[] => propertyField.properties.map((property) => {
  const propertyName = property.property.name;
  const displayLabel = propertyField.label;
  // It belongs to this parent class
  const parentPropertyClassName = propertyField.parent?.contentClassInfo.name;
  const primitiveNavigationClass = property.property.navigationPropertyInfo?.classInfo.name ?? "";
  /* Presentation assigns primitive navigations properties as a long type due to how it stores the
     ECInstanceId of the class in the meta.ECClassDef table on the C++ layer.
     We are handling this special case.
  */
  const propertyType = primitiveNavigationClass ? DataType.String : convertType(property.property.type);
  const actualECClassName = property.property.classInfo.name;
  const newPropertyTraversal = [...propertyTraversal, propertyName];

  return (
    {
      displayLabel,
      sourceSchema: "*",
      sourceClassName: "*",
      ecPropertyTraversal: newPropertyTraversal,
      propertyType,
      primitiveNavigationClass,
      actualECClassName,
      parentPropertyClassName,
      key: generateKey(parentPropertyClassName, actualECClassName, newPropertyTraversal),
      categoryLabel: propertyField.category.label,
    }
  );
});

const extractPrimitiveStructProperties = (
  propertyTraversal: string[],
  members: StructFieldMemberDescription[],
  categoryLabel: string,
  actualECClassName: string,
  parentPropertyClassName?: string,
): PropertyMetaData[] => members.flatMap((member) => {
  if (member.type.valueFormat === PropertyValueFormat.Primitive) {
    const propertyName = member.name;
    const displayLabel = member.label;
    const propertyType = convertType(member.type.typeName);
    const newPropertyTraversal = [...propertyTraversal, propertyName];

    return ({
      displayLabel,
      sourceSchema: "*",
      sourceClassName: "*",
      ecPropertyTraversal: newPropertyTraversal,
      propertyType,
      primitiveNavigationClass: "",
      actualECClassName,
      parentPropertyClassName,
      key: generateKey(parentPropertyClassName, actualECClassName, newPropertyTraversal),
      categoryLabel,
    });

  } else if (member.type.valueFormat === PropertyValueFormat.Struct) {
    const structName = member.name;
    return extractPrimitiveStructProperties(
      [...propertyTraversal, structName],
      member.type.members,
      categoryLabel,
      actualECClassName,
      parentPropertyClassName
    );
  }

  return [];
});

const extractStruct = (property: Field) => {
  if (property.type.valueFormat !== PropertyValueFormat.Struct) {
    return [];
  }

  const columnName = (property as PropertiesField).properties[0]
    .property.name;
  const actualECClassName = (property as PropertiesField).properties[0].property.classInfo.name;
  return extractPrimitiveStructProperties(
    [columnName],
    property.type.members,
    property.category.label,
    actualECClassName
  );
};

const extractNested = (propertyTraversal: string[], propertyFields: Field[]): PropertyMetaData[] =>
  propertyFields.flatMap((property) => {
    // Generate base ECProperty
    switch (property.type.valueFormat) {
      case PropertyValueFormat.Primitive: {
        return extractPrimitives([...propertyTraversal], property as PropertiesField);
      }
      // Get structs
      case PropertyValueFormat.Struct: {
        const nestedContentField = property as NestedContentField;
        // Only handling single path and not handling nested content fields within navigations
        if (
          nestedContentField.pathToPrimaryClass &&
          nestedContentField.pathToPrimaryClass.length > 1
        ) {
          // Hardcoded navigation to external source repository metadata.
          if (nestedContentField.contentClassInfo.name === "BisCore:RepositoryLink") {
            return extractNested([...propertyTraversal, "Source", "Repository"], nestedContentField.nestedFields);
          }
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
              return extractNested([...propertyTraversal, "TypeDefinition"], nestedContentField.nestedFields);
            }
            break;
          }
          default: {
            // Some elements don't have a path to primary class or relationship meaning..
            // Most likely a simple struct property
            if (!nestedContentField.pathToPrimaryClass) {
              return extractStruct(property);
            }
          }
        }
      }
    }
    return [];
  });

export const convertPresentationFields = (propertyFields: Field[]): PropertyMetaData[] => {
  const uniquePropertiesMap = new Map<string, PropertyMetaData>();

  propertyFields.forEach((property) => {
    switch (property.type.valueFormat) {
      case PropertyValueFormat.Primitive: {
        // Generate base ECProperty
        const extractedPrimitives = extractPrimitives([], property as PropertiesField);
        extractedPrimitives.forEach((extractedPrimitive) => {
          extractedPrimitive.sourceSchema = "*";
          extractedPrimitive.sourceClassName = "*";
          uniquePropertiesMap.set(extractedPrimitive.key, extractedPrimitive);
        });
        break;
      }
      case PropertyValueFormat.Struct: {
        // Get structs
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
              const sourceSchema = fullClassName.split(":")[0];
              const sourceClassName = fullClassName.split(":")[1];
              const extractedNested = extractNested([], nestedContentField.nestedFields);
              extractedNested.forEach((ecProperty) => {
                const propertyWithSchema = { ...ecProperty, sourceSchema, sourceClassName };
                uniquePropertiesMap.set(propertyWithSchema.key, propertyWithSchema);
              });
            }
            break;
          }
          case RelationshipMeaning.RelatedInstance: {
            // Navigation properties
            if (
            // Deal with a TypeDefinition
              nestedContentField.pathToPrimaryClass[0].relationshipInfo.name ===
                "BisCore:GeometricElement3dHasTypeDefinition"
            ) {
              const extractedNested = extractNested(["TypeDefinition"], nestedContentField.nestedFields);
              extractedNested.forEach((ecProperty) => {
                uniquePropertiesMap.set(ecProperty.key, ecProperty);
              });
            }
            break;
          }
          default: {
            // Some elements don't have a path to primary class or relationship meaning..
            // Most likely a simple struct property
            if (!nestedContentField.pathToPrimaryClass) {
              const extractedStruct = extractStruct(property);
              extractedStruct.forEach((ecProperty) => {
                uniquePropertiesMap.set(ecProperty.key, ecProperty);
              });
            }
          }
        }
      }
    }
  });

  return Array.from(uniquePropertiesMap.values());
};

export const convertToECProperties = (property: PropertyMetaData): ECProperty[] => {
  const ecProperty: ECProperty = {
    ecSchemaName: property.sourceSchema,
    ecClassName: property.sourceClassName,
    ecPropertyType: property.propertyType,
    ecPropertyName: "",
  };
  switch (property.primitiveNavigationClass) {
    // Hardcode Models navigation path and label behavior
    case "BisCore:ModelContainsElements": {
      return [
        {
          ...ecProperty,
          ecPropertyName: [
            ...property.ecPropertyTraversal,
            "ModeledElement",
            "UserLabel",
          ].join("."),
        },
        {
          ...ecProperty,
          ecPropertyName: [
            ...property.ecPropertyTraversal,
            "ModeledElement",
            "CodeValue",
          ].join("."),
        },
      ];
    }
    // Hardcode Category and Physical Material navigation path and label behavior
    case "BisCore:GeometricElement3dIsInCategory":
    case "BisCore:PhysicalElementIsOfPhysicalMaterial":
      return [
        {
          ...ecProperty,
          ecPropertyName: [
            ...property.ecPropertyTraversal,
            "UserLabel",
          ].join("."),
        },
        {
          ...ecProperty,
          ecPropertyName: [
            ...property.ecPropertyTraversal,
            "CodeValue",
          ].join("."),
        },
      ];
    default: {
      return [
        {
          ...ecProperty,
          ecPropertyName: property.ecPropertyTraversal.join("."),
        },
      ];
    }
  }
};

export const findProperties = (ecProperties: ECProperty[], propertiesMetaData: PropertyMetaData[]) => {
  let ecPropertiesCopy = [...ecProperties];
  const propertiesMetaDataResult: PropertyMetaData[] = new Array<PropertyMetaData>();
  let notFound = false;
  while (ecPropertiesCopy.length !== 0) {
    for (let i = 0; i < propertiesMetaData.length; i++) {
      const generatedProperty = convertToECProperties(propertiesMetaData[i]);
      const slicedEcProperties = ecPropertiesCopy.slice(0, generatedProperty.length);
      if (deepEqual(generatedProperty, slicedEcProperties)) {
        propertiesMetaDataResult.push(propertiesMetaData[i]);
        ecPropertiesCopy = ecPropertiesCopy.slice(generatedProperty.length);
        break;
      }
      if (i === propertiesMetaData.length - 1) {
        notFound = true;
      }
    }
    if (notFound)
      break;
  }
  return notFound ? [] : propertiesMetaDataResult;
};

export const fetchPresentationDescriptor = async (iModelConnection: IModelConnection, keySet: KeySet) => {
  const ruleSet: Ruleset = {
    id: "gmw-element-properties",
    rules: [
      {
        ruleType: RuleTypes.Content,
        specifications: [
          {
            specType: ContentSpecificationTypes.SelectedNodeInstances,
            propertyOverrides: [{
              name: "*",
              isDisplayed: true,
            }],
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
  return descriptor;
};

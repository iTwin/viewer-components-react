/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ECPropertyReference } from "@itwin/insights-client";
import { DataType } from "@itwin/insights-client";
import type { PropertyMetaData } from "../components/Properties/GroupProperties/GroupPropertyUtils";
import { convertPresentationFields, convertToECProperties, findProperties } from "../components/Properties/GroupProperties/GroupPropertyUtils";
import { createTestECClassInfo, createTestNestedContentField, createTestPropertiesContentField, createTestPropertyInfo, createTestRelatedClassInfo } from "./PropertyFieldsHelpers";
import { assert, expect } from "chai";
import type { NavigationPropertyInfo, StructTypeDescription } from "@itwin/presentation-common";
import { PropertyValueFormat, RelationshipMeaning } from "@itwin/presentation-common";

describe("Group properties utilities", () => {
  it("one primitive string property", () => {
    const propertyFields = [createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }] })];

    const result = convertPresentationFields(propertyFields);

    const expectedResult: PropertyMetaData[] = [
      {
        displayLabel: "Properties Field",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["PropertyName"],
        propertyType: DataType.String,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: undefined,
        key: "undefined|SchemaName:ClassName|PropertyName",
        categoryLabel: "Test Category",
      },
    ];

    assert.deepEqual(result, expectedResult);
  });

  it("multiple primitive properies of different types", () => {
    const testProperties = [createTestPropertyInfo({ name: "propString" }),
      createTestPropertyInfo({ name: "propInt", type: "int" }),
      createTestPropertyInfo({ name: "propBool", type: "boolean" }),
      createTestPropertyInfo({ name: "propEnum", type: "enum" }),
      createTestPropertyInfo({ name: "propLong", type: "long" }),
      createTestPropertyInfo({ name: "propNumber", type: "number" }),
    ];
    const propertyFields = testProperties.map((p) => createTestPropertiesContentField({ properties: [{ property: p }] }));

    const result = convertPresentationFields(propertyFields);

    const expectedResult: PropertyMetaData[] = [
      {
        displayLabel: "Properties Field",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["propString"],
        propertyType: DataType.String,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: undefined,
        key: "undefined|SchemaName:ClassName|propString",
        categoryLabel: "Test Category",
      },
      {
        displayLabel: "Properties Field",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["propInt"],
        propertyType: DataType.Integer,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: undefined,
        key: "undefined|SchemaName:ClassName|propInt",
        categoryLabel: "Test Category",
      },
      {
        displayLabel: "Properties Field",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["propBool"],
        propertyType: DataType.Boolean,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: undefined,
        key: "undefined|SchemaName:ClassName|propBool",
        categoryLabel: "Test Category",
      },
      {
        displayLabel: "Properties Field",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["propEnum"],
        propertyType: DataType.Integer,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: undefined,
        key: "undefined|SchemaName:ClassName|propEnum",
        categoryLabel: "Test Category",
      },
      {
        displayLabel: "Properties Field",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["propLong"],
        propertyType: DataType.Integer,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: undefined,
        key: "undefined|SchemaName:ClassName|propLong",
        categoryLabel: "Test Category",
      },
      {
        displayLabel: "Properties Field",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["propNumber"],
        propertyType: DataType.Integer,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: undefined,
        key: "undefined|SchemaName:ClassName|propNumber",
        categoryLabel: "Test Category",
      },
    ];

    assert.deepEqual(result, expectedResult);
  });

  it("one BisCore:ElementOwnsUniqueAspect nested property", () => {
    const propertiesField = createTestPropertiesContentField({
      properties: [{ property: createTestPropertyInfo({ name: "prop1" }) }],
    });

    const nestedAspectField = createTestNestedContentField({
      nestedFields: [propertiesField],
      relationshipMeaning: RelationshipMeaning.SameInstance,
      pathToPrimaryClass: [
        createTestRelatedClassInfo({
          sourceClassInfo: createTestECClassInfo({ name: "Some:UniqueAspect" }),
          relationshipInfo: createTestECClassInfo({ name: "BisCore:ElementOwnsUniqueAspect" }),
          targetClassInfo: createTestECClassInfo({ name: "Schema:Class" }),
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
        }),
      ],
    });

    const result = convertPresentationFields([nestedAspectField]);

    const expectedResult: PropertyMetaData[] = [
      {
        displayLabel: "Properties Field",
        sourceSchema: "SchemaName",
        sourceClassName: "ClassName",
        ecPropertyTraversal: ["prop1"],
        propertyType: DataType.String,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: "SchemaName:ClassName",
        key: "SchemaName:ClassName|SchemaName:ClassName|prop1",
        categoryLabel: "Test Category",
      },
    ];

    assert.deepEqual(result, expectedResult);

  });

  it("one BisCore:ElementOwnsMultiAspects nested property", () => {

    const propertiesField = createTestPropertiesContentField({
      properties: [{ property: createTestPropertyInfo({ name: "prop1" }) }],
    });

    const nestedAspectField = createTestNestedContentField({
      nestedFields: [propertiesField],
      relationshipMeaning: RelationshipMeaning.SameInstance,
      pathToPrimaryClass: [
        createTestRelatedClassInfo({
          sourceClassInfo: createTestECClassInfo({ name: "Some:MultiAspect" }),
          relationshipInfo: createTestECClassInfo({ name: "BisCore:ElementOwnsMultiAspects" }),
          targetClassInfo: createTestECClassInfo({ name: "Schema:Class" }),
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
        }),
      ],
    });

    const result = convertPresentationFields([nestedAspectField]);

    const expectedResult: PropertyMetaData[] = [
      {
        displayLabel: "Properties Field",
        sourceSchema: "SchemaName",
        sourceClassName: "ClassName",
        ecPropertyTraversal: ["prop1"],
        propertyType: DataType.String,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: "SchemaName:ClassName",
        key: "SchemaName:ClassName|SchemaName:ClassName|prop1",
        categoryLabel: "Test Category",
      },
    ];

    assert.deepEqual(result, expectedResult);

  });

  it("one BisCore:GeometricElement3dHasTypeDefinition nested property", () => {

    const propertiesField = createTestPropertiesContentField({
      properties: [{ property: createTestPropertyInfo({ name: "prop1" }) }],
    });

    const nestedAspectField = createTestNestedContentField({
      nestedFields: [propertiesField],
      relationshipMeaning: RelationshipMeaning.RelatedInstance,
      pathToPrimaryClass: [
        createTestRelatedClassInfo({
          sourceClassInfo: createTestECClassInfo({ name: "Schema:SomeType" }),
          relationshipInfo: createTestECClassInfo({ name: "BisCore:GeometricElement3dHasTypeDefinition" }),
          targetClassInfo: createTestECClassInfo({ name: "Schema:Class" }),
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
        }),
      ],
    });

    const result = convertPresentationFields([nestedAspectField]);

    const expectedResult: PropertyMetaData[] = [
      {
        actualECClassName: "SchemaName:ClassName",
        categoryLabel: "Test Category",
        displayLabel: "Properties Field",
        ecPropertyTraversal: ["TypeDefinition", "prop1"],
        key: "SchemaName:ClassName|SchemaName:ClassName|TypeDefinition|prop1",
        parentPropertyClassName: "SchemaName:ClassName",
        primitiveNavigationClass: "",
        propertyType: DataType.String,
        sourceClassName: "*",
        sourceSchema: "*",
      },
    ];

    assert.deepEqual(result, expectedResult);

  });

  it("generate proper external source metadata", () => {

    const propertyName = createTestPropertyInfo({ name: "name" });
    const propertyPath = createTestPropertyInfo({ name: "path" });
    const repositoryProperties = createTestPropertiesContentField({
      properties: [{ property: propertyName }, { property: propertyPath }],
    });

    const nestedExternalSource = createTestNestedContentField({
      nestedFields: [repositoryProperties],
      contentClassInfo: { name: "BisCore:RepositoryLink", id: "", label: "" },
      relationshipMeaning: RelationshipMeaning.SameInstance,
      pathToPrimaryClass: [
        createTestRelatedClassInfo({
          sourceClassInfo: createTestECClassInfo({ name: "BisCore:ExternalSourceIsInRepository" }),
          relationshipInfo: createTestECClassInfo({ name: "BisCore:RepositoryLink" }),
          targetClassInfo: createTestECClassInfo({ name: "BisCore:ExternalSource" }),
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
        }),
        createTestRelatedClassInfo({
          sourceClassInfo: createTestECClassInfo({ name: "BisCore:ElementIsFromSource" }),
          relationshipInfo: createTestECClassInfo({ name: "BisCore:ExternalSource" }),
          targetClassInfo: createTestECClassInfo({ name: "BisCore:ExternalSourceAspect" }),
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
        }),
      ],
    });

    const propertiesField = createTestPropertiesContentField({
      properties: [{ property: createTestPropertyInfo({ name: "Identifier" }) }],
    });

    const nestedSourceAspectField = createTestNestedContentField({
      nestedFields: [propertiesField, nestedExternalSource],
      relationshipMeaning: RelationshipMeaning.SameInstance,
      pathToPrimaryClass: [
        createTestRelatedClassInfo({
          sourceClassInfo: createTestECClassInfo({ name: "BisCore:ExternalSourceAspect" }),
          relationshipInfo: createTestECClassInfo({ name: "BisCore:ElementOwnsMultiAspects" }),
          targetClassInfo: createTestECClassInfo({ name: "Schema:Class" }),
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
        }),
      ],
    });

    const result = convertPresentationFields([nestedSourceAspectField]);

    const expectedResult: PropertyMetaData[] = [
      {
        displayLabel: "Properties Field",
        sourceSchema: "SchemaName",
        sourceClassName: "ClassName",
        ecPropertyTraversal: ["Identifier"],
        propertyType: DataType.String,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: "SchemaName:ClassName",
        key: "SchemaName:ClassName|SchemaName:ClassName|Identifier",
        categoryLabel: "Test Category",
      },
      {
        displayLabel: "Properties Field",
        sourceSchema: "SchemaName",
        sourceClassName: "ClassName",
        ecPropertyTraversal: ["Source", "Repository", "name"],
        propertyType: DataType.String,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: "BisCore:RepositoryLink",
        key: "BisCore:RepositoryLink|SchemaName:ClassName|Source|Repository|name",
        categoryLabel: "Test Category",
      },
      {
        displayLabel: "Properties Field",
        sourceSchema: "SchemaName",
        sourceClassName: "ClassName",
        ecPropertyTraversal: ["Source", "Repository", "path"],
        propertyType: DataType.String,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: "BisCore:RepositoryLink",
        key: "BisCore:RepositoryLink|SchemaName:ClassName|Source|Repository|path",
        categoryLabel: "Test Category",
      },
    ];

    assert.deepEqual(result, expectedResult);

  });

  it("handle simple structs correctly", () => {
    const structPropertyClass = createTestPropertyInfo({ classInfo: { id: "0", label: "", name: "Struct:Class" } });

    const structContentFieldDescription: StructTypeDescription = {
      valueFormat: PropertyValueFormat.Struct,
      typeName: "StructType",
      members: [{
        name: "prop1",
        label: "prop one",
        type: {
          typeName: "string",
          valueFormat: PropertyValueFormat.Primitive,
        },
      }],
    };
    const simpleStructField = createTestPropertiesContentField({ properties: [{ property: structPropertyClass }], type: structContentFieldDescription });

    const result = convertPresentationFields([simpleStructField]);

    const expectedResult: PropertyMetaData[] = [
      {
        displayLabel: "prop one",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["PropertyName", "prop1"],
        propertyType: DataType.String,
        primitiveNavigationClass: "",
        actualECClassName: "Struct:Class",
        parentPropertyClassName: undefined,
        key: "undefined|Struct:Class|PropertyName|prop1",
        categoryLabel: "Test Category",
      },
    ];

    assert.deepEqual(result, expectedResult);
  }
  );

  it("handle simple nested structs correctly", () => {
    const structPropertyClass = createTestPropertyInfo({ classInfo: { id: "0", label: "", name: "Struct:Class" } });

    const structContentFieldDescription: StructTypeDescription = {
      valueFormat: PropertyValueFormat.Struct,
      typeName: "StructType",
      members: [{
        name: "prop1",
        label: "prop one",
        type: {
          typeName: "string",
          valueFormat: PropertyValueFormat.Primitive,
        },
      },
      {
        name: "struct1",
        label: "struct1",
        type: {
          typeName: "string",
          valueFormat: PropertyValueFormat.Struct,
          members: [{
            name: "prop2",
            label: "prop 2",
            type: {
              typeName: "string",
              valueFormat: PropertyValueFormat.Primitive,
            },
          }],
        },
      }],
    };

    const simpleStructField = createTestPropertiesContentField({ properties: [{ property: structPropertyClass }], type: structContentFieldDescription });

    const result = convertPresentationFields([simpleStructField]);

    const expectedResult: PropertyMetaData[] = [
      {
        displayLabel: "prop one",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["PropertyName", "prop1"],
        propertyType: DataType.String,
        primitiveNavigationClass: "",
        actualECClassName: "Struct:Class",
        parentPropertyClassName: undefined,
        key: "undefined|Struct:Class|PropertyName|prop1",
        categoryLabel: "Test Category",
      },
      {
        displayLabel: "prop 2",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["PropertyName", "struct1", "prop2"],
        propertyType: DataType.String,
        primitiveNavigationClass: "",
        actualECClassName: "Struct:Class",
        parentPropertyClassName: undefined,
        key: "undefined|Struct:Class|PropertyName|struct1|prop2",
        categoryLabel: "Test Category",
      },
    ];

    assert.deepEqual(result, expectedResult);
  }
  );

  it("handle primitive navigation (Model)", () => {
    const modelClassInfo = createTestECClassInfo({ name: "BisCore:Element", label: "Element" });
    const navigationClassInfo = createTestECClassInfo({ name: "BisCore:ModelContainsElements", label: "ModelContainsElements" });

    const navigationPropertyInfo: NavigationPropertyInfo = {
      classInfo: navigationClassInfo,
      isForwardRelationship: false,
      // Target class does not matter
      targetClassInfo: createTestECClassInfo(),
      isTargetPolymorphic: true,

    };

    const modelPropertyInfo = createTestPropertyInfo({ name: "Model", classInfo: modelClassInfo, type: "long", navigationPropertyInfo });

    const simpleModelField = createTestPropertiesContentField({ label: "Model", properties: [{ property: modelPropertyInfo }] });

    const result = convertPresentationFields([simpleModelField]);

    const expectedResult: PropertyMetaData[] = [
      {
        displayLabel: "Model",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["Model"],
        propertyType: DataType.String,
        primitiveNavigationClass: "BisCore:ModelContainsElements",
        actualECClassName: "BisCore:Element",
        parentPropertyClassName: undefined,
        key: "undefined|BisCore:Element|Model",
        categoryLabel: "Test Category",
      },
    ];

    assert.deepEqual(result, expectedResult);
  }
  );

  it("convert PropertyMetaData non primitive navigation into ECProperty", () => {
    const propertyMetaData: PropertyMetaData = {
      displayLabel: "A Property",
      sourceSchema: "Schema",
      sourceClassName: "Class",
      ecPropertyTraversal: ["PropertyName", "SecondProperty"],
      propertyType: DataType.String,
      primitiveNavigationClass: "",
      actualECClassName: "SchemaName:ClassName",
      parentPropertyClassName: undefined,
      key: "undefined|SchemaName:ClassName|PropertyName",
      categoryLabel: "Test Category",
    };

    const result = convertToECProperties(propertyMetaData);

    const expectedResult: ECPropertyReference[] = [
      {
        ecSchemaName: "Schema",
        ecClassName: "Class",
        ecPropertyName: "PropertyName.SecondProperty",
      },
    ];

    assert.deepEqual(result, expectedResult);
  });

  it("convert Model PropertyMetaData primitive navigation into ECProperty", () => {
    const propertyMetaData: PropertyMetaData = {
      displayLabel: "Model",
      sourceSchema: "*",
      sourceClassName: "*",
      ecPropertyTraversal: [
        "Model",
      ],
      propertyType: DataType.String,
      primitiveNavigationClass: "BisCore:ModelContainsElements",
      actualECClassName: "BisCore:Element",
      key: "undefined|BisCore:Element|Model",
      categoryLabel: "Selected Item",
      parentPropertyClassName: undefined,
    };

    const result = convertToECProperties(propertyMetaData);

    const expectedResult: ECPropertyReference[] = [
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "Model.ModeledElement.UserLabel",
      },
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "Model.ModeledElement.CodeValue",
      },
    ];

    assert.deepEqual(result, expectedResult);
  });

  it("convert Category PropertyMetaData primitive navigation into ECProperty", () => {
    const propertyMetaData: PropertyMetaData = {
      displayLabel: "Category",
      sourceSchema: "*",
      sourceClassName: "*",
      ecPropertyTraversal: [
        "Category",
      ],
      propertyType: DataType.String,
      primitiveNavigationClass: "BisCore:GeometricElement3dIsInCategory",
      actualECClassName: "BisCore:GeometricElement3d",
      key: "undefined|BisCore:GeometricElement3d|Category",
      categoryLabel: "Selected Item",
      parentPropertyClassName: undefined,
    };

    const result = convertToECProperties(propertyMetaData);

    const expectedResult: ECPropertyReference[] = [
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "Category.UserLabel",
      },
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "Category.CodeValue",
      },
    ];

    assert.deepEqual(result, expectedResult);
  });

  it("convert Physical Material PropertyMetaData primitive navigation into an ECProperty", () => {
    const propertyMetaData: PropertyMetaData = {
      displayLabel: "Physical Material",
      sourceSchema: "*",
      sourceClassName: "*",
      ecPropertyTraversal: [
        "PhysicalMaterial",
      ],
      propertyType: DataType.String,
      primitiveNavigationClass: "BisCore:PhysicalElementIsOfPhysicalMaterial",
      actualECClassName: "BisCore:PhysicalElement",
      key: "undefined|BisCore:PhysicalElement|PhysicalMaterial",
      categoryLabel: "Selected Item",
      parentPropertyClassName: undefined,
    };

    const result = convertToECProperties(propertyMetaData);

    const expectedResult: ECPropertyReference[] = [
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "PhysicalMaterial.UserLabel",
      },
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "PhysicalMaterial.CodeValue",
      },
    ];

    assert.deepEqual(result, expectedResult);
  });

  it("find properties correctly", () => {

    const propertiesMetaData: PropertyMetaData[] = [
      {
        displayLabel: "Properties Field",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["propString"],
        propertyType: DataType.String,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: undefined,
        key: "undefined|SchemaName:ClassName|propString",
        categoryLabel: "Test Category",
      },
      {
        displayLabel: "Properties Field",
        sourceSchema: "*",
        sourceClassName: "*",
        ecPropertyTraversal: ["propInt"],
        propertyType: DataType.Integer,
        primitiveNavigationClass: "",
        actualECClassName: "SchemaName:ClassName",
        parentPropertyClassName: undefined,
        key: "undefined|SchemaName:ClassName|propInt",
        categoryLabel: "Test Category",
      },
    ];

    const ecProperties: ECPropertyReference[] = [
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "propString",
      },
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "propInt",
      },
    ];

    const result = findProperties(ecProperties, propertiesMetaData);

    assert.deepEqual(result, propertiesMetaData);

  });

  it("can find properties generated from a single property", () => {

    const propertiesMetaData: PropertyMetaData[] = [{
      displayLabel: "Model",
      sourceSchema: "*",
      sourceClassName: "*",
      ecPropertyTraversal: [
        "Model",
      ],
      propertyType: DataType.String,
      primitiveNavigationClass: "BisCore:ModelContainsElements",
      actualECClassName: "BisCore:Element",
      key: "undefined|BisCore:Element|Model",
      categoryLabel: "Selected Item",
      parentPropertyClassName: undefined,
    }];

    const ecProperties: ECPropertyReference[] = [
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "Model.ModeledElement.UserLabel",
      },
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "Model.ModeledElement.CodeValue",
      },
    ];

    const result = findProperties(ecProperties, propertiesMetaData);
    assert.deepEqual(result, propertiesMetaData);

  });

  it("cannot find properties generated from a single property in the wrong order", () => {

    const propertiesMetaData: PropertyMetaData[] = [{
      displayLabel: "Model",
      sourceSchema: "*",
      sourceClassName: "*",
      ecPropertyTraversal: [
        "Model",
      ],
      propertyType: DataType.String,
      primitiveNavigationClass: "BisCore:ModelContainsElements",
      actualECClassName: "BisCore:Element",
      key: "undefined|BisCore:Element|Model",
      categoryLabel: "Selected Item",
      parentPropertyClassName: undefined,
    }];

    const ecProperties: ECPropertyReference[] = [
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "Model.ModeledElement.CodeValue",
      },
      {
        ecSchemaName: "*",
        ecClassName: "*",
        ecPropertyName: "Model.ModeledElement.UserLabel",
      },
    ];

    const result = findProperties(ecProperties, propertiesMetaData);
    expect(result).to.be.of.length(0);
  });

});

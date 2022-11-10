/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { QueryBuilderTestData } from "./QueryBuilderTestData";

export const testCases: QueryBuilderTestData = {
  testCases: [
    {
      name: "when non-relational property added, return query string with property value",
      expectedResult: "SELECT A.B.ECInstanceId FROM A.B WHERE A.B.somePropName=1",
      operations: [
        {
          expectedResult: true,
          operationType: "addProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: 1,
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "number",
            },
            parent: {
              pathToPrimaryClass: [],
            },
          },
        },
      ],
    },
    {
      name: "when relational property added, return query string with property value and relation chain to it",
      expectedResult: "SELECT Z.X.ECInstanceId FROM Z.X JOIN Rel.CX ON Rel.CX.SourceECInstanceId=A.C.ECInstanceId JOIN A.C ON A.C.ECInstanceId=Rel.BC.SourceECInstanceId JOIN Rel.BC ON Rel.BC.TargetECInstanceId=A.B.ECInstanceId JOIN A.B ON A.B.somePropName='someString' WHERE Z.X.ECInstanceId=Rel.CX.TargetECInstanceId",
      operations: [
        {
          expectedResult: true,
          operationType: "addProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someString",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [
                {
                  sourceClassInfo: {
                    id: "id1",
                    name: "A:B",
                    label: "AB label",
                  },
                  targetClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  isPolymorphicTargetClass: true,
                  relationshipInfo: {
                    id: "id3",
                    name: "Rel:BC",
                    label: "Relationship BC label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: false,
                },
                {
                  sourceClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  targetClassInfo: {
                    id: "id4",
                    name: "Z:X",
                    label: "ZX label",
                  },
                  isPolymorphicTargetClass: false,
                  relationshipInfo: {
                    id: "id5",
                    name: "Rel:CX",
                    label: "Relationship CX label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: true,
                },
              ],
              contentClassInfo: {
                name: "A:B",
              },
            },
          },
        },
      ],
    },
    {
      name: "when non-relational property removed, return empty string",
      expectedResult: "",
      operations: [
        {
          expectedResult: true,
          operationType: "addProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someString",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [],
              contentClassInfo: {
                name: "sourceClassName",
              },
            },
          },
        },
        {
          operationType: "removeProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someString",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [],
              contentClassInfo: {
                name: "sourceClassName",
              },
            },
          },
        },
      ],
    },
    {
      name: "when relational property removed, return empty string",
      expectedResult: "",
      operations: [
        {
          expectedResult: true,
          operationType: "addProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someString",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [
                {
                  sourceClassInfo: {
                    id: "id1",
                    name: "A:B",
                    label: "AB label",
                  },
                  targetClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  isPolymorphicTargetClass: true,
                  relationshipInfo: {
                    id: "id3",
                    name: "Rel:BC",
                    label: "Relationship BC label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: false,
                },
                {
                  sourceClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  targetClassInfo: {
                    id: "id4",
                    name: "Z:X",
                    label: "ZX label",
                  },
                  isPolymorphicTargetClass: false,
                  relationshipInfo: {
                    id: "id5",
                    name: "Rel:CX",
                    label: "Relationship CX label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: true,
                },
              ],
              contentClassInfo: {
                name: "A:B",
              },
            },
          },
        },
        {
          operationType: "removeProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someString",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [
                {
                  sourceClassInfo: {
                    id: "id1",
                    name: "A:B",
                    label: "AB label",
                  },
                  targetClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  isPolymorphicTargetClass: true,
                  relationshipInfo: {
                    id: "id3",
                    name: "Rel:BC",
                    label: "Relationship BC label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: false,
                },
                {
                  sourceClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  targetClassInfo: {
                    id: "id4",
                    name: "Z:X",
                    label: "ZX label",
                  },
                  isPolymorphicTargetClass: false,
                  relationshipInfo: {
                    id: "id5",
                    name: "Rel:CX",
                    label: "Relationship CX label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: true,
                },
              ],
              contentClassInfo: {
                name: "A:B",
              },
            },
          },
        },
      ],
    },
    {
      name: "when non-relational property re-added after removing, return query string with property value",
      expectedResult: "SELECT A.B.ECInstanceId FROM A.B WHERE A.B.somePropName='someOtherString'",
      operations: [
        {
          expectedResult: true,
          operationType: "addProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someString",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [],
              contentClassInfo: {
                name: "sourceClassName",
              },
            },
          },
        },
        {
          operationType: "removeProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someString",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [],
              contentClassInfo: {
                name: "sourceClassName",
              },
            },
          },
        },
        {
          operationType: "addProperty",
          expectedResult: true,
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someOtherString",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [],
              contentClassInfo: {
                name: "sourceClassName",
              },
            },
          },
        },
      ],
    },
    {
      name: "when relational property re-added after removing, return query string with property value and relation chain to it",
      expectedResult: "SELECT Z.X.ECInstanceId FROM Z.X JOIN Rel.CX ON Rel.CX.SourceECInstanceId=A.C.ECInstanceId JOIN A.C ON A.C.ECInstanceId=Rel.BC.SourceECInstanceId JOIN Rel.BC ON Rel.BC.TargetECInstanceId=A.B.ECInstanceId JOIN A.B ON A.B.somePropName='someOtherString' WHERE Z.X.ECInstanceId=Rel.CX.TargetECInstanceId",
      operations: [
        {
          expectedResult: true,
          operationType: "addProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someString",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [
                {
                  sourceClassInfo: {
                    id: "id1",
                    name: "A:B",
                    label: "AB label",
                  },
                  targetClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  isPolymorphicTargetClass: true,
                  relationshipInfo: {
                    id: "id3",
                    name: "Rel:BC",
                    label: "Relationship BC label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: false,
                },
                {
                  sourceClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  targetClassInfo: {
                    id: "id4",
                    name: "Z:X",
                    label: "ZX label",
                  },
                  isPolymorphicTargetClass: false,
                  relationshipInfo: {
                    id: "id5",
                    name: "Rel:CX",
                    label: "Relationship CX label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: true,
                },
              ],
              contentClassInfo: {
                name: "A:B",
              },
            },
          },
        },
        {
          operationType: "removeProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someString",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [
                {
                  sourceClassInfo: {
                    id: "id1",
                    name: "A:B",
                    label: "AB label",
                  },
                  targetClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  isPolymorphicTargetClass: true,
                  relationshipInfo: {
                    id: "id3",
                    name: "Rel:BC",
                    label: "Relationship BC label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: false,
                },
                {
                  sourceClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  targetClassInfo: {
                    id: "id4",
                    name: "Z:X",
                    label: "ZX label",
                  },
                  isPolymorphicTargetClass: false,
                  relationshipInfo: {
                    id: "id5",
                    name: "Rel:CX",
                    label: "Relationship CX label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: true,
                },
              ],
              contentClassInfo: {
                name: "A:B",
              },
            },
          },
        },
        {
          expectedResult: true,
          operationType: "addProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someOtherString",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [
                {
                  sourceClassInfo: {
                    id: "id1",
                    name: "A:B",
                    label: "AB label",
                  },
                  targetClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  isPolymorphicTargetClass: true,
                  relationshipInfo: {
                    id: "id3",
                    name: "Rel:BC",
                    label: "Relationship BC label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: false,
                },
                {
                  sourceClassInfo: {
                    id: "id2",
                    name: "A:C",
                    label: "AC label",
                  },
                  targetClassInfo: {
                    id: "id4",
                    name: "Z:X",
                    label: "ZX label",
                  },
                  isPolymorphicTargetClass: false,
                  relationshipInfo: {
                    id: "id5",
                    name: "Rel:CX",
                    label: "Relationship CX label",
                  },
                  isPolymorphicRelationship: true,
                  isForwardRelationship: true,
                },
              ],
              contentClassInfo: {
                name: "A:B",
              },
            },
          },
        },
      ],
    },
    {
      name: "when no properties added, return empty string",
      expectedResult: "",
      operations: [],
    },
    {
      name: "when property is float, return query string with ROUND",
      expectedResult: "SELECT A.B.ECInstanceId FROM A.B WHERE ROUND(A.B.somePropName, 4)=3.1416",
      operations: [
        {
          expectedResult: true,
          operationType: "addProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: 3.14159,
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "number",
            },
            parent: {
              pathToPrimaryClass: [],
            },
          },
        },
      ],
    },
    {
      name: "when property needsQuotes, return query string with property value in quotes",
      expectedResult: "SELECT A.B.ECInstanceId FROM A.B WHERE A.B.somePropName='https://valueThatNeedsQuotes.com'",
      operations: [
        {
          expectedResult: true,
          operationType: "addProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "https://valueThatNeedsQuotes.com",
            },
            property: {
              typename: "notNavigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "A:B",
                  },
                },
              },
            ],
            type: {
              typeName: "uri",
            },
            parent: {
              pathToPrimaryClass: [],
            },
          },
        },
      ],
    },
    {
      name: "when property is category, return a category query string",
      expectedResult: "SELECT BisCore.B.ECInstanceId FROM BisCore.B JOIN bis.Category ON bis.Category.ECInstanceId = bis.GeometricElement3d.category.id AND ((bis.Category.CodeValue='displayValueString') OR (bis.Category.UserLabel='displayValueString'))",
      operations: [
        {
          expectedResult: true,
          operationType: "addProperty",
          propertyRecord: {
            value: {
              valueFormat: 0,
              value: "someString",
              displayValue: "displayValueString",
            },
            property: {
              typename: "navigation",
              name: "propertyName",
              displayLabel: "propertyDisplayLabel",
            },
          },
          propertiesField: {
            properties: [
              {
                property: {
                  name: "somePropName",
                  classInfo: {
                    name: "BisCore:B",
                  },
                  navigationPropertyInfo: {
                    classInfo: {
                      name: "BisCore:GeometricElement3dIsInCategory",
                    },
                  },
                },
              },
            ],
            type: {
              typeName: "string",
            },
            parent: {
              pathToPrimaryClass: [],
            },
          },
        },
      ],
    },
  ],
};

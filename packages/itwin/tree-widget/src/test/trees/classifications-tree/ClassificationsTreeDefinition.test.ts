/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { afterAll, beforeAll, describe, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { buildIModel } from "../../IModelUtils.js";
import { initializeITwinJs, terminateITwinJs } from "../../Initialize.js";
import { NodeValidators, validateHierarchy } from "../HierarchyValidation.js";
import {
  createClassificationsTreeProvider,
  importClassificationSchema,
  insertClassification,
  insertClassificationSystem,
  insertClassificationTable,
  insertElementHasClassificationsRelationship,
} from "./Utils.js";

const rootClassificationSystemCode = "TestClassificationSystem";

describe("Classifications tree", () => {
  describe("Hierarchy definition", () => {
    beforeAll(async () => {
      await initializeITwinJs();
    });

    afterAll(async () => {
      await terminateITwinJs();
    });

    it("loads classifications' hierarchy without elements", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, async (txn) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "TestClassificationTable" });
          const parentClassification = insertClassification({ txn, modelId: table.id, codeValue: "TestParentClassification" });
          const childClassification = insertClassification({
            txn,
            modelId: table.id,
            parentId: parentClassification.id,
            codeValue: "TestChildClassification",
          });

          return { table, parentClassification, childClassification };
        }),
      );

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createClassificationsTreeProvider(imodelConnection, { rootClassificationSystemCode });

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.table],
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.parentClassification],
                supportsFiltering: true,
                children: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.childClassification],
                    supportsFiltering: true,
                    children: false,
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    it("loads classification elements", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, async (txn) => {
          await importClassificationSchema(imodel);

          const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "TestClassificationTable" });
          const classification = insertClassification({ txn, modelId: table.id, codeValue: "TestClassification" });

          const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "Test physical model" });
          const spatialCategory = insertSpatialCategory({ txn, codeValue: "Test spatial category" });
          const parentPhysicalElement = insertPhysicalElement({
            txn,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Parent 3d element",
          });
          const childPhysicalElement = insertPhysicalElement({
            txn,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            parentId: parentPhysicalElement.id,
            codeValue: "Child 3d element",
          });
          insertElementHasClassificationsRelationship({ txn, elementId: parentPhysicalElement.id, classificationId: classification.id });

          return { table, classification, parentPhysicalElement, childPhysicalElement };
        }),
      );

      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createClassificationsTreeProvider(imodelConnection, { rootClassificationSystemCode });

      await validateHierarchy({
        provider,
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.table],
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.classification],
                supportsFiltering: true,
                children: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.parentPhysicalElement],
                    supportsFiltering: true,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.childPhysicalElement],
                        supportsFiltering: true,
                        children: false,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    describe("omittedElementClassNames", () => {
      it("does not filter out elements when they don't belong to any of the omitted classes", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, async (txn) => {
            await importClassificationSchema(imodel);

            const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
            const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "TestClassificationTable" });
            const classification = insertClassification({ txn, modelId: table.id, codeValue: "TestClassification" });

            const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "Test physical model" });
            const spatialCategory = insertSpatialCategory({ txn, codeValue: "Test spatial category" });
            const element = insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: spatialCategory.id, codeValue: "Element" });
            insertElementHasClassificationsRelationship({ txn, elementId: element.id, classificationId: classification.id });

            return { table, classification, element };
          }),
        );

        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createClassificationsTreeProvider(imodelConnection, {
          rootClassificationSystemCode,
          omittedElementClassNames: ["BisCore.GeometricElement2d"],
        });

        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.table],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.classification],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.element],
                      supportsFiltering: true,
                      children: false,
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      it("filters out elements of omitted classes", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, async (txn) => {
            await importClassificationSchema(imodel);

            const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
            const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "TestClassificationTable" });
            const classification = insertClassification({ txn, modelId: table.id, codeValue: "TestClassification" });

            const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "Test physical model" });
            const spatialCategory = insertSpatialCategory({ txn, codeValue: "Test spatial category" });
            const omittedElement = insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: spatialCategory.id, codeValue: "Omitted element" });
            const keptElement = insertPhysicalElement({
              txn,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              modelId: physicalModel.id,
              categoryId: spatialCategory.id,
              codeValue: "Kept element",
            });
            insertElementHasClassificationsRelationship({ txn, elementId: omittedElement.id, classificationId: classification.id });
            insertElementHasClassificationsRelationship({ txn, elementId: keptElement.id, classificationId: classification.id });

            return { table, classification, keptElement };
          }),
        );

        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createClassificationsTreeProvider(imodelConnection, {
          rootClassificationSystemCode,
          omittedElementClassNames: ["Generic.PhysicalObject"],
        });

        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.table],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.classification],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.keptElement],
                      supportsFiltering: true,
                      children: false,
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      it("filters out elements of classes derived from omitted classes", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, async (txn) => {
            await importClassificationSchema(imodel);

            const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
            const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "TestClassificationTable" });
            const classification = insertClassification({ txn, modelId: table.id, codeValue: "TestClassification" });

            const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "Test physical model" });
            const spatialCategory = insertSpatialCategory({ txn, codeValue: "Test spatial category" });
            const omittedElement = insertPhysicalElement({
              txn,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              modelId: physicalModel.id,
              categoryId: spatialCategory.id,
              codeValue: "Omitted element",
            });
            const keptElement = insertPhysicalElement({
              txn,
              classFullName: "Generic.SpatialLocation",
              modelId: physicalModel.id,
              categoryId: spatialCategory.id,
              codeValue: "Kept element",
            });
            insertElementHasClassificationsRelationship({ txn, elementId: omittedElement.id, classificationId: classification.id });
            insertElementHasClassificationsRelationship({ txn, elementId: keptElement.id, classificationId: classification.id });

            return { table, classification, keptElement };
          }),
        );

        const { imodelConnection, ...keys } = buildIModelResult;
        // Omitting the base class should filter out elements of all derived classes due to polymorphic class exclusion.
        using provider = createClassificationsTreeProvider(imodelConnection, {
          rootClassificationSystemCode,
          omittedElementClassNames: ["BisCore.PhysicalElement"],
        });

        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.table],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.classification],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.keptElement],
                      supportsFiltering: true,
                      children: false,
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      it("shows classification with no children when it contains only omitted elements", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, async (txn) => {
            await importClassificationSchema(imodel);

            const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
            const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "TestClassificationTable" });
            const classification = insertClassification({ txn, modelId: table.id, codeValue: "TestClassification" });

            const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "Test physical model" });
            const spatialCategory = insertSpatialCategory({ txn, codeValue: "Test spatial category" });
            const omittedElement = insertPhysicalElement({ txn, modelId: physicalModel.id, categoryId: spatialCategory.id, codeValue: "Omitted element" });
            insertElementHasClassificationsRelationship({ txn, elementId: omittedElement.id, classificationId: classification.id });

            return { table, classification };
          }),
        );

        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createClassificationsTreeProvider(imodelConnection, {
          rootClassificationSystemCode,
          omittedElementClassNames: ["Generic.PhysicalObject"],
        });

        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.table],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.classification],
                  supportsFiltering: true,
                  children: false,
                }),
              ],
            }),
          ],
        });
      });

      it("sets hasChildren to false when classified element contains only omitted child elements", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, async (txn) => {
            await importClassificationSchema(imodel);

            const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
            const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "TestClassificationTable" });
            const classification = insertClassification({ txn, modelId: table.id, codeValue: "TestClassification" });

            const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "Test physical model" });
            const spatialCategory = insertSpatialCategory({ txn, codeValue: "Test spatial category" });
            const parentElement = insertPhysicalElement({
              txn,
              classFullName: "Generic.SpatialLocation",
              modelId: physicalModel.id,
              categoryId: spatialCategory.id,
              codeValue: "Parent element",
            });
            insertPhysicalElement({
              txn,
              modelId: physicalModel.id,
              categoryId: spatialCategory.id,
              parentId: parentElement.id,
              codeValue: "Omitted child element",
            });
            insertElementHasClassificationsRelationship({ txn, elementId: parentElement.id, classificationId: classification.id });

            return { table, classification, parentElement };
          }),
        );

        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createClassificationsTreeProvider(imodelConnection, {
          rootClassificationSystemCode,
          omittedElementClassNames: ["Generic.PhysicalObject"],
        });

        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.table],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.classification],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.parentElement],
                      supportsFiltering: true,
                      children: false,
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      it("filters out child elements of omitted classes", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, async (txn) => {
            await importClassificationSchema(imodel);

            const system = insertClassificationSystem({ txn, codeValue: rootClassificationSystemCode });
            const table = insertClassificationTable({ txn, parentId: system.id, codeValue: "TestClassificationTable" });
            const classification = insertClassification({ txn, modelId: table.id, codeValue: "TestClassification" });

            const physicalModel = insertPhysicalModelWithPartition({ txn, codeValue: "Test physical model" });
            const spatialCategory = insertSpatialCategory({ txn, codeValue: "Test spatial category" });
            const parentElement = insertPhysicalElement({
              txn,
              classFullName: "Generic.SpatialLocation",
              modelId: physicalModel.id,
              categoryId: spatialCategory.id,
              codeValue: "Parent element",
            });
            insertPhysicalElement({
              txn,
              modelId: physicalModel.id,
              categoryId: spatialCategory.id,
              parentId: parentElement.id,
              codeValue: "Omitted child element",
            });
            const keptChildElement = insertPhysicalElement({
              txn,
              classFullName: "Generic.SpatialLocation",
              modelId: physicalModel.id,
              categoryId: spatialCategory.id,
              parentId: parentElement.id,
              codeValue: "Kept child element",
            });
            insertElementHasClassificationsRelationship({ txn, elementId: parentElement.id, classificationId: classification.id });

            return { table, classification, parentElement, keptChildElement };
          }),
        );

        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createClassificationsTreeProvider(imodelConnection, {
          rootClassificationSystemCode,
          omittedElementClassNames: ["Generic.PhysicalObject"],
        });

        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.table],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.classification],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.parentElement],
                      supportsFiltering: true,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.keptChildElement],
                          supportsFiltering: true,
                          children: false,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      });
    });
  });
});

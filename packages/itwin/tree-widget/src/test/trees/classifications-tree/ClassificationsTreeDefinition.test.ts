/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../IModelUtils.js";
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
    before(async () => {
      await initializeITwinJs();
    });

    after(async () => {
      await terminateITwinJs();
    });

    it("loads classifications' hierarchy without elements", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
        const parentClassification = insertClassification({ builder, modelId: table.id, codeValue: "TestParentClassification" });
        const childClassification = insertClassification({
          builder,
          modelId: table.id,
          parentId: parentClassification.id,
          codeValue: "TestChildClassification",
        });

        return { table, parentClassification, childClassification };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createClassificationsTreeProvider(imodel, { rootClassificationSystemCode });

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

    it("loads classification elements", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "TestClassification" });

        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Test physical model" });
        const spatialCategory = insertSpatialCategory({ builder, codeValue: "Test spatial category" });
        const parentPhysicalElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "Parent 3d element",
        });
        const childPhysicalElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          parentId: parentPhysicalElement.id,
          codeValue: "Child 3d element",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: parentPhysicalElement.id, classificationId: classification.id });

        return { table, classification, parentPhysicalElement, childPhysicalElement };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createClassificationsTreeProvider(imodel, { rootClassificationSystemCode });

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
  });
});

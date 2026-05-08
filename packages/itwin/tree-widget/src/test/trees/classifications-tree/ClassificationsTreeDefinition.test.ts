/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "test-utilities";
import { afterAll, beforeAll, describe, it } from "vitest";
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
      await using buildIModelResult = await buildIModel(async (imodel) => {
        await importClassificationSchema(imodel);

        const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ imodel, parentId: system.id, codeValue: "TestClassificationTable" });
        const parentClassification = insertClassification({ imodel, modelId: table.id, codeValue: "TestParentClassification" });
        const childClassification = insertClassification({
          imodel,
          modelId: table.id,
          parentId: parentClassification.id,
          codeValue: "TestChildClassification",
        });

        return { table, parentClassification, childClassification };
      });

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
      await using buildIModelResult = await buildIModel(async (imodel) => {
        await importClassificationSchema(imodel);

        const system = insertClassificationSystem({ imodel, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ imodel, parentId: system.id, codeValue: "TestClassificationTable" });
        const classification = insertClassification({ imodel, modelId: table.id, codeValue: "TestClassification" });

        const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "Test physical model" });
        const spatialCategory = insertSpatialCategory({ imodel, codeValue: "Test spatial category" });
        const parentPhysicalElement = insertPhysicalElement({
          imodel,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "Parent 3d element",
        });
        const childPhysicalElement = insertPhysicalElement({
          imodel,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          parentId: parentPhysicalElement.id,
          codeValue: "Child 3d element",
        });
        insertElementHasClassificationsRelationship({ imodel, elementId: parentPhysicalElement.id, classificationId: classification.id });

        return { table, classification, parentPhysicalElement, childPhysicalElement };
      });

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
  });
});

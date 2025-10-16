/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ClassificationsTreeDefinition, ClassificationsTreeIdsCache } from "../../../tree-widget-react-internal.js";
import {
  CLASS_NAME_Classification,
  CLASS_NAME_ClassificationTable,
  CLASS_NAME_GeometricElement2d,
  CLASS_NAME_GeometricElement3d,
} from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { TreeWidgetIdsCache } from "../../../tree-widget-react/components/trees/common/internal/TreeWidgetIdsCache.js";
import {
  buildIModel,
  insertDrawingCategory,
  insertDrawingGraphic,
  insertDrawingModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
} from "../../IModelUtils.js";
import { initializeITwinJs, terminateITwinJs } from "../../Initialize.js";
import { createIModelAccess } from "../Common.js";
import {
  importClassificationSchema,
  insertClassification,
  insertClassificationSystem,
  insertClassificationTable,
  insertElementHasClassificationsRelationship,
} from "./Utils.js";

const rootClassificationSystemCode = "TestClassificationSystem";
const defaultHierarchyConfiguration = {
  rootClassificationSystemCode,
};

describe("Classifications tree", () => {
  describe("Hierarchy filtering", () => {
    before(async function () {
      await initializeITwinJs();
    });

    after(async function () {
      await terminateITwinJs();
    });

    ["Test", "_", "%"].forEach((label) => {
      it(`finds classification table by label when it contains '${label}'`, async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable", userLabel: `${label}Table` });
          const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification" });
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Model" });
          const spatialCategory = insertSpatialCategory({ builder, codeValue: "Category" });
          const element = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: element.id, classificationId: classification.id });

          return { table };
        });
        const { imodel, ...keys } = buildIModelResult;
        const imodelAccess = createIModelAccess(imodel);
        using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration, {
          cache: new TreeWidgetIdsCache(imodel),
          shouldDispose: true,
        });
        expect(
          await ClassificationsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            label,
            idsCache,
            hierarchyConfig: defaultHierarchyConfiguration,
          }),
        ).to.deep.eq([
          {
            path: [{ id: keys.table.id, className: CLASS_NAME_ClassificationTable }],
            options: { autoExpand: true },
          },
        ]);
      });

      it(`finds classification by label when it contains '${label}'`, async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
          const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification", userLabel: `${label}Cl` });
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Model" });
          const spatialCategory = insertSpatialCategory({ builder, codeValue: "Category" });
          const element = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: element.id, classificationId: classification.id });

          return { table, classification };
        });
        const { imodel, ...keys } = buildIModelResult;
        const imodelAccess = createIModelAccess(imodel);
        using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration, {
          cache: new TreeWidgetIdsCache(imodel),
          shouldDispose: true,
        });
        expect(
          await ClassificationsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            label,
            idsCache,
            hierarchyConfig: defaultHierarchyConfiguration,
          }),
        ).to.deep.eq([
          {
            path: [
              { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
              { id: keys.classification.id, className: CLASS_NAME_Classification },
            ],
            options: { autoExpand: true },
          },
        ]);
      });

      it(`finds 3d element by label when it contains '${label}'`, async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
          const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification" });
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Model" });
          const spatialCategory = insertSpatialCategory({ builder, codeValue: "Category" });
          const element = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Element",
            userLabel: `${label}El`,
          });
          insertElementHasClassificationsRelationship({ builder, elementId: element.id, classificationId: classification.id });

          return { table, classification, element };
        });
        const { imodel, ...keys } = buildIModelResult;
        const imodelAccess = createIModelAccess(imodel);
        using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration, {
          cache: new TreeWidgetIdsCache(imodel),
          shouldDispose: true,
        });
        expect(
          await ClassificationsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            label,
            idsCache,
            hierarchyConfig: defaultHierarchyConfiguration,
          }),
        ).to.deep.eq([
          {
            path: [
              { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
              { id: keys.classification.id, className: CLASS_NAME_Classification },
              { id: keys.element.id, className: CLASS_NAME_GeometricElement3d },
            ],
            options: { autoExpand: true },
          },
        ]);
      });

      it(`finds 3d child element by label when it contains '${label}'`, async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
          const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification" });
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Model" });
          const spatialCategory = insertSpatialCategory({ builder, codeValue: "Category" });
          const parentElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Parent Element",
          });
          insertElementHasClassificationsRelationship({ builder, elementId: parentElement.id, classificationId: classification.id });
          const childElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            codeValue: "Child Element",
            userLabel: `${label}ChildEl`,
            parentId: parentElement.id,
          });

          return { table, classification, parentElement, childElement };
        });
        const { imodel, ...keys } = buildIModelResult;
        const imodelAccess = createIModelAccess(imodel);
        using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration, {
          cache: new TreeWidgetIdsCache(imodel),
          shouldDispose: true,
        });
        expect(
          await ClassificationsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            label,
            idsCache,
            hierarchyConfig: defaultHierarchyConfiguration,
          }),
        ).to.deep.eq([
          {
            path: [
              { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
              { id: keys.classification.id, className: CLASS_NAME_Classification },
              { id: keys.parentElement.id, className: CLASS_NAME_GeometricElement3d },
              { id: keys.childElement.id, className: CLASS_NAME_GeometricElement3d },
            ],
            options: { autoExpand: true },
          },
        ]);
      });

      it(`finds 2d element by label when it contains '${label}'`, async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          await importClassificationSchema(builder);

          const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
          const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
          const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification" });
          const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "model" });
          const drawingCategory = insertDrawingCategory({ builder, codeValue: "category" });
          const element = insertDrawingGraphic({
            builder,
            modelId: drawingModel.id,
            categoryId: drawingCategory.id,
            codeValue: "element",
            userLabel: `${label}El`,
          });
          insertElementHasClassificationsRelationship({ builder, elementId: element.id, classificationId: classification.id });

          return { table, classification, element };
        });
        const { imodel, ...keys } = buildIModelResult;
        const imodelAccess = createIModelAccess(imodel);
        using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration, {
          cache: new TreeWidgetIdsCache(imodel),
          shouldDispose: true,
        });
        expect(
          await ClassificationsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            label,
            idsCache,
            hierarchyConfig: defaultHierarchyConfiguration,
          }),
        ).to.deep.eq([
          {
            path: [
              { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
              { id: keys.classification.id, className: CLASS_NAME_Classification },
              { id: keys.element.id, className: CLASS_NAME_GeometricElement2d },
            ],
            options: { autoExpand: true },
          },
        ]);
      });
    });

    it("returns empty array when nothing matches provided filter", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification" });
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "physical model" });
        const spatialCategory = insertSpatialCategory({ builder, codeValue: "physical category" });
        const physicalElement = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "Physical element",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: physicalElement.id, classificationId: classification.id });
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "drawing model" });
        const drawingCategory = insertDrawingCategory({ builder, codeValue: "drawing category" });
        const drawingElement = insertDrawingGraphic({
          builder,
          modelId: drawingModel.id,
          categoryId: drawingCategory.id,
          codeValue: "Drawing element",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: drawingElement.id, classificationId: classification.id });
      });
      const { imodel } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration, {
        cache: new TreeWidgetIdsCache(imodel),
        shouldDispose: true,
      });
      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
          idsCache,
          hierarchyConfig: defaultHierarchyConfiguration,
        }),
      ).to.deep.eq([]);
    });
  });
});

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

    it("finds classification table by label", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable", userLabel: "Test" });
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
      using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);
      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
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

    it("finds classification by label", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification", userLabel: "Test" });
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
      using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);
      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
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

    it("finds 3d element by label", async function () {
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
          userLabel: "Test",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: element.id, classificationId: classification.id });

        return { table, classification, element };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);
      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
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

    it("finds 3d child element by label", async function () {
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
          userLabel: "Test",
          parentId: parentElement.id,
        });

        return { table, classification, parentElement, childElement };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);
      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
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

    it("finds 2d element by label", async function () {
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
          userLabel: "Test",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: element.id, classificationId: classification.id });

        return { table, classification, element };
      });
      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);
      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
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
      using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);
      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: "Test",
          idsCache,
          hierarchyConfig: defaultHierarchyConfiguration,
        }),
      ).to.deep.eq([]);
    });

    it("finds classification table by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table1 = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable", userLabel: "Test Classification_Table" });
        const table2 = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable2", userLabel: "Test Classification%Table" });

        return { table1, table2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);

      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "_",
          idsCache,
        }),
      ).to.deep.eq([{ path: [{ id: keys.table1.id, className: CLASS_NAME_ClassificationTable }], options: { autoExpand: true } }]);

      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "%",
          idsCache,
        }),
      ).to.deep.eq([{ path: [{ id: keys.table2.id, className: CLASS_NAME_ClassificationTable }], options: { autoExpand: true } }]);
    });

    it("finds classification by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification1 = insertClassification({ builder, modelId: table.id, codeValue: "Classification", userLabel: "Classific_ation" });
        const classification2 = insertClassification({ builder, modelId: table.id, codeValue: "Classification2", userLabel: "Classific%ation" });

        return { table, classification1, classification2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);

      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "_",
          idsCache,
        }),
      ).to.deep.eq([
        {
          path: [
            { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
            { id: keys.classification1.id, className: CLASS_NAME_Classification },
          ],
          options: { autoExpand: true },
        },
      ]);

      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "%",
          idsCache,
        }),
      ).to.deep.eq([
        {
          path: [
            { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
            { id: keys.classification2.id, className: CLASS_NAME_Classification },
          ],
          options: { autoExpand: true },
        },
      ]);
    });

    it("finds 2d element by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification" });
        const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "model" });
        const drawingCategory = insertDrawingCategory({ builder, codeValue: "category" });
        const element1 = insertDrawingGraphic({
          builder,
          modelId: drawingModel.id,
          categoryId: drawingCategory.id,
          userLabel: "drawing_element",
          codeValue: "drawing element",
        });
        const element2 = insertDrawingGraphic({
          builder,
          modelId: drawingModel.id,
          categoryId: drawingCategory.id,
          userLabel: "drawing%element",
          codeValue: "drawing element",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: element1.id, classificationId: classification.id });
        insertElementHasClassificationsRelationship({ builder, elementId: element2.id, classificationId: classification.id });

        return { table, classification, element1, element2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);

      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "_",
          idsCache,
        }),
      ).to.deep.eq([
        {
          path: [
            { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
            { id: keys.classification.id, className: CLASS_NAME_Classification },
            { id: keys.element1.id, className: CLASS_NAME_GeometricElement2d },
          ],
          options: { autoExpand: true },
        },
      ]);

      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "%",
          idsCache,
        }),
      ).to.deep.eq([
        {
          path: [
            { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
            { id: keys.classification.id, className: CLASS_NAME_Classification },
            { id: keys.element2.id, className: CLASS_NAME_GeometricElement2d },
          ],
          options: { autoExpand: true },
        },
      ]);
    });

    it("finds 3d element by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "ClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "Classification" });
        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "Model" });
        const spatialCategory = insertSpatialCategory({ builder, codeValue: "Category" });
        const element1 = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "Element",
          userLabel: "physical_element",
        });
        const element2 = insertPhysicalElement({
          builder,
          modelId: physicalModel.id,
          categoryId: spatialCategory.id,
          codeValue: "Element",
          userLabel: "physical%element",
        });
        insertElementHasClassificationsRelationship({ builder, elementId: element1.id, classificationId: classification.id });
        insertElementHasClassificationsRelationship({ builder, elementId: element2.id, classificationId: classification.id });

        return { table, classification, element1, element2 };
      });

      const { imodel, ...keys } = buildIModelResult;
      const imodelAccess = createIModelAccess(imodel);
      using idsCache = new ClassificationsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);

      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "_",
          idsCache,
        }),
      ).to.deep.eq([
        {
          path: [
            { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
            { id: keys.classification.id, className: CLASS_NAME_Classification },
            { id: keys.element1.id, className: CLASS_NAME_GeometricElement3d },
          ],
          options: { autoExpand: true },
        },
      ]);

      expect(
        await ClassificationsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          hierarchyConfig: defaultHierarchyConfiguration,
          label: "%",
          idsCache,
        }),
      ).to.deep.eq([
        {
          path: [
            { id: keys.table.id, className: CLASS_NAME_ClassificationTable },
            { id: keys.classification.id, className: CLASS_NAME_Classification },
            { id: keys.element2.id, className: CLASS_NAME_GeometricElement3d },
          ],
          options: { autoExpand: true },
        },
      ]);
    });
  });
});

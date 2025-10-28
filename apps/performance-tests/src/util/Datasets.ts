/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import {
  insertDefinitionContainer,
  insertDrawingCategory,
  insertDrawingElement,
  insertDrawingModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  insertSubCategory,
} from "test-utilities";
import { BisCodeSpec, IModel } from "@itwin/core-common";
import { createIModel } from "./IModelUtilities.js";

export const IMODEL_NAMES = ["50k 3D elements", "50k subcategories", "50k categories", "50k classifications"] as const;
export type IModelName = (typeof IMODEL_NAMES)[number];
export type IModelPathsMap = { [_ in IModelName]?: string };

export class Datasets {
  private static readonly _iModels: IModelPathsMap = {};

  public static readonly CUSTOM_SCHEMA = {
    schemaName: "PerformanceTests",
    defaultClassName: "PerformanceTests",
    baseClassName: "Base_PerformanceTests",
    defaultUserLabel: "Element",
    customPropName: "PropX",
    defaultPropertyValue: "PropertyValue",
    itemsPerGroup: 100,
  };

  public static getIModelPath(name: IModelName): string {
    return this.verifyInitialized(this._iModels[name]);
  }

  public static async initialize(datasetsDirPath: string) {
    fs.mkdirSync(datasetsDirPath, { recursive: true });

    const promises = IMODEL_NAMES.map(async (key) => {
      const elementCount = 1000 * Number.parseInt(/(\d+)k/.exec(key)![1], 10);
      this._iModels[key] = await this.createIModel(key, datasetsDirPath, this.getIModelFactory(key, elementCount), !!process.env.RECREATE);
    });
    await Promise.all(promises);
  }

  private static verifyInitialized<T>(arg: T | undefined): T {
    if (arg === undefined) {
      throw new Error("Datasets haven't been initialized. Call initialize() function before accessing the datasets.");
    }
    return arg;
  }

  private static async createIModel(
    name: string,
    folderPath: string,
    iModelFactory: (name: string, localPath: string) => void | Promise<void>,
    force?: boolean,
  ) {
    const localPath = path.join(folderPath, `${name}.bim`);

    if (force || !fs.existsSync(localPath)) {
      try {
        await iModelFactory(name, localPath);
      } catch (e) {
        fs.unlinkSync(localPath);
        throw e;
      }
    }

    return path.resolve(localPath);
  }

  private static getIModelFactory(key: IModelName, elementCount: number) {
    switch (key) {
      case "50k categories":
        return async (name: string, localPath: string) => this.createCategoryIModel(name, localPath, elementCount);
      case "50k subcategories":
        return async (name: string, localPath: string) => this.createSubCategoryIModel(name, localPath, elementCount);
      case "50k 3D elements":
        return async (name: string, localPath: string) => this.create3dElementIModel(name, localPath, elementCount);
      case "50k classifications":
        return async (name: string, localPath: string) => this.createClassificationsIModel(name, localPath, elementCount);
    }
  }

  /**
   * Create an iModel with one root definition container which has child definition containers which contain 1k categories each.
   * In total there are `numElements` number of categories.
   */
  private static async createCategoryIModel(name: string, localPath: string, numElements: number) {
    console.log(`${numElements} categories: Creating...`);
    await createIModel(name, localPath, async (builder) => {
      const { id: physicalModelId } = insertPhysicalModelWithPartition({ builder, codeValue: "test physical model" });
      const rootDefinitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
      const rootDefinitionModel = insertPhysicalSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: rootDefinitionContainer.id });
      const numberOfCategoriesPerDefinitionContainer = 1000;
      const numberOfDefinitionContainers = Math.round(numElements / numberOfCategoriesPerDefinitionContainer);
      for (let i = 0; i < numberOfDefinitionContainers; ++i) {
        const definitionContainer = insertDefinitionContainer({ builder, codeValue: `DefinitionContainer ${i}`, modelId: rootDefinitionModel.id });
        const definitionModel = insertPhysicalSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });
        const numberOfCategories =
          i + 1 < numberOfDefinitionContainers
            ? numberOfCategoriesPerDefinitionContainer
            : numElements - (numberOfDefinitionContainers - 1) * numberOfCategoriesPerDefinitionContainer;
        for (let j = 0; j < numberOfCategories; ++j) {
          const { id: categoryId } = insertSpatialCategory({
            builder,
            codeValue: `c${j}`,
            userLabel: `test_category${j}`,
            modelId: definitionModel.id,
          });
          insertPhysicalElement({
            builder,
            modelId: physicalModelId,
            categoryId,
            userLabel: "test_element",
          });
        }
      }
    });

    console.log(`${numElements} categories: Done.`);
  }

  /**
   * Create an iModel with `numElements` subcategories all belonging to the same parent spatial category.
   */
  private static async createSubCategoryIModel(name: string, localPath: string, numElements: number) {
    console.log(`${numElements} sub-categories: Creating...`);
    await createIModel(name, localPath, async (builder) => {
      const { id: physicalModelId } = insertPhysicalModelWithPartition({ builder, codeValue: "test physical model" });
      const { id: categoryId } = insertSpatialCategory({
        builder,
        codeValue: "sc",
        userLabel: "test_category",
      });
      insertPhysicalElement({
        builder,
        modelId: physicalModelId,
        categoryId,
        userLabel: "test_element",
      }).id;

      // Insert `numElements` - 1 subcategories as `insertSpatialCategory` provides one additional subcategory
      for (let i = 0; i < numElements - 1; ++i) {
        insertSubCategory({
          parentCategoryId: categoryId,
          builder,
          codeValue: `${i}`,
          userLabel: `sc`,
        });
      }
    });

    console.log(`${numElements} sub-categories: Done.`);
  }

  /**
   * Create an iModel with `numElements` 3D elements all belonging to the same spatial category and physical model.
   * The elements are set up in a hierarchical manner, with 1000 top level 3D elements, each having 1 child element, which has 1 child element,
   * and so on until the depth of `numElements` / 1000 elements is reached.
   */
  private static async create3dElementIModel(name: string, localPath: string, numElements: number) {
    console.log(`${numElements} physical elements: Creating...`);

    await createIModel(name, localPath, async (builder) => {
      const { id: physicalModelId } = insertPhysicalModelWithPartition({ builder, codeValue: "test physical model" });
      const { id: categoryId } = insertSpatialCategory({ builder, codeValue: "test category" });

      const numberOfGroups = 1000;
      const elementsPerGroup = numElements / numberOfGroups;

      for (let i = 0; i < numberOfGroups; ++i) {
        let physicalElementParentId: string | undefined;

        for (let j = 0; j < elementsPerGroup; ++j) {
          physicalElementParentId = insertPhysicalElement({
            builder,
            parentId: physicalElementParentId,
            modelId: physicalModelId,
            categoryId,
            userLabel: "test_element",
          }).id;
        }
      }
    });

    console.log(`${numElements} physical elements: Done.`);
  }

  /**
   * Create an iModel with:
   * - 1 `ClassificationSystem`, whose code = `name`,
   * - 50 `ClassificationTable` elements as children for the `ClassificationSystem` all with a single sub-model,
   * - `numElements / 50` `Classification` elements inside `ClassificationTable`'s sub-model with:
   *  - 1 child `Classification`,
   *  - 1 spatial category and 3d element,
   *  - 1 drawing category and 2d element.
   */
  private static async createClassificationsIModel(name: string, localPath: string, numElements: number) {
    console.log(`${numElements} classifications: Creating...`);
    await createIModel(name, localPath, async (builder) => {
      const schemaPath = import.meta.resolve("@bentley/classification-systems-schema/ClassificationSystems.ecschema.xml");
      const schemaXml = fs.readFileSync(fs.realpathSync(new URL(schemaPath)), { encoding: "utf-8" });
      await builder.importFullSchema(schemaXml);

      // also import our custom schema for classification - category relationship

      // cspell:disable
      await builder.importSchema(
        "TestClassificationSchema",
        `
          <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
          <ECSchemaReference name="ClassificationSystems" version="01.00.04" alias="clsf" />
          <ECRelationshipClass typeName="CategorySymbolizesClassification" modifier="None" strength="referencing">
              <BaseClass>bis:ElementRefersToElements</BaseClass>
              <Source multiplicity="(0..*)" roleLabel="symbolizes" polymorphic="true">
                  <Class class="bis:Category" />
              </Source>
              <Target multiplicity="(0..*)" roleLabel="is symbolized by" polymorphic="true">
                  <Class class="clsf:Classification"/>
              </Target>
          </ECRelationshipClass>
        `,
        // cspell:enable
      );

      const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "physical model" });
      const drawingModel = insertDrawingModelWithPartition({ builder, codeValue: "drawing model" });

      const systemId = builder.insertElement({
        classFullName: "ClassificationSystems.ClassificationSystem",
        model: IModel.dictionaryId,
        code: builder.createCode(IModel.dictionaryId, BisCodeSpec.nullCodeSpec, name),
      });

      const classificationTablesCount = 50;
      for (let i = 0; i < classificationTablesCount; ++i) {
        const tableId = builder.insertElement({
          classFullName: "ClassificationSystems.ClassificationTable",
          model: IModel.dictionaryId,
          parent: {
            relClassName: "ClassificationSystems.ClassificationSystemOwnsClassificationTable",
            id: systemId,
          },
          code: builder.createCode(IModel.dictionaryId, BisCodeSpec.nullCodeSpec, `Table ${i + 1}`),
        });
        const tableModelId = builder.insertModel({
          classFullName: "BisCore.DefinitionModel",
          modeledElement: {
            relClassName: "ClassificationSystems.DefinitionModelBreaksDownClassificationTable",
            id: tableId,
          },
        });
        for (let j = 0; j < numElements / classificationTablesCount; ++j) {
          const classificationId = builder.insertElement({
            classFullName: "ClassificationSystems.Classification",
            model: tableModelId,
            code: builder.createCode(tableModelId, BisCodeSpec.nullCodeSpec, `Classification ${j + 1}`),
          });

          builder.insertElement({
            classFullName: "ClassificationSystems.Classification",
            model: tableModelId,
            code: builder.createCode(tableModelId, BisCodeSpec.nullCodeSpec, `Child classification ${j + 1}`),
            parent: {
              relClassName: "ClassificationSystems.ClassificationOwnsSubClassifications",
              id: classificationId,
            },
          });

          const spatialCategory = insertSpatialCategory({
            builder,
            codeValue: `Spatial category ${j + 1}`,
            modelId: tableModelId,
          });
          const physicalElement = insertPhysicalElement({
            builder,
            modelId: physicalModel.id,
            categoryId: spatialCategory.id,
            userLabel: `physical element ${i + 1} ${j + 1}`,
          });
          builder.insertRelationship({
            classFullName: "ClassificationSystems.ElementHasClassifications",
            sourceId: physicalElement.id,
            targetId: classificationId,
          });
          builder.insertRelationship({
            classFullName: "TestClassificationSchema.CategorySymbolizesClassification",
            sourceId: spatialCategory.id,
            targetId: classificationId,
          });

          const drawingCategory = insertDrawingCategory({
            builder,
            codeValue: `Drawing category ${j + 1}`,
            modelId: tableModelId,
          });
          const drawingElement = insertDrawingElement({
            builder,
            modelId: drawingModel.id,
            categoryId: drawingCategory.id,
            userLabel: `drawing element ${i + 1} ${j + 1}`,
          });
          builder.insertRelationship({
            classFullName: "ClassificationSystems.ElementHasClassifications",
            sourceId: drawingElement.id,
            targetId: classificationId,
          });
          builder.insertRelationship({
            classFullName: "TestClassificationSchema.CategorySymbolizesClassification",
            sourceId: drawingCategory.id,
            targetId: classificationId,
          });
        }
      }
    });

    console.log(`${numElements} classifications: Done.`);
  }
}

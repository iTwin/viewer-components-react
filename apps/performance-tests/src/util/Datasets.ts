/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import fs from "fs";
import path from "path";
import {
  insertDefinitionContainer,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  insertSubCategory,
} from "test-utilities";
import { createIModel } from "./IModelUtilities.js";

export const IMODEL_NAMES = ["50k 3D elements", "50k subcategories", "50k categories"] as const;
export type IModelName = (typeof IMODEL_NAMES)[number];
export type IModelPathsMap = { [_ in IModelName]?: string };

export class Datasets {
  static readonly #iModels: IModelPathsMap = {};

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
    return this.verifyInitialized(this.#iModels[name]);
  }

  public static async initialize(datasetsDirPath: string) {
    fs.mkdirSync(datasetsDirPath, { recursive: true });

    const promises = IMODEL_NAMES.map(async (key) => {
      const elementCount = 1000 * Number.parseInt(/(\d+)k/.exec(key)![1], 10);
      this.#iModels[key] = await this.createIModel(key, datasetsDirPath, this.getIModelFactory(key, elementCount), !!process.env.RECREATE);
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
      await iModelFactory(name, localPath);
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
    }
  }

  /**
   * Create an iModel with `numElements` categories all belonging to the same definition container.
   */
  private static async createCategoryIModel(name: string, localPath: string, numElements: number) {
    // eslint-disable-next-line no-console
    console.log(`${numElements} elements: Creating...`);
    await createIModel(name, localPath, async (builder) => {
      const { id: physicalModelId } = insertPhysicalModelWithPartition({ builder, codeValue: "test physical model" });
      const definitionContainer = insertDefinitionContainer({ builder, codeValue: "DefinitionContainerRoot" });
      const definitionModel = insertPhysicalSubModel({ builder, classFullName: "BisCore.DefinitionModel", modeledElementId: definitionContainer.id });

      for (let i = 0; i < numElements; ++i) {
        const { id: categoryId } = insertSpatialCategory({
          builder,
          codeValue: `c${i}`,
          userLabel: `test_category${i}`,
          modelId: definitionModel.id,
        });
        insertPhysicalElement({
          builder,
          modelId: physicalModelId,
          categoryId,
          userLabel: "test_element",
        }).id;
      }
    });

    // eslint-disable-next-line no-console
    console.log(`${numElements} elements: Done.`);
  }

  /**
   * Create an iModel with `numElements` subcategories all belonging to the same parent spatial category.
   */
  private static async createSubCategoryIModel(name: string, localPath: string, numElements: number) {
    // eslint-disable-next-line no-console
    console.log(`${numElements} elements: Creating...`);
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

    // eslint-disable-next-line no-console
    console.log(`${numElements} elements: Done.`);
  }

  /**
   * Create an iModel with `numElements` 3D elements all belonging to the same spatial category and physical model.
   * The elements are set up in a hierarchical manner, with 1000 top level 3D elements, each having 1 child element, which has 1 child element,
   * and so on until the depth of `numElements` / 1000 elements is reached.
   */
  private static async create3dElementIModel(name: string, localPath: string, numElements: number) {
    // eslint-disable-next-line no-console
    console.log(`${numElements} physical elements: Creating...`);

    await createIModel(name, localPath, async (builder) => {
      const { id: physicalModelId } = insertPhysicalModelWithPartition({ builder, codeValue: "test physical model" });
      const { id: categoryId } = insertSpatialCategory({ builder, codeValue: "test category" });

      const numberOfRootElements = 1000;
      // Number of children each direct child should have
      const numberOfIndirectChildren = 2;
      // Number of children each root element should have
      const numberOfDirectChildren = Math.floor((numElements - numberOfRootElements) / (numberOfRootElements * (numberOfIndirectChildren + 1)));
      // Due to rounding not enough elements would be inserted, calculate how many more nodes we need to add
      let numberOfMissingElements =
        numElements -
        numberOfRootElements -
        numberOfRootElements * numberOfDirectChildren -
        numberOfRootElements * numberOfDirectChildren * numberOfIndirectChildren;
      for (let i = 0; i < numberOfRootElements; ++i) {
        const rootElementId = insertPhysicalElement({
          builder,
          parentId: undefined,
          modelId: physicalModelId,
          categoryId,
          userLabel: `root element${i}`,
        }).id;
        for (let j = 0; j < numberOfDirectChildren; ++j) {
          const directChildId = insertPhysicalElement({
            builder,
            parentId: rootElementId,
            modelId: physicalModelId,
            categoryId,
            userLabel: `direct child ${i}-${j}`,
          }).id;
          for (let z = 0; z < numberOfIndirectChildren; ++z) {
            insertPhysicalElement({
              builder,
              parentId: directChildId,
              modelId: physicalModelId,
              categoryId,
              userLabel: `indirect child ${i}-${j}-${z}`,
            });
          }
          if (numberOfMissingElements > 0) {
            insertPhysicalElement({
              builder,
              parentId: directChildId,
              modelId: physicalModelId,
              categoryId,
              userLabel: `indirect child ${i}-${j}-missing`,
            });
            --numberOfMissingElements;
          }
        }
      }
    });

    // eslint-disable-next-line no-console
    console.log(`${numElements} elements: Done.`);
  }
}

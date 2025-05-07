/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import fs from "fs";
import path from "path";
import {
  insertFunctionalElement,
  insertFunctionalModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
  insertSubCategory,
} from "test-utilities";
import * as url from "url";
import { createIModel } from "./IModelUtilities.js";

export const IMODEL_NAMES = ["5k subcategories", "5k functional 3D elements", "50k subcategories", "50k functional 3D elements"] as const;
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
      await iModelFactory(name, localPath);
    }

    return path.resolve(localPath);
  }

  private static getIModelFactory(key: IModelName, elementCount: number) {
    switch (key) {
      case "5k subcategories":
        return async (name: string, localPath: string) => this.createCategoryIModel(name, localPath, elementCount);
      case "5k functional 3D elements":
        return async (name: string, localPath: string) => this.createFunctional3dElementIModel(name, localPath, elementCount);
      case "50k subcategories":
        return async (name: string, localPath: string) => this.createCategoryIModel(name, localPath, elementCount);
      case "50k functional 3D elements":
        return async (name: string, localPath: string) => this.createFunctional3dElementIModel(name, localPath, elementCount);
    }
  }

  /**
   * Create an iModel with `numElements` subcategories all belonging to the same parent spatial category.
   */
  private static async createCategoryIModel(name: string, localPath: string, numElements: number) {
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
   * Create an iModel with `numElements` functional 3D elements all belonging to the same spatial category, physical model and functional model.
   * The elements are set up in a hierarchical manner, with 1000 top level 3D elements, each having 1 child element, which has 1 child element,
   * and so on until the depth of `numElements` / 1000 elements is reached. Each 3D element has a related functional element.
   */
  private static async createFunctional3dElementIModel(name: string, localPath: string, numElements: number) {
    // eslint-disable-next-line no-console
    console.log(`${numElements} elements: Creating...`);
    const schema = await this.getSchemaFromPackage("functional-schema", "Functional.ecschema.xml");

    await createIModel(name, localPath, async (builder) => {
      await builder.importFullSchema(schema);
      const { id: physicalModelId } = insertPhysicalModelWithPartition({ builder, codeValue: "test physical model" });
      const { id: functionalModelId } = insertFunctionalModelWithPartition({ builder, codeValue: "test functional model" });
      const { id: categoryId } = insertSpatialCategory({ builder, codeValue: "test category" });

      const numberOfGroups = 1000;
      const elementsPerGroup = numElements / numberOfGroups;

      for (let i = 0; i < numberOfGroups; ++i) {
        let physicalElementParentId: string | undefined;
        let functionalElementParentId: string | undefined;

        for (let j = 0; j < elementsPerGroup; ++j) {
          physicalElementParentId = insertPhysicalElement({
            builder,
            parentId: physicalElementParentId,
            modelId: physicalModelId,
            categoryId,
            userLabel: "test_element",
          }).id;
          functionalElementParentId = insertFunctionalElement({
            builder,
            parentId: functionalElementParentId,
            modelId: functionalModelId,
            representedElementId: physicalElementParentId,
            relationshipName: "PhysicalElementFulfillsFunction",
            userLabel: "test_functional_element",
          }).id;
        }
      }
    });

    // eslint-disable-next-line no-console
    console.log(`${numElements} elements: Done.`);
  }

  private static async getSchemaFromPackage(packageName: string, schemaFileName: string): Promise<string> {
    const schemaFile = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..", "node_modules", "@bentley", packageName, schemaFileName);
    return fs.readFileSync(schemaFile, "utf8");
  }
}

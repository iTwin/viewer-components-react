/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import fs from "node:fs";
import { BisCodeSpec, Code, IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { ClassificationsTreeIdsCache } from "../../../tree-widget-react-internal.js";
import { ClassificationsTreeDefinition } from "../../../tree-widget-react/components/trees/classifications-tree/ClassificationsTreeDefinition.js";
import {
  buildIModel,
  importSchema,
  insertDefinitionSubModel,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
} from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";
import { NodeValidators, validateHierarchy } from "../HierarchyValidation.js";

import type { TestIModelBuilder } from "@itwin/presentation-testing";
import type { HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { IModelConnection } from "@itwin/core-frontend";
import type { ClassificationsTreeHierarchyConfiguration } from "../../../tree-widget-react/components/trees/classifications-tree/ClassificationsTreeDefinition.js";
import type { Id64String } from "@itwin/core-bentley";
import type { DefinitionElementProps } from "@itwin/core-common";

const rootClassificationSystemCode = "TestClassificationSystem";
const categorySymbolizesClassificationRelationshipName = "TestClassificationSchema.CategorySymbolizesClassification";

describe("Classifications tree", () => {
  describe("Hierarchy definition", () => {
    before(async function () {
      await initializePresentationTesting({
        rpcs: [IModelReadRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async function () {
      await terminatePresentationTesting();
    });

    it("does not load categories without elements if classification-category relationship is not specified", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "TestClassification" });

        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const categoryWithElement = insertSpatialCategory({ builder, codeValue: "Test category with element" });
        insertClassificationSymbolizedByCategoryRelationship({ builder, categoryId: categoryWithElement.id, classificationId: classification.id });
        const elementInCategory = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: categoryWithElement.id });
        insertElementHasClassificationsRelationship({ builder, elementId: elementInCategory.id, classificationId: classification.id });

        const categoryWithoutElement = insertSpatialCategory({ builder, codeValue: "Test category without element" });
        insertClassificationSymbolizedByCategoryRelationship({ builder, categoryId: categoryWithoutElement.id, classificationId: classification.id });

        return { table, classification, categoryWithElement, categoryWithoutElement, elementInCategory };
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
                    instanceKeys: [keys.categoryWithElement],
                    supportsFiltering: true,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.elementInCategory],
                        supportsFiltering: true,
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

    it("loads categories without elements if classification-category relationship is specified", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        await importClassificationSchema(builder);

        const system = insertClassificationSystem({ builder, codeValue: rootClassificationSystemCode });
        const table = insertClassificationTable({ builder, parentId: system.id, codeValue: "TestClassificationTable" });
        const classification = insertClassification({ builder, modelId: table.id, codeValue: "TestClassification" });

        const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
        const categoryWithElement = insertSpatialCategory({ builder, codeValue: "Test category with element" });
        insertClassificationSymbolizedByCategoryRelationship({ builder, categoryId: categoryWithElement.id, classificationId: classification.id });
        const elementInCategory = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: categoryWithElement.id });
        insertElementHasClassificationsRelationship({ builder, elementId: elementInCategory.id, classificationId: classification.id });

        const categoryWithoutElement = insertSpatialCategory({ builder, codeValue: "Test category without element" });
        insertClassificationSymbolizedByCategoryRelationship({ builder, categoryId: categoryWithoutElement.id, classificationId: classification.id });

        return { table, classification, categoryWithElement, categoryWithoutElement, elementInCategory };
      });

      const { imodel, ...keys } = buildIModelResult;
      using provider = createClassificationsTreeProvider(imodel, { rootClassificationSystemCode, categorySymbolizesClassificationRelationshipName });

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
                    instanceKeys: [keys.categoryWithElement],
                    supportsFiltering: true,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.elementInCategory],
                        supportsFiltering: true,
                      }),
                    ],
                  }),
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.categoryWithoutElement],
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
  });
});

function createClassificationsTreeProvider(
  imodel: IModelConnection,
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration,
): HierarchyProvider & Disposable {
  const imodelAccess = createIModelAccess(imodel);
  const idsCache = new ClassificationsTreeIdsCache(imodelAccess, hierarchyConfig);
  const hierarchyProvider = createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new ClassificationsTreeDefinition({
      imodelAccess,
      idsCache,
      hierarchyConfig,
    }),
  });
  return {
    hierarchyChanged: hierarchyProvider.hierarchyChanged,
    getNodes: (props) => hierarchyProvider.getNodes(props),
    getNodeInstanceKeys: (props) => hierarchyProvider.getNodeInstanceKeys(props),
    setFormatter: (formatter) => hierarchyProvider.setFormatter(formatter),
    setHierarchyFilter: (props) => hierarchyProvider.setHierarchyFilter(props),
    [Symbol.dispose]() {
      hierarchyProvider[Symbol.dispose]();
      idsCache[Symbol.dispose]();
    },
  };
}

function insertClassificationSystem(
  props: {
    builder: TestIModelBuilder;
    modelId?: Id64String;
    codeValue?: string;
  } & Partial<Omit<DefinitionElementProps, "id" | "parent" | "code" | "model">>,
) {
  const { builder, codeValue, modelId, ...elementProps } = props;
  const className = `ClassificationSystems.ClassificationSystem`;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId ?? IModel.dictionaryId,
    code: codeValue ? builder.createCode(modelId ?? IModel.dictionaryId, BisCodeSpec.nullCodeSpec, codeValue) : Code.createEmpty(),
    ...elementProps,
  });
  return { className, id };
}

function insertClassificationTable(
  props: {
    builder: TestIModelBuilder;
    modelId?: Id64String;
    parentId?: Id64String;
    codeValue?: string;
  } & Partial<Omit<DefinitionElementProps, "id" | "parent" | "code" | "model">>,
) {
  const { builder, codeValue, modelId, parentId, ...elementProps } = props;
  const className = `ClassificationSystems.ClassificationTable`;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId ?? IModel.dictionaryId,
    code: codeValue ? builder.createCode(parentId ?? modelId ?? IModel.dictionaryId, BisCodeSpec.nullCodeSpec, codeValue) : Code.createEmpty(),
    parent: parentId
      ? {
          id: parentId,
          relClassName: "ClassificationSystems.ClassificationSystemOwnsClassificationTable",
        }
      : undefined,
    ...elementProps,
  });
  insertDefinitionSubModel({
    builder,
    modeledElementId: id,
    modelModelsElementRelationshipName: "ClassificationSystems.DefinitionModelBreaksDownClassificationTable",
  });
  return { className, id };
}

function insertClassification(
  props: {
    builder: TestIModelBuilder;
    modelId: Id64String;
    parentId?: Id64String;
    codeValue?: string;
  } & Partial<Omit<DefinitionElementProps, "id" | "parent" | "code" | "model">>,
) {
  const { builder, codeValue, modelId, parentId, ...elementProps } = props;
  const className = `ClassificationSystems.Classification`;
  const id = builder.insertElement({
    classFullName: className,
    model: modelId,
    code: codeValue ? builder.createCode(parentId ?? modelId, BisCodeSpec.nullCodeSpec, codeValue) : Code.createEmpty(),
    parent: parentId
      ? {
          id: parentId,
          relClassName: "ClassificationSystems.ClassificationOwnsSubClassifications",
        }
      : undefined,
    ...elementProps,
  });
  return { className, id };
}

function insertElementHasClassificationsRelationship(props: { builder: TestIModelBuilder; elementId: Id64String; classificationId: Id64String }) {
  const { builder, elementId, classificationId } = props;
  return builder.insertRelationship({
    classFullName: "ClassificationSystems.ElementHasClassifications",
    sourceId: elementId,
    targetId: classificationId,
  });
}

function insertClassificationSymbolizedByCategoryRelationship(props: { builder: TestIModelBuilder; categoryId: Id64String; classificationId: Id64String }) {
  const { builder, categoryId, classificationId } = props;
  return builder.insertRelationship({
    classFullName: categorySymbolizesClassificationRelationshipName,
    sourceId: categoryId,
    targetId: classificationId,
  });
}

async function importClassificationSchema(builder: TestIModelBuilder) {
  const schemaPath = import.meta.resolve("@bentley/classification-systems-schema/ClassificationSystems.ecschema.xml");
  const schemaXml = fs.readFileSync(fs.realpathSync(new URL(schemaPath)), { encoding: "utf-8" });
  await builder.importSchema(schemaXml);

  // also import our custom schema for classification - category relationship
  await importSchema({
    builder,
    schemaName: "TestClassificationSchema",
    schemaAlias: "tcs",
    schemaContentXml: `
      <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
      <ECSchemaReference name="ClassificationSystems" version="01.00.04" alias="clsf" />
      <ECRelationshipClass typeName="CategorySymbolizesClassification" modifier="None" strength="referencing">
          <BaseClass>bis:ElementRefersToElements</BaseClass>
          <Source multiplicity="(0..*)" roleLabel="symbolizes" polymorphic="true">
              <Class class="bis:Category"/>
          </Source>
          <Target multiplicity="(0..*)" roleLabel="is symbolized by" polymorphic="true">
              <Class class="clsf:Classification"/>
          </Target>
      </ECRelationshipClass>
    `,
  });
}

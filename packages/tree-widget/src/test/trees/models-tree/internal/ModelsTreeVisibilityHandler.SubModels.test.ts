/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  HierarchyCacheMode,
  initializeCore,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  terminateCore,
} from "test-utilities";
import { afterAll, beforeAll, describe, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { CLASS_NAME_Subject } from "../../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { buildIModel, TestSchema } from "../../../IModelUtils.js";
import { validateHierarchyVisibility } from "../../../shared/VisibilityValidation.js";
import { TestUtils } from "../../../TestUtils.js";
import {
  createAccessAndCache,
  createCategoryHierarchyNode,
  createClassGroupingHierarchyNode,
  createElementHierarchyNode,
  createModelHierarchyNode,
  createSubjectHierarchyNode,
  createVisibilityTestData,
} from "../Utils.js";
import { validateNodeVisibility } from "./VisibilityValidation.js";

import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { GroupingHierarchyNode, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { InstanceKey, Props } from "@itwin/presentation-shared";
import type { ModelsTreeHierarchyConfiguration } from "../../../../tree-widget-react/trees/models-tree/ModelsTreeDefinition.js";
import type { VisibilityExpectations } from "../../../shared/VisibilityValidation.js";

describe("ModelsTreeVisibilityHandler", () => {
  beforeAll(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  afterAll(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  describe("modeled elements", () => {
    const hierarchyConfig: ModelsTreeHierarchyConfiguration = { subjects: { root: "exclude" } };
    let datasets: Awaited<ReturnType<typeof createDatasets>>;
    beforeAll(async () => {
      await initializeCore({
        backendProps: {
          caching: {
            hierarchies: {
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
      datasets = await createDatasets();
    });

    afterAll(async () => {
      await terminateCore();
      await datasets[Symbol.asyncDispose]();
    });

    interface IModelWithSubModelIds {
      subjectId: Id64String;
      modeledElementId: Id64String;
      modelId: Id64String;
      categoryId: Id64String;
      subModelCategoryId?: Id64String;
      subModelElementId?: Id64String;
      parentElementId?: Id64String;
    }

    const testCases: Array<{
      only?: boolean;
      describeName: string;
      createIModel: () => Promise<{ imodelConnection: IModelConnection } & IModelWithSubModelIds>;
      cases: Array<{
        only?: boolean;
        name: string;
        getTargetNode: (ids: IModelWithSubModelIds) => NonGroupingHierarchyNode | GroupingHierarchyNode;
        expectations: (ids: IModelWithSubModelIds) => "all-visible" | "all-hidden" | VisibilityExpectations;
      }>;
    }> = [
      {
        describeName: "with child modeled elements",
        createIModel: async function createIModel(): Promise<{ imodelConnection: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(async (imodel, testSchema) =>
            withEditTxn(imodel, (txn) => {
              const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
              const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
              const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
              const category = insertSpatialCategory({ txn, codeValue: "category" });
              const parentElement = insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, userLabel: "parent element" });
              const modeledElement = insertPhysicalElement({
                txn,
                userLabel: `element`,
                modelId: model.id,
                categoryId: category.id,
                classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
                parentId: parentElement.id,
              });
              const subModel = insertPhysicalSubModel({ txn, modeledElementId: modeledElement.id });
              const subModelCategory = insertSpatialCategory({ txn, codeValue: "category2" });
              const subModelElement = insertPhysicalElement({ txn, userLabel: `element2`, modelId: subModel.id, categoryId: subModelCategory.id });
              return {
                subjectId: rootSubject.id,
                modeledElementId: modeledElement.id,
                modelId: model.id,
                categoryId: category.id,
                subModelCategoryId: subModelCategory.id,
                subModelElementId: subModelElement.id,
                parentElementId: parentElement.id,
              };
            }),
          );
        },
        cases: [
          {
            name: "modeled element's children display is turned on when its subject display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createSubjectHierarchyNode({ ids: [ids.subjectId] }),
            expectations: () => "all-visible",
          },
          {
            name: "modeled element's children display is turned on when its model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createModelHierarchyNode({
                modelId: ids.modelId,
                hasChildren: true,
              }),
            expectations: () => "all-visible",
          },
          {
            name: "modeled element's children display is turned on when its category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createCategoryHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                hasChildren: true,
              }),
            expectations: () => "all-visible",
          },
          {
            name: "modeled element's children display is turned on when its parent element class grouping node display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createClassGroupingHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elements: [ids.parentElementId!],
              }),
            expectations: () => "all-visible",
          },
          {
            name: "modeled element's children display is turned on when its parent element display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createElementHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elementId: ids.parentElementId!,
                hasChildren: true,
              }),
            expectations: () => "all-visible",
          },
          {
            name: "modeled element's children display is turned on when its class grouping node display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createClassGroupingHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elements: [ids.modeledElementId],
              }),
            // prettier-ignore
            expectations: (ids: IModelWithSubModelIds) => ({
              [ids.modelId]: "partial",
                [`${ids.modelId}-${ids.categoryId}`]: "partial",
                  [ids.parentElementId!]: "partial",
                    [ids.modeledElementId]: "visible",
                      [`${ids.modeledElementId}-${ids.subModelCategoryId}`]: "visible",
                        [ids.subModelElementId!]: "visible",
            }),
          },
          {
            name: "modeled element's children display is turned on when its display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createElementHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elementId: ids.modeledElementId,
                hasChildren: true,
              }),
            // prettier-ignore
            expectations: (ids: IModelWithSubModelIds) => ({
              [ids.modelId]: "partial",
                [`${ids.modelId}-${ids.categoryId}`]: "partial",
                  [ids.parentElementId!]: "partial",
                    [ids.modeledElementId]: "visible",
                      [`${ids.modeledElementId}-${ids.subModelCategoryId}`]: "visible",
                        [ids.subModelElementId!]: "visible",
            }),
          },
          {
            name: "modeled element's children display is turned on when its sub-model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createModelHierarchyNode({
                modelId: ids.modeledElementId,
                hasChildren: true,
              }),
            // prettier-ignore
            expectations: (ids: IModelWithSubModelIds) => ({
              [ids.modelId]: "partial",
                [`${ids.modelId}-${ids.categoryId}`]: "partial",
                  [ids.parentElementId!]: "partial",
                    [ids.modeledElementId]: "partial",
                      [`${ids.modeledElementId}-${ids.subModelCategoryId}`]: "visible",
                        [ids.subModelElementId!]: "visible",
            }),
          },
          {
            name: "parent element, modeled element, its model and category have partial visibility when its sub-model element's category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createCategoryHierarchyNode({
                modelId: ids.modeledElementId,
                categoryId: ids.subModelCategoryId,
                hasChildren: true,
              }),
            // prettier-ignore
            expectations: (ids: IModelWithSubModelIds) => ({
              [ids.modelId]: "partial",
                [`${ids.modelId}-${ids.categoryId}`]: "partial",
                  [ids.parentElementId!]: "partial",
                    [ids.modeledElementId]: "partial",
                      [`${ids.modeledElementId}-${ids.subModelCategoryId}`]: "visible",
                        [ids.subModelElementId!]: "visible",
            }),
          },
          {
            name: "parent element,modeled element, its model and category have partial visibility when its sub-model element's display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createElementHierarchyNode({
                modelId: ids.modeledElementId,
                categoryId: ids.subModelCategoryId,
                elementId: ids.subModelElementId,
              }),
            // prettier-ignore
            expectations: (ids: IModelWithSubModelIds) => ({
              [ids.modelId]: "partial",
                [`${ids.modelId}-${ids.categoryId}`]: "partial",
                  [ids.parentElementId!]: "partial",
                    [ids.modeledElementId]: "partial",
                      [`${ids.modeledElementId}-${ids.subModelCategoryId}`]: "visible",
                        [ids.subModelElementId!]: "visible",
            }),
          },
        ],
      },
      {
        describeName: "with modeled elements that have private subModel",
        createIModel: async function createIModel(): Promise<{ imodelConnection: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(async (imodel, testSchema) =>
            withEditTxn(imodel, (txn) => {
              const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
              const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
              const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
              const category = insertSpatialCategory({ txn, codeValue: "category" });
              const modeledElement = insertPhysicalElement({
                txn,
                userLabel: `element`,
                modelId: model.id,
                categoryId: category.id,
                classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              });
              const subModel = insertPhysicalSubModel({ txn, modeledElementId: modeledElement.id, isPrivate: true });
              const subModelCategory = insertSpatialCategory({ txn, codeValue: "category2" });
              const subModelElement = insertPhysicalElement({ txn, userLabel: `element2`, modelId: subModel.id, categoryId: subModelCategory.id });
              return {
                subjectId: rootSubject.id,
                modeledElementId: modeledElement.id,
                modelId: model.id,
                categoryId: category.id,
                subModelCategoryId: subModelCategory.id,
                subModelElementId: subModelElement.id,
              };
            }),
          );
        },
        cases: [
          {
            name: "everything is visible when subject display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createSubjectHierarchyNode({ ids: [ids.subjectId] }),
            expectations: () => "all-visible",
          },
          {
            name: "everything is visible when model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createModelHierarchyNode({
                modelId: ids.modelId,
                hasChildren: true,
              }),
            expectations: () => "all-visible",
          },
          {
            name: "everything is visible when category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createCategoryHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                hasChildren: true,
              }),
            expectations: () => "all-visible",
          },
          {
            name: "everything is visible when elements class grouping node display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createClassGroupingHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elements: [ids.modeledElementId],
              }),
            expectations: () => "all-visible",
          },
          {
            name: "everything is visible when elements display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createElementHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elementId: ids.modeledElementId,
                hasChildren: false,
              }),
            expectations: () => "all-visible",
          },
        ],
      },
      {
        describeName: "with modeled elements that have subModel with no children",
        createIModel: async function createIModel(): Promise<{ imodelConnection: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(async (imodel, testSchema) =>
            withEditTxn(imodel, (txn) => {
              const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
              const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
              const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
              const category = insertSpatialCategory({ txn, codeValue: "category" });
              const modeledElement = insertPhysicalElement({
                txn,
                userLabel: `element`,
                modelId: model.id,
                categoryId: category.id,
                classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              });
              insertPhysicalSubModel({ txn, modeledElementId: modeledElement.id });
              return {
                subjectId: rootSubject.id,
                modeledElementId: modeledElement.id,
                modelId: model.id,
                categoryId: category.id,
              };
            }),
          );
        },
        cases: [
          {
            name: "everything is visible when subject display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createSubjectHierarchyNode({ ids: [ids.subjectId] }),
            expectations: () => "all-visible",
          },
          {
            name: "everything is visible when model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createModelHierarchyNode({
                modelId: ids.modelId,
                hasChildren: true,
              }),
            expectations: () => "all-visible",
          },
          {
            name: "everything is visible when category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createCategoryHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                hasChildren: true,
              }),
            expectations: () => "all-visible",
          },
          {
            name: "everything is visible when elements class grouping node display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createClassGroupingHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elements: [ids.modeledElementId],
              }),
            expectations: () => "all-visible",
          },
          {
            name: "everything is visible when elements display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createElementHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elementId: ids.modeledElementId,
                hasChildren: false,
              }),
            expectations: () => "all-visible",
          },
        ],
      },
    ];

    testCases.forEach(({ describeName, createIModel, cases, ...describeProps }) => {
      (describeProps.only ? describe.only : describe)(describeName, () => {
        let iModel: IModelConnection;
        let createdIds: IModelWithSubModelIds;
        let accessAndCache: Awaited<ReturnType<typeof createAccessAndCache>>;

        beforeAll(async () => {
          const { imodelConnection, ...ids } = await createIModel();
          iModel = imodelConnection;
          accessAndCache = createAccessAndCache({ imodelConnection: iModel, hierarchyConfig });
          createdIds = ids;
        });

        afterAll(async () => {
          await iModel.close();
        });

        cases.forEach(({ name, getTargetNode, expectations, ...itProps }) => {
          (itProps.only ? it.only : it)(name, async function () {
            using visibilityTestData = createVisibilityTestData({ imodelConnection: iModel, hierarchyConfig, ...accessAndCache });
            const { handler, provider, viewport } = visibilityTestData;

            const nodeToChangeVisibility = getTargetNode(createdIds);
            await validateModelsTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-hidden",
            });
            await handler.changeVisibility(nodeToChangeVisibility, true);
            await validateModelsTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: expectations(createdIds),
            });
            await handler.changeVisibility(nodeToChangeVisibility, false);
            await validateModelsTreeHierarchyVisibility({
              provider,
              handler,
              viewport,
              expectations: "all-hidden",
            });
          });
        });
      });
    });

    describe("intermediate categories", () => {
      it("showing intermediate category under sub-model makes its elements visible", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.subModelIntermediateCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(
          createCategoryHierarchyNode({
            modelId: keys.modeledElement.id,
            categoryId: keys.categoryB.id,
            hasChildren: true,
          }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.model.id]: "partial",
              [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                [keys.modeledElement.id]: "partial",
                  [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "visible",
                    [keys.subModelElement.id]: "visible",
          },
        });
      });

      it("showing element under intermediate category in sub-model makes it visible", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.subModelIntermediateCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(
          createElementHierarchyNode({
            modelId: keys.modeledElement.id,
            categoryId: keys.categoryB.id,
            elementId: keys.subModelElement.id,
          }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.model.id]: "partial",
              [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                [keys.modeledElement.id]: "partial",
                  [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "visible",
                    [keys.subModelElement.id]: "visible",
          },
        });
      });

      it("hiding intermediate category under sub-model makes its elements hidden", async () => {
        const { imodelConnection, idsCache, imodelAccess, keys } = datasets.subModelIntermediateCategories;
        using visibilityTestData = createVisibilityTestData({ imodelConnection, idsCache, imodelAccess, hierarchyConfig, visibleByDefault: true });
        const { handler, provider, viewport } = visibilityTestData;

        await handler.changeVisibility(
          createCategoryHierarchyNode({
            modelId: keys.modeledElement.id,
            categoryId: keys.categoryB.id,
            hasChildren: true,
          }),
          false,
        );

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [keys.model.id]: "partial",
              [`${keys.model.id}-${keys.categoryA.id}`]: "partial",
                [keys.modeledElement.id]: "partial",
                  [`${keys.modeledElement.id}-${keys.categoryB.id}`]: "hidden",
                    [keys.subModelElement.id]: "hidden",
          },
        });
      });
    });
  });
});

async function validateModelsTreeHierarchyVisibility(props: Omit<Props<typeof validateHierarchyVisibility>, "validateNodeVisibility">) {
  return validateHierarchyVisibility({
    ...props,
    validateNodeVisibility,
  });
}

async function createDatasets() {
  const imodels: IModelConnection[] = [];

  return {
    [Symbol.asyncDispose]: async () => Promise.all(imodels.map(async (imodel) => imodel.close())),
    ["subModelIntermediateCategories"]: await (async () => {
      const { imodelConnection, ...keys } = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const model = insertPhysicalModelWithPartition({ txn, codeValue: "m" });
          const categoryA = insertSpatialCategory({ txn, codeValue: "catA" });
          const categoryB = insertSpatialCategory({ txn, codeValue: "catB" });
          const modeledElement = insertPhysicalElement({
            txn,
            modelId: model.id,
            categoryId: categoryA.id,
            classFullName: `${TestSchema.Name}.${TestSchema.ModeledElement3dClassName}`,
          });
          const subModel = insertPhysicalSubModel({ txn, modeledElementId: modeledElement.id });
          const subModelElement = insertPhysicalElement({ txn, modelId: subModel.id, categoryId: categoryB.id });
          return {
            model,
            categoryA,
            categoryB,
            modeledElement,
            subModelElement,
          };
        }),
      );
      imodels.push(imodelConnection);
      return { imodelConnection, keys, ...createAccessAndCache({ imodelConnection }) };
    })(),
  };
}

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyNodeIdentifier } from "@itwin/presentation-hierarchies";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import {
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_Subject,
} from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { ModelsTreeIdsCache } from "../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import {
  buildIModel,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  insertSubject,
} from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";
import { NodeValidators, validateHierarchy } from "../HierarchyValidation.js";
import { createClassGroupingHierarchyNode, createModelsTreeProvider, getGroupingNodeParentKeys } from "./Utils.js";

import type { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { TestIModelBuilder } from "@itwin/presentation-testing";
import type { ExpectedHierarchyDef } from "../HierarchyValidation.js";
import type { ElementsGroupInfo } from "../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

interface TreeFilteringTestCaseDefinition<TIModelSetupResult extends {}> {
  name: string;
  only?: boolean;
  setupIModel: Parameters<typeof buildIModel<TIModelSetupResult>>[1];
  getTargetInstancePaths: (setupResult: TIModelSetupResult) => HierarchyFilteringPath[];
  getTargetItems: (setupResult: TIModelSetupResult) => Array<InstanceKey | ElementsGroupInfo>;
  getTargetInstanceLabel?: (setupResult: TIModelSetupResult) => string;
  getExpectedHierarchy: (setupResult: TIModelSetupResult) => ExpectedHierarchyDef[];
  getHierarchyConfig?: (setupResult: TIModelSetupResult) => Partial<ModelsTreeHierarchyConfiguration>;
}

namespace TreeFilteringTestCaseDefinition {
  // only need this to get generic type inferred using setupIModel return type
  export function create<TIModelSetupResult extends {}>(
    name: string,
    setupIModel: Parameters<typeof buildIModel<TIModelSetupResult>>[1],
    getTargetInstancePaths: (setupResult: TIModelSetupResult) => HierarchyFilteringPath[],
    getTargetItems: (setupResult: TIModelSetupResult) => Array<InstanceKey | ElementsGroupInfo>,
    getTargetInstanceLabel: ((setupResult: TIModelSetupResult) => string) | undefined,
    getExpectedHierarchy: (setupResult: TIModelSetupResult) => ExpectedHierarchyDef[],
    getHierarchyConfig?: (setupResult: TIModelSetupResult) => Partial<ModelsTreeHierarchyConfiguration>,
  ): TreeFilteringTestCaseDefinition<TIModelSetupResult> {
    return {
      name,
      setupIModel,
      getTargetInstancePaths,
      getTargetItems,
      getTargetInstanceLabel,
      getExpectedHierarchy,
      getHierarchyConfig,
    };
  }

  export const only: typeof create = function <TIModelSetupResult extends {}>(
    ...args: Parameters<typeof create<TIModelSetupResult>>
  ): TreeFilteringTestCaseDefinition<TIModelSetupResult> {
    return {
      ...create(...args),
      only: true,
    };
  };
}

describe.only("Models tree", () => {
  describe("Hierarchy filtering", () => {
    before(async function () {
      await initializePresentationTesting({
        backendProps: {
          caching: {
            hierarchies: {
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async function () {
      await terminatePresentationTesting();
    });

    runTestCases(
      TreeFilteringTestCaseDefinition.create(
        "immediate Subject nodes",
        async (builder) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const childSubject1 = insertSubject({ builder, codeValue: "matching subject 1", parentId: rootSubject.id });
          const childSubject2 = insertSubject({ builder, codeValue: "subject 2", parentId: rootSubject.id });
          const childSubject3 = insertSubject({ builder, codeValue: "matching subject 3", parentId: rootSubject.id });
          insertModelWithElements(builder, 1, category.id, childSubject1.id);
          insertModelWithElements(builder, 2, category.id, childSubject2.id);
          insertModelWithElements(builder, 3, category.id, childSubject3.id);
          return { rootSubject, childSubject1, childSubject2, childSubject3 };
        },
        (x) => [[x.childSubject1], [x.childSubject3]],
        (x) => [x.childSubject1, x.childSubject3],
        (_x) => "matching",
        (x) => [
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.childSubject1],
            label: "matching subject 1",
            autoExpand: false,
            children: [
              NodeValidators.createForInstanceNode({
                label: "model-1",
                children: [
                  NodeValidators.createForInstanceNode({
                    label: "category",
                    children: [
                      NodeValidators.createForClassGroupingNode({
                        label: "Physical Object",
                        children: [NodeValidators.createForInstanceNode({ label: /^element-1/, children: false })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.childSubject3],
            label: "matching subject 3",
            autoExpand: false,
            children: [
              NodeValidators.createForInstanceNode({
                label: "model-3",
                children: [
                  NodeValidators.createForInstanceNode({
                    label: "category",
                    children: [
                      NodeValidators.createForClassGroupingNode({
                        label: "Physical Object",
                        children: [NodeValidators.createForInstanceNode({ label: /^element-3/, children: false })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      TreeFilteringTestCaseDefinition.create(
        "nested Subject nodes",
        async (builder) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const intermediateSubject = insertSubject({ builder, codeValue: `subject-x` });
          const childSubject1 = insertSubject({ builder, codeValue: "matching subject 1", parentId: intermediateSubject.id });
          const childSubject2 = insertSubject({ builder, codeValue: "subject 2", parentId: intermediateSubject.id });
          const childSubject3 = insertSubject({ builder, codeValue: "matching subject 3", parentId: intermediateSubject.id });
          insertModelWithElements(builder, 1, category.id, childSubject1.id);
          insertModelWithElements(builder, 2, category.id, childSubject2.id);
          insertModelWithElements(builder, 3, category.id, childSubject3.id);
          return { rootSubject, intermediateSubject, childSubject1, childSubject2, childSubject3 };
        },
        (x) => [
          [x.intermediateSubject, x.childSubject1],
          [x.intermediateSubject, x.childSubject3],
        ],
        (x) => [x.childSubject1, x.childSubject3],
        (_x) => "matching",
        (x) => [
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.intermediateSubject],
            label: "subject-x",
            autoExpand: true,
            children: [
              NodeValidators.createForInstanceNode({
                label: "matching subject 1",
                autoExpand: false,
                children: [
                  NodeValidators.createForInstanceNode({
                    label: "model-1",
                    children: [
                      NodeValidators.createForInstanceNode({
                        label: "category",
                        children: [
                          NodeValidators.createForClassGroupingNode({
                            label: "Physical Object",
                            children: [NodeValidators.createForInstanceNode({ label: /^element-1/, children: false })],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              NodeValidators.createForInstanceNode({
                label: "matching subject 3",
                autoExpand: false,
                children: [
                  NodeValidators.createForInstanceNode({
                    label: "model-3",
                    children: [
                      NodeValidators.createForInstanceNode({
                        label: "category",
                        children: [
                          NodeValidators.createForClassGroupingNode({
                            label: "Physical Object",
                            children: [NodeValidators.createForInstanceNode({ label: /^element-3/, children: false })],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      TreeFilteringTestCaseDefinition.create(
        "two levels of Subject nodes",
        async (builder) => {
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const intermediateSubject1 = insertSubject({ builder, codeValue: `matching intermediate subject 1`, parentId: rootSubject.id });
          const intermediateSubject2 = insertSubject({ builder, codeValue: `intermediate subject 2`, parentId: rootSubject.id });
          insertModelWithElements(builder, 1, category.id, intermediateSubject2.id);
          const childSubject1 = insertSubject({ builder, codeValue: "matching subject 1", parentId: intermediateSubject1.id });
          const childSubject2 = insertSubject({ builder, codeValue: "subject 2", parentId: intermediateSubject1.id });
          insertModelWithElements(builder, 1, category.id, childSubject1.id);
          insertModelWithElements(builder, 2, category.id, childSubject2.id);
          return { rootSubject, intermediateSubject1, intermediateSubject2, childSubject1, childSubject2 };
        },
        (x) => [[x.intermediateSubject1], [x.intermediateSubject1, x.childSubject1]],
        (x) => [x.intermediateSubject1, x.childSubject1],
        (_x) => "matching",
        (x) => [
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.intermediateSubject1],
            label: "matching intermediate subject 1",
            autoExpand: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [x.childSubject1],
                label: "matching subject 1",
                autoExpand: false,
                children: [
                  NodeValidators.createForInstanceNode({
                    label: "model-1",
                    children: [
                      NodeValidators.createForInstanceNode({
                        label: "category",
                        children: [
                          NodeValidators.createForClassGroupingNode({
                            label: "Physical Object",
                            children: [NodeValidators.createForInstanceNode({ label: /^element-1/, children: false })],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              NodeValidators.createForInstanceNode({
                instanceKeys: [x.childSubject2],
                label: "subject 2",
                autoExpand: false,
                children: [
                  NodeValidators.createForInstanceNode({
                    label: "model-2",
                    children: [
                      NodeValidators.createForInstanceNode({
                        label: "category",
                        children: [
                          NodeValidators.createForClassGroupingNode({
                            label: "Physical Object",
                            children: [NodeValidators.createForInstanceNode({ label: /^element-2/, children: false })],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      TreeFilteringTestCaseDefinition.create(
        "Model nodes",
        async (builder) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const model1 = insertPhysicalModelWithPartition({ builder, codeValue: `matching model 1`, partitionParentId: rootSubject.id });
          const model2 = insertPhysicalModelWithPartition({ builder, codeValue: `model 2`, partitionParentId: rootSubject.id });
          const model3 = insertPhysicalModelWithPartition({ builder, codeValue: `matching model 3`, partitionParentId: rootSubject.id });
          insertPhysicalElement({ builder, userLabel: `element-1`, modelId: model1.id, categoryId: category.id });
          insertPhysicalElement({ builder, userLabel: `element-2`, modelId: model2.id, categoryId: category.id });
          insertPhysicalElement({ builder, userLabel: `element-3`, modelId: model3.id, categoryId: category.id });
          return { rootSubject, model1, model2, model3 };
        },
        (x) => [[adjustedModelKey(x.model1)], [adjustedModelKey(x.model3)]],
        (x) => [x.model1, x.model3],
        (_x) => "matching",
        (x) => [
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.model1],
            label: "matching model 1",
            autoExpand: false,
            children: [
              NodeValidators.createForInstanceNode({
                label: "category",
                children: [
                  NodeValidators.createForClassGroupingNode({
                    label: "Physical Object",
                    children: [NodeValidators.createForInstanceNode({ label: /^element-1/, children: false })],
                  }),
                ],
              }),
            ],
          }),
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.model3],
            label: "matching model 3",
            autoExpand: false,
            children: [
              NodeValidators.createForInstanceNode({
                label: "category",
                children: [
                  NodeValidators.createForClassGroupingNode({
                    label: "Physical Object",
                    children: [NodeValidators.createForInstanceNode({ label: /^element-3/, children: false })],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      TreeFilteringTestCaseDefinition.create(
        "Empty model nodes",
        async (builder) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const model1 = insertPhysicalModelWithPartition({ builder, codeValue: `matching model 1`, partitionParentId: rootSubject.id });
          const model2 = insertPhysicalModelWithPartition({ builder, codeValue: `model 2`, partitionParentId: rootSubject.id });
          const model3 = insertPhysicalModelWithPartition({ builder, codeValue: `matching model 3`, partitionParentId: rootSubject.id });
          return { rootSubject, model1, model2, model3 };
        },
        (x) => [[adjustedModelKey(x.model1)], [adjustedModelKey(x.model3)]],
        (x) => [x.model1, x.model3],
        (_x) => "matching",
        (x) => [
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.model1],
            label: "matching model 1",
            autoExpand: false,
            children: false,
          }),
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.model3],
            label: "matching model 3",
            autoExpand: false,
            children: false,
          }),
        ],
        () => ({ showEmptyModels: true }),
      ),
      TreeFilteringTestCaseDefinition.create(
        "Subject with hidden child Model node",
        async (builder) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const childSubject = insertSubject({ builder, codeValue: "matching child subject", parentId: rootSubject.id });
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const partition = insertPhysicalPartition({
            builder,
            codeValue: `matching model 1`,
            parentId: childSubject.id,
            jsonProperties: { PhysicalPartition: { Model: { Content: true } } },
          });
          const model1 = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
          const model2 = insertPhysicalModelWithPartition({ builder, codeValue: `model 2`, partitionParentId: childSubject.id });
          insertPhysicalElement({ builder, userLabel: `element-1`, modelId: model1.id, categoryId: category.id });
          insertPhysicalElement({ builder, userLabel: `element-2`, modelId: model2.id, categoryId: category.id });
          return { rootSubject, childSubject, model1, model2, category };
        },
        (x) => [[x.childSubject]],
        (x) => [x.childSubject],
        (_x) => "matching",
        (x) => [
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.childSubject],
            label: "matching child subject",
            autoExpand: false,
            children: [
              NodeValidators.createForInstanceNode({
                label: "category",
                autoExpand: false,
                children: [
                  NodeValidators.createForClassGroupingNode({
                    label: "Physical Object",
                    children: [NodeValidators.createForInstanceNode({ label: /^element-1/, children: false })],
                  }),
                ],
              }),
              NodeValidators.createForInstanceNode({
                label: "model 2",
                autoExpand: false,
                children: [
                  NodeValidators.createForInstanceNode({
                    label: "category",
                    children: [
                      NodeValidators.createForClassGroupingNode({
                        label: "Physical Object",
                        children: [NodeValidators.createForInstanceNode({ label: /^element-2/, children: false })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      TreeFilteringTestCaseDefinition.create(
        "Category nodes",
        async (builder) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const model1 = insertPhysicalModelWithPartition({ builder, codeValue: `model-1`, partitionParentId: rootSubject.id });
          const model2 = insertPhysicalModelWithPartition({ builder, codeValue: `model-2`, partitionParentId: rootSubject.id });

          const category1 = insertSpatialCategory({ builder, codeValue: "matching category 1" });
          const category2 = insertSpatialCategory({ builder, codeValue: "category-2" });
          const category3 = insertSpatialCategory({ builder, codeValue: "matching category 3" });

          insertPhysicalElement({ builder, userLabel: `element-1`, modelId: model1.id, categoryId: category1.id });
          insertPhysicalElement({ builder, userLabel: `element-2`, modelId: model1.id, categoryId: category2.id });
          insertPhysicalElement({ builder, userLabel: `element-3`, modelId: model2.id, categoryId: category3.id });

          return { rootSubject, model1, model2, category1, category2, category3 };
        },
        (x) => [
          [adjustedModelKey(x.model1), x.category1],
          [adjustedModelKey(x.model2), x.category3],
        ],
        (x) => [x.category1, x.category3],
        (_x) => "matching",
        (x) => [
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.model1],
            label: "model-1",
            autoExpand: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [x.category1],
                label: "matching category 1",
                autoExpand: false,
                children: [
                  NodeValidators.createForClassGroupingNode({
                    label: "Physical Object",
                    children: [NodeValidators.createForInstanceNode({ label: /^element-1/, children: false })],
                  }),
                ],
              }),
            ],
          }),
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.model2],
            label: "model-2",
            autoExpand: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [x.category3],
                label: "matching category 3",
                autoExpand: false,
                children: [
                  NodeValidators.createForClassGroupingNode({
                    label: "Physical Object",
                    children: [NodeValidators.createForInstanceNode({ label: /^element-3/, children: false })],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      TreeFilteringTestCaseDefinition.create(
        "root Element nodes",
        async (builder) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const model1 = insertPhysicalModelWithPartition({ builder, codeValue: `model-1`, partitionParentId: rootSubject.id });
          const model2 = insertPhysicalModelWithPartition({ builder, codeValue: `model-2`, partitionParentId: rootSubject.id });

          const category1 = insertSpatialCategory({ builder, codeValue: "category-1" });
          const category2 = insertSpatialCategory({ builder, codeValue: "category-2" });

          const element11 = insertPhysicalElement({ builder, userLabel: `matching element 11`, modelId: model1.id, categoryId: category1.id });
          const element12 = insertPhysicalElement({ builder, userLabel: `element 12`, modelId: model1.id, categoryId: category1.id });

          const element21 = insertPhysicalElement({ builder, userLabel: `element 21`, modelId: model2.id, categoryId: category2.id });
          const element22 = insertPhysicalElement({ builder, userLabel: `matching element 22`, modelId: model2.id, categoryId: category2.id });

          return { rootSubject, model1, model2, category1, category2, element11, element12, element21, element22 };
        },
        (x) => [
          [adjustedModelKey(x.model1), x.category1, adjustedElementKey(x.element11)],
          [adjustedModelKey(x.model2), x.category2, adjustedElementKey(x.element22)],
        ],
        (x) => [x.element11, x.element22],
        (_x) => "matching",
        (_x) => [
          NodeValidators.createForInstanceNode({
            label: "model-1",
            autoExpand: true,
            children: [
              NodeValidators.createForInstanceNode({
                label: "category-1",
                autoExpand: true,
                children: [
                  NodeValidators.createForClassGroupingNode({
                    label: "Physical Object",
                    autoExpand: true,
                    children: [NodeValidators.createForInstanceNode({ label: /^matching element 11/, autoExpand: false, children: false })],
                  }),
                ],
              }),
            ],
          }),
          NodeValidators.createForInstanceNode({
            label: "model-2",
            autoExpand: true,
            children: [
              NodeValidators.createForInstanceNode({
                label: "category-2",
                autoExpand: true,
                children: [
                  NodeValidators.createForClassGroupingNode({
                    label: "Physical Object",
                    autoExpand: true,
                    children: [NodeValidators.createForInstanceNode({ label: /^matching element 22/, autoExpand: false, children: false })],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      TreeFilteringTestCaseDefinition.create(
        "category and element nodes",
        async (builder) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const model1 = insertPhysicalModelWithPartition({ builder, codeValue: `model-1`, partitionParentId: rootSubject.id });
          const model2 = insertPhysicalModelWithPartition({ builder, codeValue: `model-2`, partitionParentId: rootSubject.id });

          const category1 = insertSpatialCategory({ builder, codeValue: "matching category-1" });
          const category2 = insertSpatialCategory({ builder, codeValue: "category-2" });

          const element11 = insertPhysicalElement({ builder, userLabel: `matching element 11`, modelId: model1.id, categoryId: category1.id });
          const element12 = insertPhysicalElement({ builder, userLabel: `element 12`, modelId: model1.id, categoryId: category1.id });

          const element21 = insertPhysicalElement({ builder, userLabel: `element 21`, modelId: model2.id, categoryId: category2.id });
          const element22 = insertPhysicalElement({ builder, userLabel: `element 22`, modelId: model2.id, categoryId: category2.id });

          return { rootSubject, model1, model2, category1, category2, element11, element12, element21, element22 };
        },
        (x) => [
          [adjustedModelKey(x.model1), x.category1],
          [adjustedModelKey(x.model1), x.category1, adjustedElementKey(x.element11)],
        ],
        (x) => [x.category1, x.element11],
        (_x) => "matching",
        (_x) => [
          NodeValidators.createForInstanceNode({
            label: "model-1",
            autoExpand: true,
            children: [
              NodeValidators.createForInstanceNode({
                label: "matching category-1",
                autoExpand: true,
                children: [
                  NodeValidators.createForClassGroupingNode({
                    label: "Physical Object",
                    autoExpand: true,
                    children: [
                      NodeValidators.createForInstanceNode({ label: /^element 12/, autoExpand: false, children: false }),
                      NodeValidators.createForInstanceNode({ label: /^matching element 11/, autoExpand: false, children: false }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      TreeFilteringTestCaseDefinition.create(
        "child Element nodes",
        async (builder) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const model = insertPhysicalModelWithPartition({ builder, codeValue: `model-x`, partitionParentId: rootSubject.id });
          const category = insertSpatialCategory({ builder, codeValue: "category-x" });
          const rootElement = insertPhysicalElement({ builder, userLabel: `root element 0`, modelId: model.id, categoryId: category.id });
          const childElement1 = insertPhysicalElement({
            builder,
            userLabel: `matching element 1`,
            modelId: model.id,
            categoryId: category.id,
            parentId: rootElement.id,
          });
          const childElement2 = insertPhysicalElement({
            builder,
            userLabel: `element 2`,
            modelId: model.id,
            categoryId: category.id,
            parentId: rootElement.id,
          });
          const childElement3 = insertPhysicalElement({
            builder,
            userLabel: `matching element 3`,
            modelId: model.id,
            categoryId: category.id,
            parentId: rootElement.id,
          });
          return { rootSubject, model, category, rootElement, childElement1, childElement2, childElement3 };
        },
        (x) => [
          [adjustedModelKey(x.model), x.category, adjustedElementKey(x.rootElement), adjustedElementKey(x.childElement1)],
          [adjustedModelKey(x.model), x.category, adjustedElementKey(x.rootElement), adjustedElementKey(x.childElement3)],
        ],
        (x) => [x.childElement1, x.childElement3],
        (_x) => "matching",
        (x) => [
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.model],
            label: "model-x",
            autoExpand: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [x.category],
                label: "category-x",
                autoExpand: true,
                children: [
                  NodeValidators.createForClassGroupingNode({
                    label: "Physical Object",
                    autoExpand: true,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [x.rootElement],
                        label: /^root element/,
                        autoExpand: true,
                        children: [
                          NodeValidators.createForClassGroupingNode({
                            label: "Physical Object",
                            autoExpand: true,
                            children: [
                              NodeValidators.createForInstanceNode({
                                instanceKeys: [x.childElement1],
                                label: /^matching element 1/,
                                autoExpand: false,
                                children: false,
                              }),
                              NodeValidators.createForInstanceNode({
                                instanceKeys: [x.childElement3],
                                label: /^matching element 3/,
                                autoExpand: false,
                                children: false,
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      TreeFilteringTestCaseDefinition.create(
        "child Element nodes when custom element specification class is used",
        async (builder, testSchema) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const model = insertPhysicalModelWithPartition({ builder, codeValue: `model-x`, partitionParentId: rootSubject.id });
          const category = insertSpatialCategory({ builder, codeValue: "category-x" });
          const rootElement1 = insertPhysicalElement({
            builder,
            userLabel: `matching element 1`,
            classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            modelId: model.id,
            categoryId: category.id,
          });
          const rootElement2 = insertPhysicalElement({
            builder,
            userLabel: `element 2`,
            modelId: model.id,
            categoryId: category.id,
          });
          const rootElement3 = insertPhysicalElement({
            builder,
            userLabel: `matching element 3`,
            classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            modelId: model.id,
            categoryId: category.id,
          });
          return { rootSubject, model, category, rootElement1, rootElement2, rootElement3 };
        },
        (x) => [
          [adjustedModelKey(x.model), x.category, { ...x.rootElement1, className: "TestSchema.SubModelablePhysicalObject" }],
          [adjustedModelKey(x.model), x.category, { ...x.rootElement3, className: "TestSchema.SubModelablePhysicalObject" }],
        ],
        (x) => [x.rootElement1, x.rootElement3],
        (_x) => "matching",
        (x) => [
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.model],
            label: "model-x",
            autoExpand: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [x.category],
                label: "category-x",
                autoExpand: true,
                children: [
                  NodeValidators.createForClassGroupingNode({
                    label: "Test Physical Object",
                    autoExpand: true,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [x.rootElement1],
                        label: /^matching element 1/,
                        autoExpand: false,
                        children: false,
                      }),
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [x.rootElement3],
                        label: /^matching element 3/,
                        autoExpand: false,
                        children: false,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
        (x) => ({ elementClassSpecification: x.rootElement1.className }),
      ),
      TreeFilteringTestCaseDefinition.create(
        "sub-modeled Element nodes",
        async (builder, testSchema) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const model = insertPhysicalModelWithPartition({ builder, codeValue: `model`, partitionParentId: rootSubject.id });
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const rootElement = insertPhysicalElement({
            builder,
            classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            userLabel: `root element`,
            modelId: model.id,
            categoryId: category.id,
          });
          const subModel = insertPhysicalSubModel({ builder, modeledElementId: rootElement.id });
          const subModeledElement1 = insertPhysicalElement({ builder, userLabel: `matching element 1`, modelId: subModel.id, categoryId: category.id });
          const subModeledElement2 = insertPhysicalElement({ builder, userLabel: `element 2`, modelId: subModel.id, categoryId: category.id });
          const subModeledElement3 = insertPhysicalElement({ builder, userLabel: `matching element 3`, modelId: subModel.id, categoryId: category.id });
          return { rootSubject, model, category, rootElement, subModel, subModeledElement1, subModeledElement2, subModeledElement3 };
        },
        (x) => [
          [
            adjustedModelKey(x.model),
            x.category,
            adjustedElementKey(x.rootElement),
            adjustedModelKey(x.subModel),
            x.category,
            adjustedElementKey(x.subModeledElement1),
          ],
          [
            adjustedModelKey(x.model),
            x.category,
            adjustedElementKey(x.rootElement),
            adjustedModelKey(x.subModel),
            x.category,
            adjustedElementKey(x.subModeledElement3),
          ],
        ],
        (x) => [x.subModeledElement1, x.subModeledElement3],
        (_x) => "matching",
        (x) => [
          NodeValidators.createForInstanceNode({
            instanceKeys: [x.model],
            label: "model",
            autoExpand: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [x.category],
                label: "category",
                autoExpand: true,
                children: [
                  NodeValidators.createForClassGroupingNode({
                    label: "Test Physical Object",
                    autoExpand: true,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [x.rootElement],
                        label: /^root element/,
                        autoExpand: true,
                        children: [
                          NodeValidators.createForInstanceNode({
                            instanceKeys: [x.category],
                            label: "category",
                            autoExpand: true,
                            children: [
                              NodeValidators.createForClassGroupingNode({
                                label: "Physical Object",
                                autoExpand: true,
                                children: [
                                  NodeValidators.createForInstanceNode({
                                    instanceKeys: [x.subModeledElement1],
                                    label: /^matching element 1/,
                                    autoExpand: false,
                                    children: false,
                                  }),
                                  NodeValidators.createForInstanceNode({
                                    instanceKeys: [x.subModeledElement3],
                                    label: /^matching element 3/,
                                    autoExpand: false,
                                    children: false,
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      TreeFilteringTestCaseDefinition.create(
        "Element node through hidden ancestors",
        async (builder) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const hiddenChildSubject = insertSubject({
            builder,
            codeValue: `hidden-subject`,
            parentId: rootSubject.id,
            jsonProperties: { Subject: { Job: { Bridge: "Test" } } },
          });
          const partition = insertPhysicalPartition({
            builder,
            codeValue: `hidden-model`,
            parentId: hiddenChildSubject.id,
            jsonProperties: { PhysicalPartition: { Model: { Content: true } } },
          });
          const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const element1 = insertPhysicalElement({ builder, userLabel: `matching element 1`, modelId: model.id, categoryId: category.id });
          const element2 = insertPhysicalElement({ builder, userLabel: `element 2`, modelId: model.id, categoryId: category.id });
          return { rootSubject, model, category, element1, element2 };
        },
        (x) => [[adjustedModelKey(x.model), x.category, adjustedElementKey(x.element1)]],
        (x) => [x.element1],
        (_x) => "matching",
        (_x) => [
          NodeValidators.createForInstanceNode({
            label: "category",
            autoExpand: true,
            children: [
              NodeValidators.createForClassGroupingNode({
                label: "Physical Object",
                autoExpand: true,
                children: [NodeValidators.createForInstanceNode({ label: /^matching element 1/, autoExpand: false, children: false })],
              }),
            ],
          }),
        ],
      ),
    );

    describe("when expanding up to element class grouping nodes", () => {
      runTestCases(
        TreeFilteringTestCaseDefinition.create(
          "grouped root element",
          async (builder) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const model1 = insertPhysicalModelWithPartition({ builder, codeValue: `model-1`, partitionParentId: rootSubject.id });
            const model2 = insertPhysicalModelWithPartition({ builder, codeValue: `model-2`, partitionParentId: rootSubject.id });
            const category = insertSpatialCategory({ builder, codeValue: "category-x" });
            insertPhysicalElement({ builder, userLabel: `element 1-1`, modelId: model1.id, categoryId: category.id });
            insertPhysicalElement({
              builder,
              userLabel: `element 1-2`,
              modelId: model1.id,
              categoryId: category.id,
            });
            const physicalElement21 = insertPhysicalElement({ builder, userLabel: `element 2-1`, modelId: model2.id, categoryId: category.id });
            const physicalElement22 = insertPhysicalElement({
              builder,
              userLabel: `element 2-2`,
              modelId: model2.id,
              categoryId: category.id,
            });
            const pathUntilTargetElement = [adjustedModelKey(model2), category];
            const groupingNode = createClassGroupingHierarchyNode({
              className: physicalElement21.className,
              modelId: model2.id,
              categoryId: category.id,
              elements: [physicalElement21.id, physicalElement22.id],
              parentKeys: pathUntilTargetElement.map((key) => ({ type: "instances", instanceKeys: [key] })),
            });
            return { rootSubject, model2, category, physicalElement21, physicalElement22, pathUntilTargetElement, groupingNode };
          },
          (x) =>
            x.groupingNode.groupedInstanceKeys.map((elementKey) => ({
              path: [...x.pathUntilTargetElement, adjustedElementKey(elementKey)],
              options: { autoExpand: { depth: x.groupingNode.parentKeys.length, includeGroupingNodes: true } },
            })),
          (x) => [
            {
              parent: { type: "category", ids: [x.category.id], modelIds: [x.model2.id] },
              groupingNode: x.groupingNode,
            },
          ],
          undefined,
          (x) => [
            NodeValidators.createForInstanceNode({
              instanceKeys: [x.model2],
              label: "model-2",
              autoExpand: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [x.category],
                  label: "category-x",
                  autoExpand: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      label: "Physical Object",
                      autoExpand: false,
                      children: [
                        NodeValidators.createForInstanceNode({ instanceKeys: [x.physicalElement21] }),
                        NodeValidators.createForInstanceNode({ instanceKeys: [x.physicalElement22] }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        ),
        TreeFilteringTestCaseDefinition.create(
          "grouped child element",
          async (builder, testSchema) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const model = insertPhysicalModelWithPartition({ builder, codeValue: `model-x`, partitionParentId: rootSubject.id });
            const category = insertSpatialCategory({ builder, codeValue: "category-x" });
            const rootElement = insertPhysicalElement({ builder, userLabel: `root element`, modelId: model.id, categoryId: category.id });
            insertPhysicalElement({
              builder,
              userLabel: `element 1`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement.id,
            });
            insertPhysicalElement({
              builder,
              userLabel: `element 2`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement.id,
            });
            const testElement1 = insertPhysicalElement({
              builder,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              userLabel: `test element 1`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement.id,
            });
            const testElement2 = insertPhysicalElement({
              builder,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              userLabel: `test element 2`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement.id,
            });
            const pathUntilRootElement = [adjustedModelKey(model), category];
            const rootGroupingNode = createClassGroupingHierarchyNode({
              className: rootElement.className,
              modelId: model.id,
              categoryId: category.id,
              elements: [rootElement.id],
              parentKeys: getGroupingNodeParentKeys(pathUntilRootElement),
            });
            const pathUntilTargetElement = [...pathUntilRootElement, adjustedElementKey(rootElement)];
            const groupingNode = createClassGroupingHierarchyNode({
              className: testElement1.className,
              modelId: model.id,
              categoryId: category.id,
              elements: [testElement1.id, testElement2.id],
              parentKeys: getGroupingNodeParentKeys([...pathUntilRootElement, rootGroupingNode.key, adjustedElementKey(rootElement)])
            });
            return { rootSubject, model, category, rootElement, testElement1, testElement2, pathUntilTargetElement, groupingNode };
          },
          (x) =>
            x.groupingNode.groupedInstanceKeys.map((elementKey) => ({
              path: [...x.pathUntilTargetElement, adjustedElementKey(elementKey)],
              options: { autoExpand: { depth: x.groupingNode.parentKeys.length, includeGroupingNodes: true } },
            })),
          (x) => [
            {
              parent: { type: "element", ids: [x.rootElement.id] },
              groupingNode: x.groupingNode,
            },
          ],
          undefined,
          (x) => [
            NodeValidators.createForInstanceNode({
              instanceKeys: [x.model],
              label: "model-x",
              autoExpand: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [x.category],
                  label: "category-x",
                  autoExpand: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      label: "Physical Object",
                      autoExpand: true,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [x.rootElement],
                          label: /^root element/,
                          autoExpand: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              label: "Test Physical Object",
                              autoExpand: false,
                              children: [
                                NodeValidators.createForInstanceNode({
                                  instanceKeys: [x.testElement1],
                                  label: /^test element 1/,
                                }),
                                NodeValidators.createForInstanceNode({
                                  instanceKeys: [x.testElement2],
                                  label: /^test element 2/,
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        ),
        TreeFilteringTestCaseDefinition.create(
          "grouped child elements of different classes",
          async (builder, testSchema) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const model = insertPhysicalModelWithPartition({ builder, codeValue: `model-x`, partitionParentId: rootSubject.id });
            const category = insertSpatialCategory({ builder, codeValue: "category-x" });
            const rootElement = insertPhysicalElement({ builder, userLabel: `root element`, modelId: model.id, categoryId: category.id });
            const physicalElement1 = insertPhysicalElement({
              builder,
              userLabel: `element 1`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement.id,
            });
            const physicalElement2 = insertPhysicalElement({
              builder,
              userLabel: `element 2`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement.id,
            });
            const testElement1 = insertPhysicalElement({
              builder,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              userLabel: `test element 1`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement.id,
            });
            const testElement2 = insertPhysicalElement({
              builder,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              userLabel: `test element 2`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement.id,
            });

            const pathUntilRootElement = [adjustedModelKey(model), category];
            const rootGroupingNode = createClassGroupingHierarchyNode({
              className: rootElement.className,
              modelId: model.id,
              categoryId: category.id,
              elements: [rootElement.id],
              parentKeys: getGroupingNodeParentKeys(pathUntilRootElement),
            });

            const pathUntilTargetElement = [...pathUntilRootElement, adjustedElementKey(rootElement)];
            const physicalElementGroupingNode = createClassGroupingHierarchyNode({
              className: physicalElement1.className,
              modelId: model.id,
              categoryId: category.id,
              elements: [physicalElement1.id, physicalElement2.id],
              parentKeys: getGroupingNodeParentKeys([...pathUntilRootElement, rootGroupingNode.key, adjustedElementKey(rootElement)]),
            });
            const testElementGroupingNode = createClassGroupingHierarchyNode({
              className: testElement1.className,
              modelId: model.id,
              categoryId: category.id,
              elements: [testElement1.id, testElement2.id],
              parentKeys: getGroupingNodeParentKeys([...pathUntilRootElement, rootGroupingNode.key, adjustedElementKey(rootElement)]),
            });
            return {
              rootSubject,
              model,
              category,
              rootElement,
              physicalElement1,
              physicalElement2,
              testElement1,
              testElement2,
              pathUntilTargetElement,
              physicalElementGroupingNode,
              testElementGroupingNode,
            };
          },
          (x) => [
            ...x.physicalElementGroupingNode.groupedInstanceKeys.map((elementKey) => ({
              path: [...x.pathUntilTargetElement, adjustedElementKey(elementKey)],
              options: { autoExpand: { depth: x.physicalElementGroupingNode.parentKeys.length, includeGroupingNodes: true } },
            })),
            ...x.testElementGroupingNode.groupedInstanceKeys.map((elementKey) => ({
              path: [...x.pathUntilTargetElement, adjustedElementKey(elementKey)],
              options: { autoExpand: { depth: x.testElementGroupingNode.parentKeys.length, includeGroupingNodes: true } },
            })),
          ],
          (x) => [
            {
              parent: { type: "element", ids: [x.rootElement.id] },
              groupingNode: x.physicalElementGroupingNode,
            },
            {
              parent: { type: "element", ids: [x.rootElement.id] },
              groupingNode: x.testElementGroupingNode,
            },
          ],
          undefined,
          (x) => [
            NodeValidators.createForInstanceNode({
              instanceKeys: [x.model],
              label: "model-x",
              autoExpand: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [x.category],
                  label: "category-x",
                  autoExpand: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      label: "Physical Object",
                      autoExpand: true,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [x.rootElement],
                          label: /^root element/,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              label: "Physical Object",
                              autoExpand: false,
                              children: [
                                NodeValidators.createForInstanceNode({ instanceKeys: [x.physicalElement1] }),
                                NodeValidators.createForInstanceNode({ instanceKeys: [x.physicalElement2] }),
                              ],
                            }),
                            NodeValidators.createForClassGroupingNode({
                              label: "Test Physical Object",
                              autoExpand: false,
                              children: [
                                NodeValidators.createForInstanceNode({ instanceKeys: [x.testElement1] }),
                                NodeValidators.createForInstanceNode({ instanceKeys: [x.testElement2] }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        ),
        TreeFilteringTestCaseDefinition.create(
          "hierarchy of grouped elements",
          async (builder) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const model = insertPhysicalModelWithPartition({ builder, codeValue: `model-x`, partitionParentId: rootSubject.id });
            const category = insertSpatialCategory({ builder, codeValue: "category-x" });
            const parentElement = insertPhysicalElement({ builder, userLabel: `parent element`, modelId: model.id, categoryId: category.id });
            const middleElement = insertPhysicalElement({
              builder,
              userLabel: `middle element`,
              modelId: model.id,
              categoryId: category.id,
              parentId: parentElement.id,
            });
            const childElement = insertPhysicalElement({
              builder,
              userLabel: `element 1`,
              modelId: model.id,
              categoryId: category.id,
              parentId: middleElement.id,
            });
            const pathUntilParentElement = [adjustedModelKey(model), category];
            const parentElementGroupingNode = createClassGroupingHierarchyNode({
              className: parentElement.className,
              modelId: model.id,
              categoryId: category.id,
              elements: [parentElement.id],
              parentKeys: getGroupingNodeParentKeys(pathUntilParentElement),
            });
            const middleElementGroupingNode = createClassGroupingHierarchyNode({
              className: middleElement.className,
              modelId: model.id,
              categoryId: category.id,
              elements: [middleElement.id],
              parentKeys: getGroupingNodeParentKeys([...pathUntilParentElement, parentElementGroupingNode.key, parentElement]),
            });
            const childElementGroupingNode = createClassGroupingHierarchyNode({
              className: childElement.className,
              modelId: model.id,
              categoryId: category.id,
              elements: [childElement.id],
              parentKeys: getGroupingNodeParentKeys([
                ...pathUntilParentElement,
                parentElementGroupingNode.key,
                parentElement,
                middleElementGroupingNode.key,
                middleElement,
              ]),
            });
            return {
              rootSubject,
              model,
              category,
              parentElement,
              middleElement,
              childElement,
              pathUntilParentElement,
              parentElementGroupingNode,
              middleElementGroupingNode,
              childElementGroupingNode,
            };
          },
          (x) => [
            {
              path: [...x.pathUntilParentElement, adjustedElementKey(x.parentElement)],
              options: { autoExpand: { depth: x.parentElementGroupingNode.parentKeys.length, includeGroupingNodes: true } },
            },
            {
              path: [...x.pathUntilParentElement, adjustedElementKey(x.parentElement), adjustedElementKey(x.middleElement)],
              options: { autoExpand: { depth: x.middleElementGroupingNode.parentKeys.length, includeGroupingNodes: true } },
            },
            {
              path: [...x.pathUntilParentElement, adjustedElementKey(x.parentElement), adjustedElementKey(x.middleElement), adjustedElementKey(x.childElement)],
              options: { autoExpand: { depth: x.childElementGroupingNode.parentKeys.length, includeGroupingNodes: true } },
            },
          ],
          (x) => [
            {
              parent: { type: "category", ids: [x.category.id], modelIds: [x.model.id] },
              groupingNode: x.parentElementGroupingNode,
            },
            {
              parent: { type: "element", ids: [x.parentElement.id] },
              groupingNode: x.middleElementGroupingNode,
            },
            {
              parent: { type: "element", ids: [x.middleElement.id] },
              groupingNode: x.childElementGroupingNode,
            },
          ],
          undefined,
          (x) => [
            NodeValidators.createForInstanceNode({
              instanceKeys: [x.model],
              label: "model-x",
              autoExpand: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [x.category],
                  label: "category-x",
                  autoExpand: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      label: "Physical Object",
                      autoExpand: true,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [x.parentElement],
                          label: /^parent element/,
                          autoExpand: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              label: "Physical Object",
                              autoExpand: true,
                              children: [
                                NodeValidators.createForInstanceNode({
                                  instanceKeys: [x.middleElement],
                                  label: /^middle element/,
                                  autoExpand: true,
                                  children: [
                                    NodeValidators.createForClassGroupingNode({
                                      label: "Physical Object",
                                      autoExpand: false,
                                      children: [NodeValidators.createForInstanceNode({ instanceKeys: [x.childElement] })],
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        ),
        TreeFilteringTestCaseDefinition.create(
          "grouped element with auto expansion to the grouping node and to the element",
          async (builder) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const model = insertPhysicalModelWithPartition({ builder, codeValue: `model-x`, partitionParentId: rootSubject.id });
            const category = insertSpatialCategory({ builder, codeValue: "category-x" });
            const element = insertPhysicalElement({ builder, userLabel: `parent element`, modelId: model.id, categoryId: category.id });
            const pathUntilTargetElement = [adjustedModelKey(model), category];
            const groupingNode = createClassGroupingHierarchyNode({
              className: element.className,
              modelId: model.id,
              categoryId: category.id,
              elements: [element.id],
              parentKeys: pathUntilTargetElement.map((key) => ({ type: "instances", instanceKeys: [key] })),
            });
            return { rootSubject, model, category, element, pathUntilTargetElement, groupingNode };
          },
          (x) => [
            [...x.pathUntilTargetElement, adjustedElementKey(x.element)],
            {
              path: [...x.pathUntilTargetElement, adjustedElementKey(x.element)],
              options: { autoExpand: { depth: x.groupingNode.parentKeys.length, includeGroupingNodes: true } },
            },
          ],
          (x) => [
            x.element,
            {
              parent: { type: "category", ids: [x.category.id], modelIds: [x.model.id] },
              groupingNode: x.groupingNode,
            },
          ],
          undefined,
          (x) => [
            NodeValidators.createForInstanceNode({
              instanceKeys: [x.model],
              label: "model-x",
              autoExpand: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [x.category],
                  label: "category-x",
                  autoExpand: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      label: "Physical Object",
                      autoExpand: true,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [x.element],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        ),
        TreeFilteringTestCaseDefinition.create(
          "grouped elements under different categories",
          async (builder) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const model = insertPhysicalModelWithPartition({ builder, codeValue: `model-x`, partitionParentId: rootSubject.id });
            const category1 = insertSpatialCategory({ builder, codeValue: "category-1" });
            const category2 = insertSpatialCategory({ builder, codeValue: "category-2" });
            const element1 = insertPhysicalElement({ builder, modelId: model.id, categoryId: category1.id });
            const element2 = insertPhysicalElement({ builder, modelId: model.id, categoryId: category2.id });
            const groupingNode1 = createClassGroupingHierarchyNode({
              className: element1.className,
              modelId: model.id,
              categoryId: category1.id,
              elements: [element1.id],
              parentKeys: [model, category1].map((key) => ({ type: "instances", instanceKeys: [key] })),
            });
            const groupingNode2 = createClassGroupingHierarchyNode({
              className: element2.className,
              modelId: model.id,
              categoryId: category2.id,
              elements: [element2.id],
              parentKeys: [model, category2].map((key) => ({ type: "instances", instanceKeys: [key] })),
            });
            return {
              rootSubject,
              model,
              category1,
              category2,
              element1,
              element2,
              groupingNode1,
              groupingNode2,
            };
          },
          (x) => [
            {
              path: [adjustedModelKey(x.model), x.category1, adjustedElementKey(x.element1)],
              options: { autoExpand: { depth: x.groupingNode1.parentKeys.length, includeGroupingNodes: true } },
            },
            {
              path: [adjustedModelKey(x.model), x.category2, adjustedElementKey(x.element2)],
              options: { autoExpand: { depth: x.groupingNode2.parentKeys.length, includeGroupingNodes: true } },
            },
          ],
          (x) => [
            {
              parent: { type: "category", ids: [x.category1.id], modelIds: [x.model.id] },
              groupingNode: x.groupingNode1,
            },
            {
              parent: { type: "category", ids: [x.category2.id], modelIds: [x.model.id] },
              groupingNode: x.groupingNode2,
            },
          ],
          undefined,
          (x) => [
            NodeValidators.createForInstanceNode({
              instanceKeys: [x.model],
              label: "model-x",
              autoExpand: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [x.category1],
                  label: "category-1",
                  autoExpand: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      label: "Physical Object",
                      autoExpand: false,
                      children: [NodeValidators.createForInstanceNode({ instanceKeys: [x.element1] })],
                    }),
                  ],
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [x.category2],
                  label: "category-2",
                  autoExpand: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      label: "Physical Object",
                      autoExpand: false,
                      children: [NodeValidators.createForInstanceNode({ instanceKeys: [x.element2] })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        ),
      );
    });
  });

  function runTestCases(...testCases: TreeFilteringTestCaseDefinition<any>[]) {
    testCases.forEach((testCase: TreeFilteringTestCaseDefinition<any>) => {
      (testCase.only ? describe.only : describe)(testCase.name, () => {
        let imodel: IModelConnection;
        let instanceKeyPaths!: HierarchyFilteringPath[];
        let targetItems!: Array<InstanceKey | ElementsGroupInfo>;
        let targetInstanceLabel: string | undefined;
        let expectedHierarchy!: ExpectedHierarchyDef[];

        let modelsTreeIdsCache: ModelsTreeIdsCache;
        let hierarchyProvider: ReturnType<typeof createModelsTreeProvider>;
        let hierarchyConfig: ModelsTreeHierarchyConfiguration;

        before(async function () {
          imodel = (
            await buildIModel(this, async (...args) => {
              const imodelSetupResult = await testCase.setupIModel(...args);
              instanceKeyPaths = testCase.getTargetInstancePaths(imodelSetupResult).sort(instanceKeyPathSorter);
              targetItems = testCase.getTargetItems(imodelSetupResult);
              targetInstanceLabel = testCase.getTargetInstanceLabel?.(imodelSetupResult);
              expectedHierarchy = testCase.getExpectedHierarchy(imodelSetupResult);
              hierarchyConfig = { ...defaultHierarchyConfiguration, hideRootSubject: true, ...testCase.getHierarchyConfig?.(imodelSetupResult) };
            })
          ).imodel;
        });

        beforeEach(() => {
          modelsTreeIdsCache = new ModelsTreeIdsCache(createIModelAccess(imodel), hierarchyConfig);
          hierarchyProvider = createModelsTreeProvider({ imodel, filteredNodePaths: instanceKeyPaths, hierarchyConfig });
        });

        afterEach(() => {
          modelsTreeIdsCache[Symbol.dispose]();
          hierarchyProvider.dispose();
        });

        after(async function () {
          await imodel.close();
        });

        it("filters hierarchy by instance key paths", async function () {
          await validateHierarchy({
            provider: hierarchyProvider,
            expect: expectedHierarchy,
          });
        });

        it("finds instance key paths by target instance key", async function () {
          const actualInstanceKeyPaths = (
            await ModelsTreeDefinition.createInstanceKeyPaths({
              imodelAccess: createIModelAccess(imodel),
              idsCache: modelsTreeIdsCache,
              targetItems,
              hierarchyConfig,
            })
          ).sort(instanceKeyPathSorter);
          expect(actualInstanceKeyPaths).to.deep.eq(instanceKeyPaths);
        });

        it("finds instance key paths by target instance label", async function () {
          if (targetInstanceLabel === undefined) {
            this.skip();
          }

          const actualInstanceKeyPaths = (
            await ModelsTreeDefinition.createInstanceKeyPaths({
              imodelAccess: createIModelAccess(imodel),
              idsCache: modelsTreeIdsCache,
              label: targetInstanceLabel,
              hierarchyConfig,
            })
          ).sort(instanceKeyPathSorter);
          expect(actualInstanceKeyPaths).to.deep.eq(instanceKeyPaths);
        });
      });
    });

    it("finds elements by base36 ECInstanceId suffix", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
        const model = insertPhysicalModelWithPartition({ builder, codeValue: `model`, partitionParentId: rootSubject.id });
        const category = insertSpatialCategory({ builder, codeValue: "category" });
        const element = insertPhysicalElement({ builder, userLabel: `element 21`, modelId: model.id, categoryId: category.id });
        const elementBriefcaseId = Id64.getBriefcaseId(element.id).toString(36).toLocaleUpperCase();
        const elementLocalId = Id64.getLocalId(element.id).toString(36).toLocaleUpperCase();
        return {
          formattedECInstanceId: `[${elementBriefcaseId}-${elementLocalId}]`,
          expectedPaths: [[adjustedModelKey(model), category, { ...element, className: CLASS_NAME_GeometricElement3d }]].sort(instanceKeyPathSorter),
        };
      });
      const { imodel, expectedPaths, formattedECInstanceId } = buildIModelResult;
      const hierarchyConfig = { ...defaultHierarchyConfiguration, hideRootSubject: true };

      const imodelAccess = createIModelAccess(imodel);
      using idsCache = new ModelsTreeIdsCache(imodelAccess, hierarchyConfig);
      const actualInstanceKeyPaths = (
        await ModelsTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          idsCache,
          label: formattedECInstanceId,
          hierarchyConfig,
        })
      ).sort(instanceKeyPathSorter);
      expect(actualInstanceKeyPaths).to.deep.eq(expectedPaths);
    });

    it("finds elements by label containing special SQLite characters", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
        const model = insertPhysicalModelWithPartition({ builder, codeValue: `model`, partitionParentId: rootSubject.id });
        const category = insertSpatialCategory({ builder, codeValue: "category" });
        const element1 = insertPhysicalElement({ builder, userLabel: `elem_ent 1`, modelId: model.id, categoryId: category.id });
        const element2 = insertPhysicalElement({ builder, userLabel: `elem%ent 2`, modelId: model.id, categoryId: category.id });
        const element3 = insertPhysicalElement({ builder, userLabel: `elem\\ent 3`, modelId: model.id, categoryId: category.id });
        return {
          keys: {
            rootSubject,
            model,
            category,
            element1,
            element2,
            element3,
          },
        };
      });
      const { imodel, keys } = buildIModelResult;
      const hierarchyConfig = { ...defaultHierarchyConfiguration, hideRootSubject: true };

      const imodelAccess = createIModelAccess(imodel);
      using idsCache = new ModelsTreeIdsCache(imodelAccess, hierarchyConfig);

      expect(
        (
          await ModelsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            idsCache,
            label: "_",
            hierarchyConfig,
          })
        ).sort(instanceKeyPathSorter),
      ).to.deep.eq([[adjustedModelKey(keys.model), keys.category, adjustedElementKey(keys.element1)]]);

      expect(
        (
          await ModelsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            idsCache,
            label: "%",
            hierarchyConfig,
          })
        ).sort(instanceKeyPathSorter),
      ).to.deep.eq([[adjustedModelKey(keys.model), keys.category, adjustedElementKey(keys.element2)]]);

      expect(
        (
          await ModelsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            idsCache,
            label: "\\",
            hierarchyConfig,
          })
        ).sort(instanceKeyPathSorter),
      ).to.deep.eq([[adjustedModelKey(keys.model), keys.category, adjustedElementKey(keys.element3)]]);
    });
  }
});

function insertModelWithElements(builder: TestIModelBuilder, modelNo: number, elementsCategoryId: Id64String, parentId?: Id64String) {
  const modelKey = insertPhysicalModelWithPartition({ builder, codeValue: `model-${modelNo}`, partitionParentId: parentId });
  insertPhysicalElement({ builder, userLabel: `element-${modelNo}`, modelId: modelKey.id, categoryId: elementsCategoryId });
  return modelKey;
}

function instanceKeyPathSorter(lhs: HierarchyFilteringPath, rhs: HierarchyFilteringPath) {
  const lhsPath = "path" in lhs ? lhs.path : lhs;
  const rhsPath = "path" in rhs ? rhs.path : rhs;
  if (lhsPath.length !== rhsPath.length) {
    return lhsPath.length - rhsPath.length;
  }
  for (let i = 0; i < lhsPath.length; ++i) {
    const lhsId = lhsPath[i];
    const rhsId = rhsPath[i];
    if (HierarchyNodeIdentifier.isInstanceNodeIdentifier(lhsId) && HierarchyNodeIdentifier.isInstanceNodeIdentifier(rhsId)) {
      const classNameCmp = lhsId.className.localeCompare(rhsId.className);
      if (0 !== classNameCmp) {
        return classNameCmp;
      }
      const idCmp = lhsId.id.localeCompare(rhsId.id);
      if (0 !== idCmp) {
        return idCmp;
      }
      continue;
    }
    if (HierarchyNodeIdentifier.isGenericNodeIdentifier(lhsId) && HierarchyNodeIdentifier.isGenericNodeIdentifier(rhsId)) {
      const keyCmp = lhsId.id.localeCompare(rhsId.id);
      if (0 !== keyCmp) {
        return keyCmp;
      }
      continue;
    }
    return HierarchyNodeIdentifier.isGenericNodeIdentifier(lhsId) ? -1 : 1;
  }
  return 0;
}

const adjustedModelKey = (source: InstanceKey) => ({ className: CLASS_NAME_GeometricModel3d, id: source.id });
const adjustedElementKey = (source: InstanceKey) => ({ className: CLASS_NAME_GeometricElement3d, id: source.id });

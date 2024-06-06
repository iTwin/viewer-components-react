/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { join } from "node:path";
import { IModel, IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import {
  buildIModel,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  insertSubject,
} from "../../../IModelUtils";
import { NodeValidators, validateHierarchy } from "../../HierarchyValidation";
import { createModelsTreeProvider } from "./Utils";

import type { InstanceKey } from "@itwin/presentation-shared";

describe("Models tree", () => {
  describe("Hierarchy definition", () => {
    before(async function () {
      await initializePresentationTesting({
        backendProps: {
          caching: {
            hierarchies: {
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        testOutputDir: join(__dirname, "output"),
        backendHostProps: {
          cacheDir: join(__dirname, "cache"),
        },
        rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async function () {
      await terminatePresentationTesting();
    });

    it("creates Subject - Model - Category - Element hierarchy", async function () {
      const { imodel, ...keys } = await buildIModel(this, async (builder, testSchema) => {
        const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
        const childSubject = insertSubject({ builder, codeValue: "child subject", parentId: rootSubject.id });
        const model = insertPhysicalModelWithPartition({ builder, codeValue: `model`, partitionParentId: childSubject.id });
        const category = insertSpatialCategory({ builder, codeValue: "category" });
        const rootElement1 = insertPhysicalElement({ builder, userLabel: `root element 1`, modelId: model.id, categoryId: category.id });
        const childElement = insertPhysicalElement({
          builder,
          userLabel: `child element`,
          modelId: model.id,
          categoryId: category.id,
          parentId: rootElement1.id,
        });
        const rootElement2 = insertPhysicalElement({
          builder,
          classFullName: testSchema.items.SubModelabalePhysicalObject.fullName,
          userLabel: `root element 2`,
          modelId: model.id,
          categoryId: category.id,
        });
        const subModel = insertPhysicalSubModel({ builder, modeledElementId: rootElement2.id });
        const modelingElement = insertPhysicalElement({ builder, userLabel: `modeling element`, modelId: subModel.id, categoryId: category.id });
        return { rootSubject, childSubject, model, category, rootElement1, rootElement2, childElement, modelingElement };
      });
      await validateHierarchy({
        provider: createModelsTreeProvider(imodel),
        expect: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [keys.rootSubject],
            autoExpand: true,
            supportsFiltering: true,
            children: [
              NodeValidators.createForInstanceNode({
                instanceKeys: [keys.childSubject],
                supportsFiltering: true,
                children: [
                  NodeValidators.createForInstanceNode({
                    instanceKeys: [keys.model],
                    supportsFiltering: true,
                    children: [
                      NodeValidators.createForInstanceNode({
                        instanceKeys: [keys.category],
                        supportsFiltering: true,
                        children: [
                          NodeValidators.createForClassGroupingNode({
                            className: keys.rootElement1.className,
                            children: [
                              NodeValidators.createForInstanceNode({
                                instanceKeys: [keys.rootElement1],
                                supportsFiltering: true,
                                children: [
                                  NodeValidators.createForClassGroupingNode({
                                    className: keys.childElement.className,
                                    children: [
                                      NodeValidators.createForInstanceNode({
                                        instanceKeys: [keys.childElement],
                                        supportsFiltering: true,
                                        children: false,
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                          NodeValidators.createForClassGroupingNode({
                            className: keys.rootElement2.className,
                            children: [
                              NodeValidators.createForInstanceNode({
                                instanceKeys: [keys.rootElement2],
                                supportsFiltering: true,
                                children: [
                                  NodeValidators.createForInstanceNode({
                                    instanceKeys: [keys.category],
                                    supportsFiltering: true,
                                    children: [
                                      NodeValidators.createForClassGroupingNode({
                                        className: keys.modelingElement.className,
                                        children: [
                                          NodeValidators.createForInstanceNode({
                                            instanceKeys: [keys.modelingElement],
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
      });
    });

    describe("Subjects", () => {
      it(`hides subjects with \`Subject.Model.Type = "Hierarchy"\` json property`, async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const childSubject = insertSubject({
            builder,
            codeValue: "child subject",
            parentId: rootSubject.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } },
          });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: `model`, partitionParentId: childSubject.id });
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const element = insertPhysicalElement({ builder, userLabel: `element`, modelId: model.id, categoryId: category.id });
          return { rootSubject, childSubject, model, category, element };
        });
        await validateHierarchy({
          provider: createModelsTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.model],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.category],
                      supportsFiltering: true,
                      children: [
                        NodeValidators.createForClassGroupingNode({
                          className: keys.element.className,
                          children: [NodeValidators.createForInstanceNode({ instanceKeys: [keys.element], supportsFiltering: true, children: false })],
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

      it("hides childless subjects", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const childSubject = insertSubject({ builder, codeValue: "child subject", parentId: rootSubject.id });
          return { rootSubject, childSubject };
        });
        await validateHierarchy({
          provider: createModelsTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: false,
            }),
          ],
        });
      });

      it("hides subjects with childless models", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const childSubject1 = insertSubject({ builder, codeValue: "child subject 1", parentId: rootSubject.id });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: `model`, partitionParentId: childSubject1.id });
          const childSubject2 = insertSubject({
            builder,
            codeValue: "child subject 2",
            parentId: rootSubject.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { Subject: { Model: { TargetPartition: model.id } } },
          });
          return { rootSubject, childSubject1, childSubject2, model };
        });
        await validateHierarchy({
          provider: createModelsTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: false,
            }),
          ],
        });
      });

      it("hides subjects with private models", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const childSubject1 = insertSubject({ builder, codeValue: "child subject 1", parentId: rootSubject.id });
          const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
          const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id, isPrivate: true });
          const childSubject2 = insertSubject({
            builder,
            codeValue: "child subject 2",
            parentId: rootSubject.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { Subject: { Model: { TargetPartition: model.id } } },
          });
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          insertPhysicalElement({ builder, userLabel: `element`, modelId: model.id, categoryId: category.id });
          return { rootSubject, childSubject1, childSubject2, model };
        });
        await validateHierarchy({
          provider: createModelsTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: false,
            }),
          ],
        });
      });

      it("shows subjects with child models related with subject through `Subject.Model.TargetPartition` json property", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const childSubject1 = insertSubject({ builder, codeValue: "child subject 1", parentId: rootSubject.id });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: `model`, partitionParentId: childSubject1.id });
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const element = insertPhysicalElement({ builder, userLabel: `element`, modelId: model.id, categoryId: category.id });
          const childSubject2 = insertSubject({
            builder,
            codeValue: "child subject 2",
            parentId: rootSubject.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { Subject: { Model: { TargetPartition: model.id } } },
          });
          return { rootSubject, childSubject1, childSubject2, model, category, element };
        });
        await validateHierarchy({
          provider: createModelsTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.childSubject1],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.model],
                      supportsFiltering: true,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.category],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: keys.element.className,
                              children: [NodeValidators.createForInstanceNode({ instanceKeys: [keys.element], supportsFiltering: true, children: false })],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.childSubject2],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.model],
                      supportsFiltering: true,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.category],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: keys.element.className,
                              children: [NodeValidators.createForInstanceNode({ instanceKeys: [keys.element], supportsFiltering: true, children: false })],
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
        });
      });

      it("merges subjects from different parts of hierarchy", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const hiddenSubject1 = insertSubject({
            builder,
            codeValue: "hidden subject 1",
            parentId: rootSubject.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } },
          });
          const hiddenSubject2 = insertSubject({
            builder,
            codeValue: "hidden subject 2",
            parentId: rootSubject.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } },
          });
          const mergedSubject1 = insertSubject({ builder, codeValue: "merged subject", parentId: hiddenSubject1.id });
          const mergedSubject2 = insertSubject({ builder, codeValue: "merged subject", parentId: hiddenSubject2.id });
          const model1 = insertPhysicalModelWithPartition({ builder, codeValue: `model1`, partitionParentId: mergedSubject1.id });
          const element1 = insertPhysicalElement({ builder, userLabel: `element1`, modelId: model1.id, categoryId: category.id });
          const model2 = insertPhysicalModelWithPartition({ builder, codeValue: `model2`, partitionParentId: mergedSubject2.id });
          const element2 = insertPhysicalElement({ builder, userLabel: `element1`, modelId: model2.id, categoryId: category.id });
          return { rootSubject, mergedSubject1, mergedSubject2, model1, model2, category, element1, element2 };
        });
        await validateHierarchy({
          provider: createModelsTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.mergedSubject1, keys.mergedSubject2],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.model1],
                      supportsFiltering: true,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.category],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: keys.element1.className,
                              children: [NodeValidators.createForInstanceNode({ instanceKeys: [keys.element1], supportsFiltering: true, children: false })],
                            }),
                          ],
                        }),
                      ],
                    }),
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.model2],
                      supportsFiltering: true,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.category],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: keys.element2.className,
                              children: [NodeValidators.createForInstanceNode({ instanceKeys: [keys.element2], supportsFiltering: true, children: false })],
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
        });
      });
    });

    describe("Models", () => {
      it("hides models with `PhysicalPartition.Model.Content` json property", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const partition = insertPhysicalPartition({
            builder,
            codeValue: "model",
            parentId: rootSubject.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { PhysicalPartition: { Model: { Content: true } } },
          });
          const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const element = insertPhysicalElement({ builder, userLabel: `element`, modelId: model.id, categoryId: category.id });
          return { rootSubject, model, category, element };
        });
        await validateHierarchy({
          provider: createModelsTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.element.className,
                      children: [NodeValidators.createForInstanceNode({ instanceKeys: [keys.element], supportsFiltering: true, children: false })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      it("hides models with `GraphicalPartition3d.Model.Content` json property", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const partition = insertPhysicalPartition({
            builder,
            codeValue: "model",
            parentId: rootSubject.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { GraphicalPartition3d: { Model: { Content: true } } },
          });
          const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const element = insertPhysicalElement({ builder, userLabel: `element`, modelId: model.id, categoryId: category.id });
          return { rootSubject, model, category, element };
        });
        await validateHierarchy({
          provider: createModelsTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.element.className,
                      children: [NodeValidators.createForInstanceNode({ instanceKeys: [keys.element], supportsFiltering: true, children: false })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      it("hides private models and their content", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
          const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id, isPrivate: true });
          const category = insertSpatialCategory({ builder, codeValue: "category" });
          const element = insertPhysicalElement({ builder, userLabel: `element`, modelId: model.id, categoryId: category.id });
          return { rootSubject, model, category, element };
        });
        await validateHierarchy({
          provider: createModelsTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: false,
            }),
          ],
        });
      });

      it("hides empty models", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
          const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
          return { rootSubject, model };
        });
        await validateHierarchy({
          provider: createModelsTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: false,
            }),
          ],
        });
      });
    });

    describe("Categories", () => {
      it("merges categories from different parts of hierarchy", async function () {
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const category1 = insertSpatialCategory({ builder, codeValue: "category1", userLabel: "merged category" });
          const category2 = insertSpatialCategory({ builder, codeValue: "category2", userLabel: "merged category" });
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const hiddenSubject1 = insertSubject({
            builder,
            codeValue: "hidden subject 1",
            parentId: rootSubject.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } },
          });
          const hiddenSubject2 = insertSubject({
            builder,
            codeValue: "hidden subject 2",
            parentId: rootSubject.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } },
          });
          const partition1 = insertPhysicalPartition({
            builder,
            codeValue: "model1",
            parentId: hiddenSubject1.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { PhysicalPartition: { Model: { Content: true } } },
          });
          const model1 = insertPhysicalSubModel({ builder, modeledElementId: partition1.id });
          const element1 = insertPhysicalElement({ builder, userLabel: `element1`, modelId: model1.id, categoryId: category1.id });
          const partition2 = insertPhysicalPartition({
            builder,
            codeValue: "model2",
            parentId: hiddenSubject2.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            jsonProperties: { PhysicalPartition: { Model: { Content: true } } },
          });
          const model2 = insertPhysicalSubModel({ builder, modeledElementId: partition2.id });
          const element2 = insertPhysicalElement({ builder, userLabel: `element2`, modelId: model2.id, categoryId: category2.id });
          return { rootSubject, model1, model2, category1, category2, element1, element2 };
        });
        await validateHierarchy({
          provider: createModelsTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category1, keys.category2],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.element1.className,
                      children: [
                        NodeValidators.createForInstanceNode({ instanceKeys: [keys.element1], supportsFiltering: true, children: false }),
                        NodeValidators.createForInstanceNode({ instanceKeys: [keys.element2], supportsFiltering: true, children: false }),
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
});

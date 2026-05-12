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
  insertSubject,
  terminateCore,
} from "test-utilities";
import { afterAll, beforeAll, describe, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { CLASS_NAME_GeometricElement2d, CLASS_NAME_Subject } from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { buildIModel } from "../../IModelUtils.js";
import { NodeValidators, validateHierarchy } from "../HierarchyValidation.js";
import { createModelsTreeProvider } from "./Utils.js";

import type { InstanceKey } from "@itwin/presentation-shared";

describe("Models tree", () => {
  describe("Hierarchy definition", () => {
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
    });

    afterAll(async () => {
      await terminateCore();
    });

    it("creates Subject - Model - Category - Element hierarchy", async () => {
      await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
        withEditTxn(imodel, (txn) => {
          const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
          const childSubject = insertSubject({ txn, codeValue: "child subject", parentId: rootSubject.id });
          const model = insertPhysicalModelWithPartition({ txn, codeValue: `model`, partitionParentId: childSubject.id });
          const category = insertSpatialCategory({ txn, codeValue: "category" });
          const rootElement1 = insertPhysicalElement({ txn, userLabel: `root element 1`, modelId: model.id, categoryId: category.id });
          const childElement = insertPhysicalElement({
            txn,
            userLabel: `child element`,
            modelId: model.id,
            categoryId: category.id,
            parentId: rootElement1.id,
          });
          const rootElement2 = insertPhysicalElement({
            txn,
            classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            userLabel: `root element 2`,
            modelId: model.id,
            categoryId: category.id,
          });
          const subModel = insertPhysicalSubModel({ txn, modeledElementId: rootElement2.id });
          const modelingElement = insertPhysicalElement({ txn, userLabel: `modeling element`, modelId: subModel.id, categoryId: category.id });
          return { rootSubject, childSubject, model, category, rootElement1, rootElement2, childElement, modelingElement };
        }),
      );
      const { imodelConnection, ...keys } = buildIModelResult;
      using provider = createModelsTreeProvider({ imodelConnection, hierarchyConfig: { hideRootSubject: false } });
      await validateHierarchy({
        provider,
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
                            label: "Physical Object",
                            children: [
                              NodeValidators.createForInstanceNode({
                                instanceKeys: [keys.rootElement1],
                                supportsFiltering: true,
                                children: [
                                  NodeValidators.createForClassGroupingNode({
                                    className: keys.childElement.className,
                                    label: "Physical Object",
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
                            label: "Test Physical Object",
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
                                        label: "Physical Object",
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
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const childSubject = insertSubject({
              txn,
              codeValue: "child subject",
              parentId: rootSubject.id,
              jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } },
            });
            const model = insertPhysicalModelWithPartition({ txn, codeValue: `model`, partitionParentId: childSubject.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const element = insertPhysicalElement({ txn, userLabel: `element`, modelId: model.id, categoryId: category.id });
            return { rootSubject, childSubject, model, category, element };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });

      it("hides childless subjects", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const childSubject = insertSubject({ txn, codeValue: "child subject", parentId: rootSubject.id });
            return { rootSubject, childSubject };
          }),
        );
        const { imodelConnection } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [],
        });
      });

      it("hides subjects with childless models", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const childSubject1 = insertSubject({ txn, codeValue: "child subject 1", parentId: rootSubject.id });
            const model = insertPhysicalModelWithPartition({ txn, codeValue: `model`, partitionParentId: childSubject1.id });
            const childSubject2 = insertSubject({
              txn,
              codeValue: "child subject 2",
              parentId: rootSubject.id,
              jsonProperties: { Subject: { Model: { TargetPartition: model.id } } },
            });
            return { rootSubject, childSubject1, childSubject2, model };
          }),
        );
        const { imodelConnection } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [],
        });
      });

      it("hides subjects with private models", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const childSubject1 = insertSubject({ txn, codeValue: "child subject 1", parentId: rootSubject.id });
            const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id, isPrivate: true });
            const childSubject2 = insertSubject({
              txn,
              codeValue: "child subject 2",
              parentId: rootSubject.id,
              jsonProperties: { Subject: { Model: { TargetPartition: model.id } } },
            });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            insertPhysicalElement({ txn, userLabel: `element`, modelId: model.id, categoryId: category.id });
            return { rootSubject, childSubject1, childSubject2, model };
          }),
        );
        const { imodelConnection } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [],
        });
      });

      it("shows subjects with child models related with subject through `Subject.Model.TargetPartition` json property", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const childSubject1 = insertSubject({ txn, codeValue: "child subject 1", parentId: rootSubject.id });
            const model = insertPhysicalModelWithPartition({ txn, codeValue: `model`, partitionParentId: childSubject1.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const element = insertPhysicalElement({ txn, userLabel: `element`, modelId: model.id, categoryId: category.id });
            const childSubject2 = insertSubject({
              txn,
              codeValue: "child subject 2",
              parentId: rootSubject.id,
              jsonProperties: { Subject: { Model: { TargetPartition: model.id } } },
            });
            return { rootSubject, childSubject1, childSubject2, model, category, element };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });

      it("merges subjects from different parts of hierarchy", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const hiddenSubject1 = insertSubject({
              txn,
              codeValue: "hidden subject 1",
              parentId: rootSubject.id,
              jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } },
            });
            const hiddenSubject2 = insertSubject({
              txn,
              codeValue: "hidden subject 2",
              parentId: rootSubject.id,
              jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } },
            });
            const mergedSubject1 = insertSubject({ txn, codeValue: "merged subject", parentId: hiddenSubject1.id });
            const mergedSubject2 = insertSubject({ txn, codeValue: "merged subject", parentId: hiddenSubject2.id });
            const model1 = insertPhysicalModelWithPartition({ txn, codeValue: `model1`, partitionParentId: mergedSubject1.id });
            const element1 = insertPhysicalElement({ txn, userLabel: `element1`, modelId: model1.id, categoryId: category.id });
            const model2 = insertPhysicalModelWithPartition({ txn, codeValue: `model2`, partitionParentId: mergedSubject2.id });
            const element2 = insertPhysicalElement({ txn, userLabel: `element1`, modelId: model2.id, categoryId: category.id });
            return { rootSubject, mergedSubject1, mergedSubject2, model1, model2, category, element1, element2 };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });
    });

    describe("Models", () => {
      it("hides models with `PhysicalPartition.Model.Content` json property", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({
              txn,
              codeValue: "model",
              parentId: rootSubject.id,
              jsonProperties: { PhysicalPartition: { Model: { Content: true } } },
            });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const element = insertPhysicalElement({ txn, userLabel: `element`, modelId: model.id, categoryId: category.id });
            return { rootSubject, model, category, element };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });

      it("hides models with `GraphicalPartition3d.Model.Content` json property", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({
              txn,
              codeValue: "model",
              parentId: rootSubject.id,
              jsonProperties: { GraphicalPartition3d: { Model: { Content: true } } },
            });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const element = insertPhysicalElement({ txn, userLabel: `element`, modelId: model.id, categoryId: category.id });
            return { rootSubject, model, category, element };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });

      it("hides private models and their content", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id, isPrivate: true });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const element = insertPhysicalElement({ txn, userLabel: `element`, modelId: model.id, categoryId: category.id });
            return { rootSubject, model, category, element };
          }),
        );
        const { imodelConnection } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [],
        });
      });

      it("hides empty models", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
            return { rootSubject, model };
          }),
        );
        const { imodelConnection } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [],
        });
      });

      it("children of child element is set to true when child element has subModel that contains children", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const rootElement = insertPhysicalElement({
              txn,
              userLabel: `root element`,
              modelId: model.id,
              categoryId: category.id,
            });
            const childElement = insertPhysicalElement({
              txn,
              userLabel: `child element`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            const subModel = insertPhysicalSubModel({ txn, modeledElementId: childElement.id });
            const childOfChild = insertPhysicalElement({
              txn,
              userLabel: `child element2`,
              modelId: subModel.id,
              categoryId: category.id,
            });
            return { rootSubject, model, category, rootElement, childElement, childOfChild };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.model],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.rootElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.rootElement],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: keys.childElement.className,
                              children: [
                                NodeValidators.createForInstanceNode({
                                  instanceKeys: [keys.childElement],
                                  supportsFiltering: true,
                                  children: [
                                    NodeValidators.createForInstanceNode({
                                      instanceKeys: [keys.category],
                                      supportsFiltering: true,
                                      children: [
                                        NodeValidators.createForClassGroupingNode({
                                          className: keys.childOfChild.className,
                                          children: [
                                            NodeValidators.createForInstanceNode({
                                              instanceKeys: [keys.childOfChild],
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

      it("children of child element is set to false when it's subModel is private", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const rootElement = insertPhysicalElement({
              txn,
              userLabel: `root element`,
              modelId: model.id,
              categoryId: category.id,
            });
            const childElement = insertPhysicalElement({
              txn,
              userLabel: `child element`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            const subModel = insertPhysicalSubModel({ txn, modeledElementId: childElement.id, isPrivate: true });
            insertPhysicalElement({
              txn,
              userLabel: `child element2`,
              modelId: subModel.id,
              categoryId: category.id,
            });
            return { rootSubject, model, category, rootElement, childElement };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.model],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.rootElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.rootElement],
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
                  ],
                }),
              ],
            }),
          ],
        });
      });

      it("children of child element is set to false when it's subModel has no children", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const rootElement = insertPhysicalElement({
              txn,
              userLabel: `root element`,
              modelId: model.id,
              categoryId: category.id,
            });
            const childElement = insertPhysicalElement({
              txn,
              userLabel: `child element`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            insertPhysicalSubModel({ txn, modeledElementId: childElement.id });
            return { rootSubject, model, category, rootElement, childElement };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.model],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.rootElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.rootElement],
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
                  ],
                }),
              ],
            }),
          ],
        });
      });

      it("children of element is set to true when element has subModel that contains children", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const rootElement = insertPhysicalElement({
              txn,
              userLabel: `root element`,
              modelId: model.id,
              categoryId: category.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            const subModel = insertPhysicalSubModel({ txn, modeledElementId: rootElement.id });
            const childElement = insertPhysicalElement({
              txn,
              userLabel: `child element`,
              modelId: subModel.id,
              categoryId: category.id,
            });
            return { rootSubject, model, category, rootElement, childElement };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.model],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.rootElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.rootElement],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.category],
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
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      it("children of element is set to false when it's subModel is private", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const rootElement = insertPhysicalElement({
              txn,
              userLabel: `root element`,
              modelId: model.id,
              categoryId: category.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            const subModel = insertPhysicalSubModel({ txn, modeledElementId: rootElement.id, isPrivate: true });
            insertPhysicalElement({
              txn,
              userLabel: `root element`,
              modelId: subModel.id,
              categoryId: category.id,
            });
            return { rootSubject, model, category, rootElement };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.model],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.rootElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.rootElement],
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

      it("children of element is set to false when it's subModel has no children", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const rootElement = insertPhysicalElement({
              txn,
              userLabel: `root element`,
              modelId: model.id,
              categoryId: category.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            insertPhysicalSubModel({ txn, modeledElementId: rootElement.id });
            return { rootSubject, model, category, rootElement };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.model],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.rootElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.rootElement],
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

    describe("Categories", () => {
      it("merges categories from different parts of hierarchy", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const category1 = insertSpatialCategory({ txn, codeValue: "category1", userLabel: "merged category" });
            const category2 = insertSpatialCategory({ txn, codeValue: "category2", userLabel: "merged category" });
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const hiddenSubject1 = insertSubject({
              txn,
              codeValue: "hidden subject 1",
              parentId: rootSubject.id,
              jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } },
            });
            const hiddenSubject2 = insertSubject({
              txn,
              codeValue: "hidden subject 2",
              parentId: rootSubject.id,
              jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } },
            });
            const partition1 = insertPhysicalPartition({
              txn,
              codeValue: "model1",
              parentId: hiddenSubject1.id,
              jsonProperties: { PhysicalPartition: { Model: { Content: true } } },
            });
            const model1 = insertPhysicalSubModel({ txn, modeledElementId: partition1.id });
            const element1 = insertPhysicalElement({ txn, userLabel: `element1`, modelId: model1.id, categoryId: category1.id });
            const partition2 = insertPhysicalPartition({
              txn,
              codeValue: "model2",
              parentId: hiddenSubject2.id,
              jsonProperties: { PhysicalPartition: { Model: { Content: true } } },
            });
            const model2 = insertPhysicalSubModel({ txn, modeledElementId: partition2.id });
            const element2 = insertPhysicalElement({ txn, userLabel: `element2`, modelId: model2.id, categoryId: category2.id });
            return { rootSubject, model1, model2, category1, category2, element1, element2 };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection });
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });
    });

    describe("Hierarchy customization", () => {
      it("shows empty models when `showEmptyModels` is set to true", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
            return { rootSubject, model };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection, hierarchyConfig: { showEmptyModels: true } });
        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.model],
              autoExpand: false,
              supportsFiltering: true,
            }),
          ],
        });
      });

      it("does not group elements when `elementClassGrouping` set to `disable`", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const childSubject = insertSubject({ txn, codeValue: "child subject", parentId: rootSubject.id });
            const model = insertPhysicalModelWithPartition({ txn, codeValue: `model`, partitionParentId: childSubject.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const rootElement1 = insertPhysicalElement({ txn, userLabel: `root element 1`, modelId: model.id, categoryId: category.id });
            const childElement = insertPhysicalElement({
              txn,
              userLabel: `child element`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement1.id,
            });
            const rootElement2 = insertPhysicalElement({
              txn,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              userLabel: `root element 2`,
              modelId: model.id,
              categoryId: category.id,
            });
            const subModel = insertPhysicalSubModel({ txn, modeledElementId: rootElement2.id });
            const modelingElement = insertPhysicalElement({ txn, userLabel: `modeling element`, modelId: subModel.id, categoryId: category.id });
            return { rootSubject, childSubject, model, category, rootElement1, rootElement2, childElement, modelingElement };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection, hierarchyConfig: { elementClassGrouping: "disable" } });
        await validateHierarchy({
          provider,
          expect: [
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
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.rootElement1],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.childElement],
                              supportsFiltering: true,
                              children: false,
                            }),
                          ],
                        }),
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.rootElement2],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.category],
                              supportsFiltering: true,
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
        });
      });

      it("displays element count for grouping nodes when `elementClassGrouping` set to `enableWithCounts`", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const childSubject = insertSubject({ txn, codeValue: "child subject", parentId: rootSubject.id });
            const model = insertPhysicalModelWithPartition({ txn, codeValue: `model`, partitionParentId: childSubject.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const rootElement1 = insertPhysicalElement({ txn, userLabel: `root element 1`, modelId: model.id, categoryId: category.id });
            const childElement1 = insertPhysicalElement({
              txn,
              userLabel: `child element 1`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement1.id,
            });
            const childElement2 = insertPhysicalElement({
              txn,
              userLabel: `child element 2`,
              modelId: model.id,
              categoryId: category.id,
              parentId: rootElement1.id,
            });
            const rootElement2 = insertPhysicalElement({
              txn,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              userLabel: `root element 2`,
              modelId: model.id,
              categoryId: category.id,
            });
            const subModel = insertPhysicalSubModel({ txn, modeledElementId: rootElement2.id });
            const modelingElement = insertPhysicalElement({ txn, userLabel: `modeling element`, modelId: subModel.id, categoryId: category.id });
            return { rootSubject, childSubject, model, category, rootElement1, rootElement2, childElement1, childElement2, modelingElement };
          }),
        );
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection, hierarchyConfig: { elementClassGrouping: "enableWithCounts" } });
        await validateHierarchy({
          provider,
          expect: [
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
                          label: "Physical Object (1)",
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.rootElement1],
                              supportsFiltering: true,
                              children: [
                                NodeValidators.createForClassGroupingNode({
                                  className: keys.childElement1.className,
                                  label: "Physical Object (2)",
                                  children: [
                                    NodeValidators.createForInstanceNode({
                                      instanceKeys: [keys.childElement1],
                                      supportsFiltering: true,
                                      children: false,
                                    }),
                                    NodeValidators.createForInstanceNode({
                                      instanceKeys: [keys.childElement2],
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
                          label: "Test Physical Object (1)",
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
                                      label: "Physical Object (1)",
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
        });
      });

      it("uses custom element class specification", async () => {
        await using buildIModelResult = await buildIModel(async (imodel, testSchema) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const model = insertPhysicalModelWithPartition({ txn, codeValue: `model`, partitionParentId: rootSubject.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const parentElement1 = insertPhysicalElement({
              txn,
              userLabel: `parent element 1`,
              modelId: model.id,
              categoryId: category.id,
            });
            const parentElement2 = insertPhysicalElement({
              txn,
              userLabel: `parent element 2`,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              modelId: model.id,
              categoryId: category.id,
            });
            const childElement1 = insertPhysicalElement({
              txn,
              userLabel: `child element 1`,
              modelId: model.id,
              categoryId: category.id,
              parentId: parentElement1.id,
            });
            const childElement2 = insertPhysicalElement({
              txn,
              userLabel: `child element 2`,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              modelId: model.id,
              categoryId: category.id,
              parentId: parentElement2.id,
            });
            return { rootSubject, model, category, parentElement1, childElement1, parentElement2, childElement2 };
          }),
        );

        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({
          imodelConnection,
          hierarchyConfig: { elementClassSpecification: keys.parentElement2.className, elementClassGrouping: "disable" },
        });
        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.model],
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.parentElement2],
                      supportsFiltering: true,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.childElement2],
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

      it("returns empty hierarchy when the iModel doesn't have any elements of `elementClassSpecification` class", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ txn, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
            return { rootSubject, model };
          }),
        );
        const { imodelConnection } = buildIModelResult;
        using provider = createModelsTreeProvider({ imodelConnection, hierarchyConfig: { elementClassSpecification: CLASS_NAME_GeometricElement2d } });
        await validateHierarchy({
          provider,
          expect: [],
        });
      });

      it("disables hierarchy level filtering support when `hierarchyLevelFiltering` is set to `disable`", async () => {
        await using buildIModelResult = await buildIModel(async (imodel) =>
          withEditTxn(imodel, (txn) => {
            const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
            const model = insertPhysicalModelWithPartition({ txn, codeValue: `model`, partitionParentId: rootSubject.id });
            const category = insertSpatialCategory({ txn, codeValue: "category" });
            const parentElement = insertPhysicalElement({
              txn,
              userLabel: `parent element 1`,
              modelId: model.id,
              categoryId: category.id,
            });
            const childElement = insertPhysicalElement({
              txn,
              userLabel: `child element 1`,
              modelId: model.id,
              categoryId: category.id,
              parentId: parentElement.id,
            });
            return { rootSubject, model, category, parentElement, childElement };
          }),
        );

        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createModelsTreeProvider({
          imodelConnection,
          hierarchyConfig: { hierarchyLevelFiltering: "disable" },
        });
        await validateHierarchy({
          provider,
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.model],
              supportsFiltering: false,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.category],
                  supportsFiltering: false,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.parentElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.parentElement],
                          supportsFiltering: false,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: keys.childElement.className,
                              children: [
                                NodeValidators.createForInstanceNode({
                                  instanceKeys: [keys.childElement],
                                  supportsFiltering: false,
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
        });
      });
    });
  });
});

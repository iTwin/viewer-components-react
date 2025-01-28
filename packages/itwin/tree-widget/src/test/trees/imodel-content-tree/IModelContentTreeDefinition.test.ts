/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModel, IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import {
  HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { IModelContentTreeDefinition } from "../../../tree-widget/components/trees/imodel-content-tree/IModelContentTreeDefinition.js";
import { IModelContentTreeIdsCache } from "../../../tree-widget/components/trees/imodel-content-tree/internal/IModelContentTreeIdsCache.js";
import {
  buildIModel, insertDrawingCategory, insertDrawingElement, insertDrawingGraphic, insertDrawingSubModel, insertGroupInformationElement,
  insertGroupInformationModelWithPartition, insertModelWithPartition, insertPhysicalElement, insertPhysicalModelWithPartition, insertPhysicalSubModel,
  insertSpatialCategory, insertSubject, insertSubModel,
} from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";
import { NodeValidators, validateHierarchy } from "../HierarchyValidation.js";

import type { InstanceKey } from "@itwin/presentation-common";
import type { IModelConnection } from "@itwin/core-frontend";

describe("iModel content tree", () => {
  describe("Hierarchy definition", () => {
    const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
    const dictionaryModel: InstanceKey = { className: "BisCore.DictionaryModel", id: IModel.dictionaryId };

    before(async function () {
      await initializePresentationTesting({
        backendProps: {
          caching: {
            hierarchies: {
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();
    });

    after(async function () {
      await terminatePresentationTesting();
    });

    describe("subjects' children", () => {
      it("creates subjects hierarchy", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const subjectA = insertSubject({ builder, codeValue: "A", parentId: IModel.rootSubjectId });
          const subjectB = insertSubject({ builder, codeValue: "B", parentId: IModel.rootSubjectId });
          const subjectC = insertSubject({ builder, codeValue: "C", parentId: subjectB.id });
          return { rootSubject, dictionaryModel, subjectA, subjectB, subjectC };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.subjectA],
                  supportsFiltering: true,
                  children: false,
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.subjectB],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.subjectC],
                      supportsFiltering: true,
                      children: false,
                    }),
                  ],
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: false,
                }),
              ],
            }),
          ],
        });
      });

      it("creates 3d model nodes child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "test partition", partitionParentId: IModel.rootSubjectId });
          return { rootSubject, dictionaryModel, physicalModel };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: false,
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.physicalModel],
                  supportsFiltering: true,
                  children: false,
                }),
              ],
            }),
          ],
        });
      });
    });

    describe("2d models' children", () => {
      it("creates drawing category child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const documentModel = insertModelWithPartition({
            builder,
            modelClassFullName: "BisCore.DocumentListModel",
            partitionClassFullName: "BisCore.DocumentPartition",
            partitionParentId: IModel.rootSubjectId,
            codeValue: "document model",
          });
          const drawingElement = insertDrawingElement({ builder, modelId: documentModel.id, codeValue: "test drawing" });
          const drawingModel = insertDrawingSubModel({
            builder,
            modeledElementId: drawingElement.id,
          });
          const drawingCategory = insertDrawingCategory({ builder, modelId: IModel.dictionaryId, codeValue: "drawing category" });
          const drawingGraphic = insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: drawingCategory.id });
          return { rootSubject, dictionaryModel, documentModel, drawingElement, drawingModel, drawingCategory, drawingGraphic };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.drawingCategory.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.drawingCategory],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: "BisCore.SubCategory",
                              children: [
                                NodeValidators.createForInstanceNode({
                                  label: "drawing category",
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
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.documentModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.drawingElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.drawingElement],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.drawingCategory],
                              supportsFiltering: true,
                              children: [
                                NodeValidators.createForClassGroupingNode({
                                  className: keys.drawingGraphic.className,
                                  children: [
                                    NodeValidators.createForInstanceNode({
                                      instanceKeys: [keys.drawingGraphic],
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

      it("loads only categories with root elements", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const documentModel = insertModelWithPartition({
            builder,
            modelClassFullName: "BisCore.DocumentListModel",
            partitionClassFullName: "BisCore.DocumentPartition",
            partitionParentId: IModel.rootSubjectId,
            codeValue: "document model",
          });
          const drawingElement = insertDrawingElement({ builder, modelId: documentModel.id, codeValue: "test drawing" });
          const drawingModel = insertDrawingSubModel({
            builder,
            modeledElementId: drawingElement.id,
          });
          const drawingCategory1 = insertDrawingCategory({ builder, modelId: IModel.dictionaryId, codeValue: "drawing category 1" });
          const drawingCategory2 = insertDrawingCategory({ builder, modelId: IModel.dictionaryId, codeValue: "drawing category 2" });
          const parentDrawingGraphic = insertDrawingGraphic({ builder, modelId: drawingModel.id, categoryId: drawingCategory1.id });
          const childDrawingGraphic = insertDrawingGraphic({
            builder,
            modelId: drawingModel.id,
            categoryId: drawingCategory2.id,
            parentId: parentDrawingGraphic.id,
          });
          return {
            rootSubject,
            dictionaryModel,
            documentModel,
            drawingElement,
            drawingModel,
            drawingCategory1,
            drawingCategory2,
            parentDrawingGraphic,
            childDrawingGraphic,
          };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.drawingCategory1.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.drawingCategory1],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: "BisCore.SubCategory",
                              children: [
                                NodeValidators.createForInstanceNode({
                                  label: "drawing category 1",
                                  children: false,
                                }),
                              ],
                            }),
                          ],
                        }),
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.drawingCategory2],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: "BisCore.SubCategory",
                              children: [
                                NodeValidators.createForInstanceNode({
                                  label: "drawing category 2",
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
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.documentModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.drawingElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.drawingElement],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.drawingCategory1],
                              supportsFiltering: true,
                              children: [
                                NodeValidators.createForClassGroupingNode({
                                  className: keys.parentDrawingGraphic.className,
                                  children: [
                                    NodeValidators.createForInstanceNode({
                                      instanceKeys: [keys.parentDrawingGraphic],
                                      supportsFiltering: true,
                                      children: [
                                        NodeValidators.createForClassGroupingNode({
                                          className: keys.childDrawingGraphic.className,
                                          children: [
                                            NodeValidators.createForInstanceNode({
                                              instanceKeys: [keys.childDrawingGraphic],
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
    });

    describe("3d models' children", () => {
      it("creates spatial category child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "physical model" });
          const category = insertSpatialCategory({ builder, codeValue: "test category" });
          const element = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          return { rootSubject, dictionaryModel, physicalModel, category, element };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.category.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.category],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: "BisCore.SubCategory",
                              children: [
                                NodeValidators.createForInstanceNode({
                                  label: "test category",
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
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.physicalModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.category],
                      supportsFiltering: true,
                      children: [
                        NodeValidators.createForClassGroupingNode({
                          className: keys.element.className,
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.element],
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
        });
      });

      it("loads only categories with root elements", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "physical model" });
          const category1 = insertSpatialCategory({ builder, codeValue: "test category 1" });
          const category2 = insertSpatialCategory({ builder, codeValue: "test category 2" });
          const parentElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category1.id });
          const childElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category2.id, parentId: parentElement.id });
          return { rootSubject, dictionaryModel, physicalModel, category1, category2, parentElement, childElement };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.category1.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.category1],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: "BisCore.SubCategory",
                              children: [
                                NodeValidators.createForInstanceNode({
                                  label: "test category 1",
                                  children: false,
                                }),
                              ],
                            }),
                          ],
                        }),
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.category2],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: "BisCore.SubCategory",
                              children: [
                                NodeValidators.createForInstanceNode({
                                  label: "test category 2",
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
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.physicalModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.category1],
                      supportsFiltering: true,
                      children: [
                        NodeValidators.createForClassGroupingNode({
                          className: keys.parentElement.className,
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.parentElement],
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
    });

    describe("non-geometric models' children", () => {
      it("creates element child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const documentModel = insertModelWithPartition({
            builder,
            partitionClassFullName: "BisCore.DocumentPartition",
            modelClassFullName: "BisCore.DocumentListModel",
            codeValue: "test partition",
          });
          const drawingElement = insertDrawingElement({ builder, modelId: documentModel.id, codeValue: "test document" });
          return { rootSubject, dictionaryModel, documentModel, drawingElement };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: false,
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.documentModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.drawingElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.drawingElement],
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

    describe("groups' children", () => {
      it("creates childless node when group has no child or grouped elements", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const groupModel = insertGroupInformationModelWithPartition({ builder, codeValue: "test partition" });
          const groupElement = insertGroupInformationElement({ builder, modelId: groupModel.id, codeValue: "test group" });
          return { rootSubject, dictionaryModel, groupModel, groupElement };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: false,
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.groupModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.groupElement.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.groupElement],
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
        });
      });

      it("creates child elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const groupModel = insertGroupInformationModelWithPartition({ builder, codeValue: "test partition" });
          const parentGroup = insertGroupInformationElement({ builder, modelId: groupModel.id, codeValue: "parent group" });
          const childGroup = insertGroupInformationElement({ builder, modelId: groupModel.id, parentId: parentGroup.id, codeValue: "child group" });
          return { rootSubject, dictionaryModel, groupModel, parentGroup, childGroup };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: false,
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.groupModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.parentGroup.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.parentGroup],
                          supportsFiltering: false,
                          children: [
                            NodeValidators.createForGenericNode({
                              label: "Children",
                              supportsFiltering: true,
                              children: [
                                NodeValidators.createForClassGroupingNode({
                                  className: keys.childGroup.className,
                                  children: [
                                    NodeValidators.createForInstanceNode({
                                      instanceKeys: [keys.childGroup],
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
            }),
          ],
        });
      });

      it("creates grouped elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const groupModel = insertGroupInformationModelWithPartition({ builder, codeValue: "group partition" });
          const group = insertGroupInformationElement({ builder, modelId: groupModel.id, codeValue: "group" });
          const documentModel = insertModelWithPartition({
            builder,
            modelClassFullName: "BisCore.DocumentListModel",
            partitionClassFullName: "BisCore.DocumentPartition",
            codeValue: "document partition",
          });
          const document = insertDrawingElement({ builder, modelId: documentModel.id, codeValue: "test document" });
          builder.insertRelationship({
            classFullName: "BisCore.ElementGroupsMembers",
            sourceId: group.id,
            targetId: document.id,
          });
          return { rootSubject, dictionaryModel, groupModel, group, documentModel, document };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: false,
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.documentModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.document.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.document],
                          supportsFiltering: true,
                          children: false,
                        }),
                      ],
                    }),
                  ],
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.groupModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.group.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.group],
                          supportsFiltering: false,
                          children: [
                            NodeValidators.createForGenericNode({
                              label: "Members",
                              supportsFiltering: true,
                              children: [
                                NodeValidators.createForClassGroupingNode({
                                  className: keys.document.className,
                                  children: [
                                    NodeValidators.createForInstanceNode({
                                      instanceKeys: [keys.document],
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
    });

    describe("elements' children", () => {
      it("creates childless node when element has no child or modeling elements", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder, testSchema) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "test partition" });
          const category = insertSpatialCategory({ builder, codeValue: "test category" });
          const physicalElement = insertPhysicalElement({
            builder,
            classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            modelId: physicalModel.id,
            categoryId: category.id,
          });
          const subModel = insertPhysicalSubModel({ builder, modeledElementId: physicalElement.id });
          return { rootSubject, dictionaryModel, physicalModel, category, physicalElement, subModel };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.category.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.category],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: "BisCore.SubCategory",
                              children: [
                                NodeValidators.createForInstanceNode({
                                  label: "test category",
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
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.physicalModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.category],
                      supportsFiltering: true,
                      children: [
                        NodeValidators.createForClassGroupingNode({
                          className: keys.physicalElement.className,
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.physicalElement],
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
        });
      });

      it("creates child elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "test partition" });
          const category = insertSpatialCategory({ builder, codeValue: "test category" });
          const parentElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          const childElement = insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id, parentId: parentElement.id });
          return { rootSubject, dictionaryModel, physicalModel, category, parentElement, childElement };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.category.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.category],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: "BisCore.SubCategory",
                              children: [
                                NodeValidators.createForInstanceNode({
                                  label: "test category",
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
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.physicalModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForInstanceNode({
                      instanceKeys: [keys.category],
                      supportsFiltering: true,
                      children: [
                        NodeValidators.createForClassGroupingNode({
                          className: keys.parentElement.className,
                          children: [
                            NodeValidators.createForInstanceNode({
                              instanceKeys: [keys.parentElement],
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

      it("creates modeling elements as child nodes", async function () {
        // eslint-disable-next-line deprecation/deprecation
        const { imodel, ...keys } = await buildIModel(this, async (builder) => {
          const documentModel = insertModelWithPartition({
            builder,
            modelClassFullName: "BisCore.DocumentListModel",
            partitionClassFullName: "BisCore.DocumentPartition",
            codeValue: "test partition",
          });
          const parentDocument = insertDrawingElement({ builder, modelId: documentModel.id, codeValue: "parent document" });
          const childModel = insertSubModel({ builder, classFullName: "BisCore.DocumentListModel", modeledElementId: parentDocument.id });
          const childDocument = insertDrawingElement({ builder, modelId: childModel.id, codeValue: "child document" });
          return { rootSubject, dictionaryModel, documentModel, parentDocument, childModel, childDocument };
        });
        await validateHierarchy({
          provider: createIModelContentTreeProvider(imodel),
          expect: [
            NodeValidators.createForInstanceNode({
              instanceKeys: [keys.rootSubject],
              autoExpand: true,
              supportsFiltering: true,
              children: [
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.dictionaryModel],
                  supportsFiltering: true,
                  children: false,
                }),
                NodeValidators.createForInstanceNode({
                  instanceKeys: [keys.documentModel],
                  supportsFiltering: true,
                  children: [
                    NodeValidators.createForClassGroupingNode({
                      className: keys.parentDocument.className,
                      children: [
                        NodeValidators.createForInstanceNode({
                          instanceKeys: [keys.parentDocument],
                          supportsFiltering: true,
                          children: [
                            NodeValidators.createForClassGroupingNode({
                              className: keys.childDocument.className,
                              children: [
                                NodeValidators.createForInstanceNode({
                                  instanceKeys: [keys.childDocument],
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
    });
  });
});

function createIModelContentTreeProvider(imodel: IModelConnection) {
  const imodelAccess = createIModelAccess(imodel);
  return createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new IModelContentTreeDefinition({
      imodelAccess,
      idsCache: new IModelContentTreeIdsCache(imodelAccess),
    }),
  });
}

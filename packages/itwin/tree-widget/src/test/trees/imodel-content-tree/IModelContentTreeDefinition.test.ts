/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  HierarchyCacheMode,
  initializeCore,
  insertDrawingCategory,
  insertDrawingElement,
  insertDrawingGraphic,
  insertDrawingSubModel,
  insertGroupInformationElement,
  insertGroupInformationModelWithPartition,
  insertModelWithPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  insertSubject,
  insertSubModel,
  terminateCore,
} from "test-utilities";
import { IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { IModelContentTreeDefinition } from "../../../tree-widget-react/components/trees/imodel-content-tree/IModelContentTreeDefinition.js";
import { IModelContentTreeIdsCache } from "../../../tree-widget-react/components/trees/imodel-content-tree/internal/IModelContentTreeIdsCache.js";
import { buildIModel } from "../../IModelUtils.js";
import { createIModelAccess } from "../Common.js";
import { NodeValidators, validateHierarchy } from "../HierarchyValidation.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
import type { IModelContentTreeHierarchyConfiguration } from "../../../tree-widget-react/components/trees/imodel-content-tree/IModelContentTreeDefinition.js";

describe("iModel content tree", () => {
  describe("Hierarchy definition", () => {
    const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
    const dictionaryModel: InstanceKey = { className: "BisCore.DictionaryModel", id: IModel.dictionaryId };

    before(async function () {
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

    after(async function () {
      await terminateCore();
    });

    describe("subjects' children", () => {
      it("creates subjects hierarchy with root subject", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const subjectA = insertSubject({ imodel, codeValue: "A", parentId: IModel.rootSubjectId });
          const subjectB = insertSubject({ imodel, codeValue: "B", parentId: IModel.rootSubjectId });
          const subjectC = insertSubject({ imodel, codeValue: "C", parentId: subjectB.id });
          return { rootSubject, dictionaryModel, subjectA, subjectB, subjectC };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection, { hideRootSubject: false });
        await validateHierarchy({
          provider,
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

      it("creates subjects hierarchy without root subject", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const subjectA = insertSubject({ imodel, codeValue: "A", parentId: IModel.rootSubjectId });
          const subjectB = insertSubject({ imodel, codeValue: "B", parentId: IModel.rootSubjectId });
          const subjectC = insertSubject({ imodel, codeValue: "C", parentId: subjectB.id });
          return { rootSubject, dictionaryModel, subjectA, subjectB, subjectC };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });

      it("creates 3d model nodes child nodes", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "test partition", partitionParentId: IModel.rootSubjectId });
          return { rootSubject, dictionaryModel, physicalModel };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });
    });

    describe("2d models' children", () => {
      it("creates drawing category child nodes", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const documentModel = insertModelWithPartition({
            imodel,
            modelClassFullName: "BisCore.DocumentListModel",
            partitionClassFullName: "BisCore.DocumentPartition",
            partitionParentId: IModel.rootSubjectId,
            codeValue: "document model",
          });
          const drawingElement = insertDrawingElement({ imodel, modelId: documentModel.id, codeValue: "test drawing" });
          const drawingModel = insertDrawingSubModel({
            imodel,
            modeledElementId: drawingElement.id,
          });
          const drawingCategory = insertDrawingCategory({ imodel, modelId: IModel.dictionaryId, codeValue: "drawing category" });
          const drawingGraphic = insertDrawingGraphic({ imodel, modelId: drawingModel.id, categoryId: drawingCategory.id });
          return { rootSubject, dictionaryModel, documentModel, drawingElement, drawingModel, drawingCategory, drawingGraphic };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });

      it("loads only categories with root elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const documentModel = insertModelWithPartition({
            imodel,
            modelClassFullName: "BisCore.DocumentListModel",
            partitionClassFullName: "BisCore.DocumentPartition",
            partitionParentId: IModel.rootSubjectId,
            codeValue: "document model",
          });
          const drawingElement = insertDrawingElement({ imodel, modelId: documentModel.id, codeValue: "test drawing" });
          const drawingModel = insertDrawingSubModel({
            imodel,
            modeledElementId: drawingElement.id,
          });
          const drawingCategory1 = insertDrawingCategory({ imodel, modelId: IModel.dictionaryId, codeValue: "drawing category 1" });
          const drawingCategory2 = insertDrawingCategory({ imodel, modelId: IModel.dictionaryId, codeValue: "drawing category 2" });
          const parentDrawingGraphic = insertDrawingGraphic({ imodel, modelId: drawingModel.id, categoryId: drawingCategory1.id });
          const childDrawingGraphic = insertDrawingGraphic({
            imodel,
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
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });
    });

    describe("3d models' children", () => {
      it("creates spatial category child nodes", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "physical model" });
          const category = insertSpatialCategory({ imodel, codeValue: "test category" });
          const element = insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
          return { rootSubject, dictionaryModel, physicalModel, category, element };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });

      it("loads only categories with root elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "physical model" });
          const category1 = insertSpatialCategory({ imodel, codeValue: "test category 1" });
          const category2 = insertSpatialCategory({ imodel, codeValue: "test category 2" });
          const parentElement = insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category1.id });
          const childElement = insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category2.id, parentId: parentElement.id });
          return { rootSubject, dictionaryModel, physicalModel, category1, category2, parentElement, childElement };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });
    });

    describe("non-geometric models' children", () => {
      it("creates element child nodes", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const documentModel = insertModelWithPartition({
            imodel,
            partitionClassFullName: "BisCore.DocumentPartition",
            modelClassFullName: "BisCore.DocumentListModel",
            codeValue: "test partition",
          });
          const drawingElement = insertDrawingElement({ imodel, modelId: documentModel.id, codeValue: "test document" });
          return { rootSubject, dictionaryModel, documentModel, drawingElement };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });
    });

    describe("groups' children", () => {
      it("creates childless node when group has no child or grouped elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const groupModel = insertGroupInformationModelWithPartition({ imodel, codeValue: "test partition" });
          const groupElement = insertGroupInformationElement({ imodel, modelId: groupModel.id, codeValue: "test group" });
          return { rootSubject, dictionaryModel, groupModel, groupElement };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });

      it("creates child elements as child nodes", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const groupModel = insertGroupInformationModelWithPartition({ imodel, codeValue: "test partition" });
          const parentGroup = insertGroupInformationElement({ imodel, modelId: groupModel.id, codeValue: "parent group" });
          const childGroup = insertGroupInformationElement({ imodel, modelId: groupModel.id, parentId: parentGroup.id, codeValue: "child group" });
          return { rootSubject, dictionaryModel, groupModel, parentGroup, childGroup };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });

      it("creates grouped elements as child nodes", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const groupModel = insertGroupInformationModelWithPartition({ imodel, codeValue: "group partition" });
          const group = insertGroupInformationElement({ imodel, modelId: groupModel.id, codeValue: "group" });
          const documentModel = insertModelWithPartition({
            imodel,
            modelClassFullName: "BisCore.DocumentListModel",
            partitionClassFullName: "BisCore.DocumentPartition",
            codeValue: "document partition",
          });
          const document = insertDrawingElement({ imodel, modelId: documentModel.id, codeValue: "test document" });
          imodel.relationships.insertInstance({
            classFullName: "BisCore.ElementGroupsMembers",
            sourceId: group.id,
            targetId: document.id,
          });
          return { rootSubject, dictionaryModel, groupModel, group, documentModel, document };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });
    });

    describe("elements' children", () => {
      it("creates childless node when element has no child or modeling elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel, testSchema) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "test partition" });
          const category = insertSpatialCategory({ imodel, codeValue: "test category" });
          const physicalElement = insertPhysicalElement({
            imodel,
            classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            modelId: physicalModel.id,
            categoryId: category.id,
          });
          const subModel = insertPhysicalSubModel({ imodel, modeledElementId: physicalElement.id });
          return { rootSubject, dictionaryModel, physicalModel, category, physicalElement, subModel };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });

      it("creates child elements as child nodes", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const physicalModel = insertPhysicalModelWithPartition({ imodel, codeValue: "test partition" });
          const category = insertSpatialCategory({ imodel, codeValue: "test category" });
          const parentElement = insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id });
          const childElement = insertPhysicalElement({ imodel, modelId: physicalModel.id, categoryId: category.id, parentId: parentElement.id });
          return { rootSubject, dictionaryModel, physicalModel, category, parentElement, childElement };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });

      it("creates modeling elements as child nodes", async function () {
        await using buildIModelResult = await buildIModel(this, async (imodel) => {
          const documentModel = insertModelWithPartition({
            imodel,
            modelClassFullName: "BisCore.DocumentListModel",
            partitionClassFullName: "BisCore.DocumentPartition",
            codeValue: "test partition",
          });
          const parentDocument = insertDrawingElement({ imodel, modelId: documentModel.id, codeValue: "parent document" });
          const childModel = insertSubModel({ imodel, classFullName: "BisCore.DocumentListModel", modeledElementId: parentDocument.id });
          const childDocument = insertDrawingElement({ imodel, modelId: childModel.id, codeValue: "child document" });
          return { rootSubject, dictionaryModel, documentModel, parentDocument, childModel, childDocument };
        });
        const { imodelConnection, ...keys } = buildIModelResult;
        using provider = createIModelContentTreeProvider(imodelConnection);
        await validateHierarchy({
          provider,
          expect: [
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
        });
      });
    });
  });
});

function createIModelContentTreeProvider(imodel: IModelConnection, config?: Partial<IModelContentTreeHierarchyConfiguration>) {
  const imodelAccess = createIModelAccess(imodel);
  return createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new IModelContentTreeDefinition({
      imodelAccess,
      idsCache: new IModelContentTreeIdsCache(imodelAccess),
      hierarchyConfig: { hideRootSubject: true, ...config },
    }),
  });
}

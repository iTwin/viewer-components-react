/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import sinon from "sinon";
import { CompressedId64Set, Id64 } from "@itwin/core-bentley";
import { Code, ColorDef, IModel, IModelReadRpcInterface, RenderMode } from "@itwin/core-common";
import { IModelApp, NoRenderApp, OffScreenViewport, PerModelCategoryVisibility, SpatialViewState, ViewRect } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createIModelHierarchyProvider, createLimitingECSqlQueryExecutor, HierarchyNode } from "@itwin/presentation-hierarchies";
import { InstanceKey } from "@itwin/presentation-shared";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { createVisibilityStatus } from "../../../../tree-widget-react/components/trees/common/Tooltip.js";
import {
  CATEGORY_CLASS_NAME,
  ELEMENT_CLASS_NAME,
  MODEL_CLASS_NAME,
  SUBJECT_CLASS_NAME,
} from "../../../../tree-widget-react/components/trees/models-tree/internal/FilteredTree.js";
import { ModelsTreeIdsCache } from "../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { createModelsTreeVisibilityHandler } from "../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeVisibilityHandler.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import {
  buildIModel,
  importSchema,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  insertSubject,
} from "../../../IModelUtils.js";
import { TestUtils } from "../../../TestUtils.js";
import { createFakeSinonViewport, createIModelAccess } from "../../Common.js";
import {
  createCategoryHierarchyNode,
  createClassGroupingHierarchyNode,
  createElementHierarchyNode,
  createFakeIdsCache,
  createModelHierarchyNode,
  createSubjectHierarchyNode,
} from "../Utils.js";
import { validateHierarchyVisibility, VisibilityExpectations } from "./VisibilityValidation.js";

import type { Id64String } from "@itwin/core-bentley";
import type { GeometricElement3dProps, QueryBinder } from "@itwin/core-common";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { GroupingHierarchyNode, HierarchyNodeIdentifiersPath, HierarchyProvider, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { Visibility } from "../../../../tree-widget-react/components/trees/common/Tooltip.js";
import type { HierarchyVisibilityHandler } from "../../../../tree-widget-react/components/trees/common/UseHierarchyVisibility.js";
import type { ModelsTreeVisibilityHandlerProps } from "../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeVisibilityHandler.js";
import type { ValidateNodeProps } from "./VisibilityValidation.js";

interface VisibilityOverrides {
  models?: Map<Id64String, Visibility>;
  categories?: Map<Id64String, Visibility>;
  elements?: Map<Id64String, Visibility>;
}

type ModelsTreeHierarchyConfiguration = Partial<ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"]>;

describe("ModelsTreeVisibilityHandler", () => {
  function createIdsCache(iModel: IModelConnection, hierarchyConfig?: ModelsTreeHierarchyConfiguration) {
    return new ModelsTreeIdsCache(createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(iModel), "unbounded"), {
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    });
  }

  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  describe("#unit", () => {
    let createdHandlers = new Array<HierarchyVisibilityHandler>();

    after(() => {
      sinon.restore();
    });

    afterEach(() => {
      createdHandlers.forEach((x) => x.dispose());
      createdHandlers = [];
    });

    function createFakeIModelAccess(): ModelsTreeVisibilityHandlerProps["imodelAccess"] {
      return {
        classDerivesFrom: sinon.fake.returns(false),
      };
    }

    function createHandler(props?: { overrides?: VisibilityOverrides; idsCache?: ModelsTreeIdsCache; viewport?: Viewport }) {
      const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
        getModelDisplayStatus:
          props?.overrides?.models &&
          (async ({ ids, originalImplementation }) => {
            let visibility: Visibility | "unknown" = "unknown";
            for (const modelId of Id64.iterable(ids)) {
              const res = props.overrides!.models!.get(modelId);
              if (!res) {
                continue;
              }
              if (visibility !== "unknown" && res !== visibility) {
                return createVisibilityStatus("partial");
              }
              visibility = res;
            }
            return visibility !== "unknown" ? createVisibilityStatus(visibility) : originalImplementation();
          }),
        getCategoryDisplayStatus:
          props?.overrides?.categories &&
          (async ({ categoryIds, originalImplementation }) => {
            let visibility: Visibility | "unknown" = "unknown";
            for (const id of Id64.iterable(categoryIds)) {
              const res = props.overrides!.categories!.get(id);
              if (!res) {
                continue;
              }
              if (visibility !== "unknown" && res !== visibility) {
                return createVisibilityStatus("partial");
              }
              visibility = res;
            }
            return visibility !== "unknown" ? createVisibilityStatus(visibility) : originalImplementation();
          }),
        getElementDisplayStatus:
          props?.overrides?.elements &&
          (async ({ elementId, originalImplementation }) => {
            const res = props.overrides!.elements!.get(elementId);
            return res ? createVisibilityStatus(res) : originalImplementation();
          }),
        changeCategoryState: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
        changeModelState: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
        changeElementsState: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
      };
      const handler = createModelsTreeVisibilityHandler({
        viewport: props?.viewport ?? createFakeSinonViewport(),
        overrides,
        idsCache: props?.idsCache ?? createFakeIdsCache(),
        imodelAccess: createFakeIModelAccess(),
      });
      return {
        handler,
        overrides,
        [Symbol.dispose]() {
          handler[Symbol.dispose]();
        },
      };
    }

    describe("overridden methods", () => {
      it("can call original implementation", async () => {
        let useOriginalImplFlag = false;
        const viewport = createFakeSinonViewport();
        using idsCache = createIdsCache(viewport.iModel);
        using handler = createModelsTreeVisibilityHandler({
          viewport,
          idsCache,
          overrides: {
            getElementDisplayStatus: async ({ originalImplementation }) => {
              return useOriginalImplFlag ? originalImplementation() : createVisibilityStatus("hidden");
            },
          },
          imodelAccess: createFakeIModelAccess(),
        });

        const node = createElementHierarchyNode({
          modelId: "0x1",
          categoryId: "0x2",
          elementId: "0x3",
          parentKeys: [
            { type: "instances", instanceKeys: [{ id: "0x11", className: SUBJECT_CLASS_NAME }] },
            { type: "instances", instanceKeys: [{ id: "0x1", className: MODEL_CLASS_NAME }] },
            { type: "instances", instanceKeys: [{ id: "0x2", className: CATEGORY_CLASS_NAME }] },
            { type: "class-grouping", className: ELEMENT_CLASS_NAME },
          ],
        });
        await expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "hidden" });

        useOriginalImplFlag = true;
        await expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "visible" });
      });
    });

    describe("getVisibilityStatus", () => {
      describe("subject", () => {
        it("can be overridden", async () => {
          const overrides = {
            getSubjectNodeVisibility: sinon.fake.resolves(createVisibilityStatus("visible")),
          };
          const viewport = createFakeSinonViewport();
          using idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          const status = await handler.getVisibilityStatus(createSubjectHierarchyNode());
          expect(status.state).to.eq("visible");
          expect(overrides.getSubjectNodeVisibility).to.be.called;
        });

        it("returns disabled when active view is not spatial", async () => {
          const node = createSubjectHierarchyNode();
          const viewport = createFakeSinonViewport({
            view: {
              isSpatialView: sinon.fake.returns(false),
            },
          });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(viewport.view.isSpatialView).to.be.called;
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });

        it("is visible when subject contains no models", async () => {
          const subjectIds = ["0x1", "0x2"];
          const node = createSubjectHierarchyNode({ ids: subjectIds });
          const idsCache = createFakeIdsCache({
            subjectsHierarchy: new Map([["0x0", subjectIds]]),
          });
          using handlerResult = createHandler({ idsCache });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible when all models are displayed", async () => {
          const subjectIds = ["0x1", "0x2"];
          const node = createSubjectHierarchyNode({ ids: subjectIds });
          const idsCache = createFakeIdsCache({
            subjectsHierarchy: new Map([["0x0", subjectIds]]),
            subjectModels: new Map([
              [subjectIds[0], ["0x3"]],
              [subjectIds[1], ["0x4"]],
            ]),
          });
          using handlerResult = createHandler({
            idsCache,
            overrides: {
              models: new Map([
                ["0x3", "visible"],
                ["0x4", "visible"],
              ]),
            },
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden when all models are hidden", async () => {
          const subjectIds = ["0x1", "0x2"];
          const node = createSubjectHierarchyNode({ ids: subjectIds });
          const idsCache = createFakeIdsCache({
            subjectsHierarchy: new Map([["0x0", subjectIds]]),
            subjectModels: new Map([
              [subjectIds[0], ["0x3"]],
              [subjectIds[1], ["0x4"]],
            ]),
          });
          using handlerResult = createHandler({
            idsCache,
            overrides: {
              models: new Map([
                ["0x3", "hidden"],
                ["0x4", "hidden"],
              ]),
            },
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is partially visible when at least one model is displayed and at least one model is hidden", async () => {
          const subjectIds = ["0x1", "0x2"];
          const node = createSubjectHierarchyNode({ ids: subjectIds });
          const idsCache = createFakeIdsCache({
            subjectsHierarchy: new Map([["0x0", subjectIds]]),
            subjectModels: new Map([
              [subjectIds[0], ["0x3"]],
              [subjectIds[1], ["0x4"]],
            ]),
          });
          using handlerResult = createHandler({
            idsCache,
            overrides: {
              models: new Map([
                ["0x3", "visible"],
                ["0x4", "hidden"],
              ]),
            },
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });
      });

      describe("model", () => {
        it("is disabled when active view is not spatial", async () => {
          const node = createModelHierarchyNode();
          const viewport = createFakeSinonViewport({
            view: {
              isSpatialView: sinon.fake.returns(false),
            },
          });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(viewport.view.isSpatialView).to.be.called;
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });

        describe("visible", () => {
          it("when enabled and has no categories", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            using handlerResult = createHandler();
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });

          it("when enabled and all categories are displayed", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode({ modelId });
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
            });
            using handlerResult = createHandler({ idsCache });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });

          it("when all elements are in the exclusive always drawn list", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode({ modelId });
            const modelCategories = new Map([[modelId, categories]]);
            const categoryElements = new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]);
            const idsCache = createFakeIdsCache({
              modelCategories,
              categoryElements,
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                isAlwaysDrawnExclusive: true,
                alwaysDrawn: new Set([...categoryElements.values()].flat()),
                queryHandler: () =>
                  [...categoryElements].flatMap(([categoryId, elements]) => {
                    return elements.map((elementId) => ({ rootCategoryId: categoryId, categoryId, modelId, elementsPath: elementId }));
                  }),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });

          it("when always drawn list is empty", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode({ modelId });
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set(),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });

          it("when all categories are displayed and always/never drawn lists contain no elements", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode({ modelId });
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set(["0xfff"]),
                neverDrawn: new Set(["0xeee"]),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });
        });

        describe("hidden", () => {
          it("when `viewport.view.viewsModel` returns false", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            using handlerResult = createHandler({
              viewport: createFakeSinonViewport({
                view: {
                  viewsModel: sinon.fake.returns(false),
                },
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("all categories are hidden", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode({ modelId });
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                view: {
                  viewsCategory: sinon.fake.returns(false),
                },
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when all elements are in never drawn list", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            const modelCategories = new Map([[modelId, ["0x10", "0x20"]]]);
            const categoryElements = new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]);
            const idsCache = createFakeIdsCache({
              modelCategories,
              categoryElements,
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                neverDrawn: new Set([...categoryElements.values()].flat()),
                queryHandler: () =>
                  [...categoryElements].flatMap(([categoryId, elements]) => {
                    return elements.map((elementId) => ({ rootCategoryId: categoryId, categoryId, modelId, elementsPath: elementId }));
                  }),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when none of the elements are in exclusive always drawn list", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            const modelCategories = new Map([[modelId, ["0x10", "0x20"]]]);
            const categoryElements = new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]);
            const idsCache = createFakeIdsCache({
              modelCategories,
              categoryElements,
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set(["0xffff"]),
                isAlwaysDrawnExclusive: true,
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when in exclusive always drawn list is empty", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            const modelCategories = new Map([[modelId, ["0x10", "0x20"]]]);
            const categoryElements = new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]);
            const idsCache = createFakeIdsCache({
              modelCategories,
              categoryElements,
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                isAlwaysDrawnExclusive: true,
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when all categories are hidden and always/never drawn lists contain no children", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode({ modelId });
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                view: { viewsCategory: sinon.fake.returns(false) },
                alwaysDrawn: new Set(["0xfff"]),
                neverDrawn: new Set(["0xeee"]),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });
        });

        describe("partially visible", () => {
          it("when at least one category is hidden", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode({ modelId });
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                view: {
                  viewsCategory: sinon.fake((id) => id === categories[0]),
                },
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when some of the elements are in never drawn list", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                neverDrawn: new Set(["0x100"]),
                queryHandler: () => [{ rootCategoryId: "0x10", elementsPath: "0x100", modelId, categoryId: "0x10" }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when some of the elements are not in the exclusive always drawn list", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                isAlwaysDrawnExclusive: true,
                alwaysDrawn: new Set(["0x100"]),
                queryHandler: () => [{ rootCategoryId: "0x10", elementsPath: "0x100", modelId, categoryId: "0x10" }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when some categories are visible, some hidden and always/never drawn lists contain no children", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode({ modelId });
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            using handlerResult = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                view: { viewsCategory: sinon.fake((id) => id === categories[0]) },
                alwaysDrawn: new Set(["0xfff"]),
                neverDrawn: new Set(["0xeee"]),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });
        });
      });

      describe("category", () => {
        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            getCategoryDisplayStatus: sinon.fake.resolves(createVisibilityStatus("visible")),
          };
          const viewport = createFakeSinonViewport();
          using idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          const status = await handler.getVisibilityStatus(createCategoryHierarchyNode({ modelId: "0x1" }));
          expect(overrides.getCategoryDisplayStatus).to.be.called;
          expect(status.state).to.eq("visible");
        });

        describe("is visible", () => {
          it("when `viewport.view.viewsCategory` returns TRUE and there are NO elements in the NEVER drawn list", async () => {
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId: "0x1", categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                view: {
                  viewsCategory: sinon.fake.returns(true),
                },
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });

          it("when there's a per model category override to SHOW and there are NO elements in the NEVER drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                perModelCategoryVisibility: {
                  getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Show),
                },
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });
        });

        describe("is hidden", () => {
          it("when model is hidden", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                view: {
                  viewsModel: sinon.fake.returns(false),
                },
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("`viewport.view.viewsCategory` returns FALSE and there ARE NO elements in the ALWAYS drawn list", async () => {
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId: "0x1", categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                view: {
                  viewsCategory: sinon.fake.returns(false),
                },
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when `viewport.view.viewsCategory` returns TRUE and there ARE UNRELATED elements in the EXCLUSIVE ALWAYS drawn list", async () => {
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId: "0x1", categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set(["0x4"]),
                isAlwaysDrawnExclusive: true,
                view: {
                  viewsCategory: sinon.fake.returns(true),
                },
                queryHandler: () => [{ rootCategoryId: "0xff", elementsPath: "0x4", modelId: "0xff", categoryId: "0xff" }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when `viewport.view.viewsCategory` returns TRUE and ALL elements are in the NEVER drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                neverDrawn: new Set(elements),
                view: {
                  viewsCategory: sinon.fake.returns(true),
                },
                queryHandler: () => elements.map((elementId) => ({ rootCategoryId: categoryId, elementsPath: elementId, modelId, categoryId })),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when there's a per model category override to HIDE and there ARE NO elements in the ALWAYS drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                perModelCategoryVisibility: {
                  getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Hide),
                },
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when there's a per model category override to SHOW and there ARE UNRELATED elements in the EXCLUSIVE ALWAYS drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set(["0x4"]),
                isAlwaysDrawnExclusive: true,
                perModelCategoryVisibility: {
                  getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Show),
                },
                queryHandler: () => [{ rootCategoryId: "0xff", elementsPath: "0x4", modelId: "0xff", categoryId: "0xff" }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });
        });

        describe("is partially visible", () => {
          it("when `viewport.view.viewsCategory` returns TRUE and there ARE SOME elements in the NEVER drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                neverDrawn: new Set([elements[0]]),
                view: {
                  viewsCategory: sinon.fake.returns(true),
                },
                queryHandler: () => [{ elementsPath: elements[0], modelId, rootCategoryId: categoryId, categoryId }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when `viewport.view.viewsCategory` returns FALSE and there ARE SOME elements in the ALWAYS drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set([elements[0]]),
                view: {
                  viewsCategory: sinon.fake.returns(false),
                },
                queryHandler: () => [{ rootCategoryId: categoryId, elementsPath: elements[0], modelId, categoryId }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when there's a per model category override to SHOW and there ARE SOME elements in the NEVER drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                neverDrawn: new Set([elements[0]]),
                perModelCategoryVisibility: {
                  getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Show),
                },
                queryHandler: () => [{ rootCategoryId: categoryId, elementsPath: elements[0], modelId, categoryId }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when there's a per model category override to HIDE and there ARE SOME elements in the ALWAYS drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set([elements[0]]),
                perModelCategoryVisibility: {
                  getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Hide),
                },
                queryHandler: () => [{ rootCategoryId: categoryId, elementsPath: elements[0], modelId, categoryId }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });
        });
      });

      describe("element", async () => {
        const modelId = "0x1";
        const categoryId = "0x2";
        const elementId = "0x3";

        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            getElementDisplayStatus: sinon.fake.resolves(createVisibilityStatus("visible")),
          };
          const viewport = createFakeSinonViewport();
          using idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          const status = await handler.getVisibilityStatus(
            createElementHierarchyNode({
              modelId: "0x1",
              categoryId: "0x2",
              elementId: "0x3",
              parentKeys: [
                { type: "instances", instanceKeys: [{ id: "0x11", className: SUBJECT_CLASS_NAME }] },
                { type: "instances", instanceKeys: [{ id: "0x1", className: MODEL_CLASS_NAME }] },
                { type: "instances", instanceKeys: [{ id: "0x2", className: CATEGORY_CLASS_NAME }] },
                { type: "class-grouping", className: ELEMENT_CLASS_NAME },
              ],
            }),
          );
          expect(overrides.getElementDisplayStatus).to.be.called;
          expect(status.state).to.eq("visible");
        });

        it("is hidden when model is hidden", async () => {
          const node = createElementHierarchyNode({
            modelId,
            categoryId,
            hasChildren: true,
            elementId,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x11", className: SUBJECT_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x1", className: MODEL_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x2", className: CATEGORY_CLASS_NAME }] },
              { type: "class-grouping", className: ELEMENT_CLASS_NAME },
            ],
          });
          const viewport = createFakeSinonViewport({
            view: {
              viewsModel: sinon.fake.returns(false),
            },
          });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is visible when model and category is displayed", async () => {
          const node = createElementHierarchyNode({
            modelId,
            categoryId,
            hasChildren: true,
            elementId,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x11", className: SUBJECT_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x1", className: MODEL_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x2", className: CATEGORY_CLASS_NAME }] },
              { type: "class-grouping", className: ELEMENT_CLASS_NAME },
            ],
          });
          const viewport = createFakeSinonViewport({
            view: {
              viewsModel: sinon.fake.returns(true),
              viewsCategory: sinon.fake.returns(true),
            },
          });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible if present in the always drawn list", async () => {
          const node = createElementHierarchyNode({
            modelId,
            categoryId,
            elementId,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x11", className: SUBJECT_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x1", className: MODEL_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x2", className: CATEGORY_CLASS_NAME }] },
              { type: "class-grouping", className: ELEMENT_CLASS_NAME },
            ],
          });
          using handlerResult = createHandler({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set([elementId]),
            }),
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden if present in the never drawn list", async () => {
          using handlerResult = createHandler({
            viewport: createFakeSinonViewport({
              neverDrawn: new Set([elementId]),
            }),
          });
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({
            modelId,
            categoryId,
            elementId,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x11", className: SUBJECT_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x1", className: MODEL_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x2", className: CATEGORY_CLASS_NAME }] },
              { type: "class-grouping", className: ELEMENT_CLASS_NAME },
            ],
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is hidden if other elements are present in the always drawn list and exclusive mode is enabled", async () => {
          using handlerResult = createHandler({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x20"]),
              isAlwaysDrawnExclusive: true,
            }),
          });
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({
            modelId,
            categoryId,
            elementId,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x11", className: SUBJECT_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x1", className: MODEL_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x2", className: CATEGORY_CLASS_NAME }] },
              { type: "class-grouping", className: ELEMENT_CLASS_NAME },
            ],
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is visible when not present in always/never drawn sets", async () => {
          using handlerResult = createHandler({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(),
              neverDrawn: new Set(),
            }),
          });
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({
            modelId,
            categoryId,
            elementId,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x11", className: SUBJECT_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x1", className: MODEL_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x2", className: CATEGORY_CLASS_NAME }] },
              { type: "class-grouping", className: ELEMENT_CLASS_NAME },
            ],
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible when always/never drawn sets are undefined", async () => {
          using handlerResult = createHandler();
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({
            modelId,
            categoryId,
            elementId,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x11", className: SUBJECT_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x1", className: MODEL_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: "0x2", className: CATEGORY_CLASS_NAME }] },
              { type: "class-grouping", className: ELEMENT_CLASS_NAME },
            ],
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible when always/never drawn sets doesn't contain it", async () => {
          using handlerResult = createHandler({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0xff"]),
              neverDrawn: new Set(["0xffff"]),
            }),
          });
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({
            modelId,
            categoryId,
            elementId,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x11", className: SUBJECT_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: modelId, className: MODEL_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: categoryId, className: CATEGORY_CLASS_NAME }] },
              { type: "class-grouping", className: ELEMENT_CLASS_NAME },
            ],
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden if category has per model override to hide", async () => {
          using handlerResult = createHandler({
            viewport: createFakeSinonViewport({
              perModelCategoryVisibility: {
                getOverride: () => PerModelCategoryVisibility.Override.Hide,
              },
            }),
          });
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({
            modelId,
            categoryId,
            elementId,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x11", className: SUBJECT_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: modelId, className: MODEL_CLASS_NAME }] },
              { type: "instances", instanceKeys: [{ id: categoryId, className: CATEGORY_CLASS_NAME }] },
              { type: "class-grouping", className: ELEMENT_CLASS_NAME },
            ],
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });
      });

      describe("grouping node", () => {
        const modelId = "0x1";
        const categoryId = "0x2";

        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            getElementGroupingNodeDisplayStatus: sinon.fake.resolves(createVisibilityStatus("visible")),
          };
          const viewport = createFakeSinonViewport();
          using idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          const status = await handler.getVisibilityStatus(
            createClassGroupingHierarchyNode({
              modelId,
              categoryId,
              elements: [],
            }),
          );
          expect(status.state).to.eq("visible");
          expect(overrides.getElementGroupingNodeDisplayStatus).to.be.called;
        });

        it("is visible if all node elements are visible", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x1", className: "BisCore.Subject" }] },
              { type: "instances", instanceKeys: [{ id: modelId, className: "BisCore.GeometricModel3d" }] },
              { type: "instances", instanceKeys: [{ id: categoryId, className: "BisCore.SpatialCategory" }] },
            ],
          });
          using handlerResult = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
            overrides: {
              elements: new Map(elementIds.map((x) => [x, "visible"])),
            },
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden if all node elements are hidden", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x1", className: "BisCore.Subject" }] },
              { type: "instances", instanceKeys: [{ id: modelId, className: "BisCore.GeometricModel3d" }] },
              { type: "instances", instanceKeys: [{ id: categoryId, className: "BisCore.SpatialCategory" }] },
            ],
          });
          using handlerResult = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(elementIds),
            }),
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is partially visible if some node elements are hidden", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x1", className: "BisCore.Subject" }] },
              { type: "instances", instanceKeys: [{ id: modelId, className: "BisCore.GeometricModel3d" }] },
              { type: "instances", instanceKeys: [{ id: categoryId, className: "BisCore.SpatialCategory" }] },
            ],
          });
          using handlerResult = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set([elementIds[0]]),
              neverDrawn: new Set([elementIds[1]]),
            }),
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });

        it("is visible if always/never drawn sets are empty", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x1", className: "BisCore.Subject" }] },
              { type: "instances", instanceKeys: [{ id: modelId, className: "BisCore.GeometricModel3d" }] },
              { type: "instances", instanceKeys: [{ id: categoryId, className: "BisCore.SpatialCategory" }] },
            ],
          });
          using handlerResult = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible if always drawn set contains no elements of the grouping node", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x1", className: "BisCore.Subject" }] },
              { type: "instances", instanceKeys: [{ id: modelId, className: "BisCore.GeometricModel3d" }] },
              { type: "instances", instanceKeys: [{ id: categoryId, className: "BisCore.SpatialCategory" }] },
            ],
          });
          using handlerResult = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0xfff"]),
            }),
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible if never drawn set contains no elements of the grouping node", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x1", className: "BisCore.Subject" }] },
              { type: "instances", instanceKeys: [{ id: modelId, className: "BisCore.GeometricModel3d" }] },
              { type: "instances", instanceKeys: [{ id: categoryId, className: "BisCore.SpatialCategory" }] },
            ],
          });
          using handlerResult = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(["0xfff"]),
            }),
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("uses category visibility when always/never drawn lists are empty", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
            parentKeys: [
              { type: "instances", instanceKeys: [{ id: "0x1", className: "BisCore.Subject" }] },
              { type: "instances", instanceKeys: [{ id: modelId, className: "BisCore.GeometricModel3d" }] },
              { type: "instances", instanceKeys: [{ id: categoryId, className: "BisCore.SpatialCategory" }] },
            ],
          });

          for (const categoryOn of [true, false]) {
            using handlerResult = createHandler({
              viewport: createFakeSinonViewport({
                view: { viewsCategory: sinon.fake.returns(categoryOn) },
              }),
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elementIds]]),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: categoryOn ? "visible" : "hidden" });
          }
        });
      });
    });

    describe("changeVisibilityStatus", () => {
      describe("subject", () => {
        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            changeSubjectNodeState: sinon.fake.resolves(undefined),
          };
          const viewport = createFakeSinonViewport();
          using idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          await handler.changeVisibility(createSubjectHierarchyNode(), true);
          expect(overrides.changeSubjectNodeState).to.be.called;
        });

        describe("on", () => {
          it("marks all models as visible", async () => {
            const subjectIds = ["0x1", "0x2"];
            const modelIds = [
              ["0x3", "0x4"],
              ["0x5", "0x6"],
            ];
            const node = createSubjectHierarchyNode({ ids: subjectIds });
            const viewport = createFakeSinonViewport();
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                subjectModels: new Map(subjectIds.map((id, idx) => [id, modelIds[idx]])),
              }),
              viewport,
            });
            const { handler, overrides } = handlerResult;

            await handler.changeVisibility(node, true);
            expect(overrides.changeModelState).to.be.calledOnceWith(sinon.match({ ids: sinon.match.array.deepEquals(modelIds.flat()), on: true }));
          });
        });

        describe("off", () => {
          it("marks all models hidden", async () => {
            const subjectIds = ["0x1", "0x2"];
            const modelIds = [
              ["0x3", "0x4"],
              ["0x5", "0x6"],
            ];
            const node = createSubjectHierarchyNode({ ids: subjectIds });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                subjectModels: new Map(subjectIds.map((id, idx) => [id, modelIds[idx]])),
              }),
            });
            const { handler, overrides } = handlerResult;

            await handler.changeVisibility(node, false);
            expect(overrides.changeModelState).to.be.calledOnceWith(sinon.match({ ids: sinon.match.array.deepEquals(modelIds.flat()), on: false }));
          });
        });
      });

      describe("model", () => {
        describe("on", () => {
          it("adds it to the viewport", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            const viewport = createFakeSinonViewport();
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.addViewedModels).to.be.calledOnceWith([modelId]);
          });

          it("doesn't change always/never drawn sets if they don't have any of the model's children", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            const viewport = createFakeSinonViewport({
              // cspell:disable-next-line
              alwaysDrawn: new Set(["abcd", "efgh"]),
              neverDrawn: new Set(["1234", "3456"]),
            });
            using handlerResult = createHandler({
              viewport,
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
                categoryElements: new Map([
                  ["0x10", ["0x100", "0x200"]],
                  ["0x20", ["0x300", "0x400"]],
                ]),
              }),
            });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.setAlwaysDrawn).not.to.be.called;
            expect(viewport.clearAlwaysDrawn).not.to.be.called;
            expect(viewport.setNeverDrawn).not.to.be.called;
            expect(viewport.clearNeverDrawn).not.to.be.called;
          });

          it("clears always and never drawn elements", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const alwaysDrawnElements = ["0x100", "0x200"];
            const neverDrawnElements = ["0x300", "0x400"];
            const otherModelId = "0xff";
            const otherCategoryId = "0x2";
            const otherAlwaysDrawnElement = "abcd";
            const otherNeverDrawnElement = "1234";
            const node = createModelHierarchyNode({ modelId });
            const viewport = createFakeSinonViewport({
              alwaysDrawn: new Set([...alwaysDrawnElements, otherAlwaysDrawnElement]),
              neverDrawn: new Set([...neverDrawnElements, otherNeverDrawnElement]),
              queryHandler: sinon.fake(async (_query: string, binder?: QueryBinder) => {
                const ids = CompressedId64Set.decompressSet((binder?.serialize() as any)[1].value);
                if (ids.size === 2 && alwaysDrawnElements.every((id) => ids.has(id))) {
                  return [
                    ...alwaysDrawnElements.map((elementId) => ({ rootCategoryId: categoryId, elementsPath: elementId, modelId, categoryId })),
                    { rootCategoryId: otherCategoryId, elementsPath: otherAlwaysDrawnElement, modelId: otherModelId, categoryId: otherCategoryId },
                  ];
                }

                if (ids.size === 2 && neverDrawnElements.every((id) => ids.has(id))) {
                  return [
                    ...neverDrawnElements.map((elementId) => ({ rootCategoryId: categoryId, elementsPath: elementId, modelId, categoryId })),
                    { rootCategoryId: otherCategoryId, elementsPath: otherNeverDrawnElement, modelId: otherModelId, categoryId: otherCategoryId },
                  ];
                }

                throw new Error("Unexpected query or bindings");
              }),
            });

            const idsCache = createFakeIdsCache({
              modelCategories: new Map([
                [modelId, [categoryId]],
                [otherModelId, [otherCategoryId]],
              ]),
              categoryElements: new Map([
                [categoryId, [...alwaysDrawnElements, ...neverDrawnElements]],
                [otherCategoryId, [otherAlwaysDrawnElement, otherNeverDrawnElement]],
              ]),
            });
            using handlerResult = createHandler({ viewport, idsCache });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.alwaysDrawn).to.deep.eq(new Set([otherAlwaysDrawnElement]));
            expect(viewport.neverDrawn).to.deep.eq(new Set([otherNeverDrawnElement]));
          });

          it(`removes per model category overrides`, async () => {
            const modelId = "0x1";
            const categoryIds = ["0x2", "0x3", "0x4"];
            const node = createModelHierarchyNode({ modelId });
            const viewport = createFakeSinonViewport();
            using handlerResult = createHandler({
              viewport,
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, categoryIds]]),
              }),
            });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);

            expect(viewport.perModelCategoryVisibility.clearOverrides).to.be.calledWith([modelId]);
          });
        });

        describe("off", () => {
          it("removes it from the viewport", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            const viewport = createFakeSinonViewport();
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, false);
            expect(viewport.changeModelDisplay).to.be.calledOnceWith([modelId], false);
          });
        });
      });

      describe("category", () => {
        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            changeCategoryState: sinon.fake.resolves(undefined),
          };
          const viewport = createFakeSinonViewport();
          using idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          await handler.changeVisibility(createCategoryHierarchyNode({ modelId: "0x1" }), true);
          expect(overrides.changeCategoryState).to.be.called;
        });

        describe("on", () => {
          it("removes HIDE override if model is shown", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            const viewport = createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(false),
              },
              perModelCategoryVisibility: {
                getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Hide),
              },
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(node, true);
            expect(viewport.perModelCategoryVisibility.setOverride).to.be.calledWith(modelId, categoryId, PerModelCategoryVisibility.Override.None);
          });

          it("sets SHOW override if model is shown but category is hidden in selector", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            const viewport = createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(true),
                viewsCategory: sinon.fake.returns(false),
              },
              perModelCategoryVisibility: {
                getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.None),
              },
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(node, true);
            expect(viewport.perModelCategoryVisibility.setOverride).to.be.calledWith(modelId, categoryId, PerModelCategoryVisibility.Override.Show);
          });
        });

        describe("off", () => {
          it("sets HIDE override if model is visible", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            const viewport = createFakeSinonViewport({
              viewsModel: sinon.fake.returns(true),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(node, false);
            expect(viewport.perModelCategoryVisibility.setOverride).to.be.calledWith(modelId, categoryId, PerModelCategoryVisibility.Override.Hide);
          });
        });
      });

      describe("element", () => {
        it("can be overridden", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x10";
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            changeElementsState: sinon.fake.resolves(undefined),
          };
          const viewport = createFakeSinonViewport();
          using idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, elementId }), true);
          expect(overrides.changeElementsState).to.be.called;
        });

        describe("on", () => {
          it("removes it from the never drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            const viewport = createFakeSinonViewport({
              neverDrawn: new Set([elementId]),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.neverDrawn?.size ?? 0).to.eq(0);
          });

          it("if model is hidden, shows model and adds element to always drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            const viewport = createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(false),
                viewsCategory: sinon.fake.returns(false),
              },
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.addViewedModels).to.be.calledWith(modelId);
            expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId]));
          });

          it("adds element to the always drawn list if category is hidden", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            const viewport = createFakeSinonViewport({
              view: {
                viewsCategory: sinon.fake.returns(false),
              },
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId]));
          });

          it("adds element to the always drawn list if exclusive mode is enabled", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            const viewport = createFakeSinonViewport({
              isAlwaysDrawnExclusive: true,
            });
            using handlerResult = createHandler({
              viewport,
              overrides: {
                models: new Map([[modelId, "hidden"]]),
              },
              idsCache: createFakeIdsCache({ modelCategories: new Map([[modelId, [categoryId]]]) }),
            });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId]));
          });

          it("removes element from never drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const viewport = createFakeSinonViewport({
              neverDrawn: new Set([elementId]),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId }), true);
            expect(viewport.neverDrawn?.size ?? 0).to.eq(0);
          });
        });

        describe("off", () => {
          it("removes it from the always drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            const viewport = createFakeSinonViewport({
              alwaysDrawn: new Set([elementId]),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, false);
            expect(viewport.alwaysDrawn?.size ?? 0).to.eq(0);
          });

          it("adds element to the never drawn list if model is visible", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            const viewport = createFakeSinonViewport();
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, false);
            expect(viewport.neverDrawn).to.deep.eq(new Set([elementId]));
          });

          it("doesn't add to never drawn if exclusive draw mode is enabled", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            const viewport = createFakeSinonViewport({
              alwaysDrawn: new Set([elementId]),
              isAlwaysDrawnExclusive: true,
              view: {
                viewsModel: sinon.fake.returns(true),
              },
            });
            using handlerResult = createHandler({ viewport, idsCache: createFakeIdsCache({ modelCategories: new Map([[modelId, [categoryId]]]) }) });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, false);
            expect(viewport.alwaysDrawn?.size ?? 0).to.eq(0);
            expect(viewport.neverDrawn?.size ?? 0).to.eq(0);
          });

          it("adds element to the never drawn list if category is visible", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            const viewport = createFakeSinonViewport();
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, false);
            expect(viewport.neverDrawn).to.deep.eq(new Set([elementId]));
          });
        });
      });

      describe("grouping node", () => {
        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            changeElementGroupingNodeState: sinon.fake.resolves(undefined),
          };
          const viewport = createFakeSinonViewport();
          using idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          const node = createClassGroupingHierarchyNode({
            modelId: "0x1",
            categoryId: "0x2",
            elements: [],
          });

          for (const on of [true, false]) {
            await handler.changeVisibility(node, on);
            expect(overrides.changeElementGroupingNodeState).to.be.calledWithMatch({
              node,
              on,
            });
          }
        });

        function testChildElementsChange(on: boolean) {
          it(`${on ? "shows" : "hides"} all its elements`, async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x10", "0x20"];
            const node = createClassGroupingHierarchyNode({
              modelId,
              categoryId,
              elements,
            });
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elements]]),
            });
            const viewport = createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(true),
                viewsCategory: sinon.fake.returns(!on),
              },
            });
            using handlerResult = createHandler({ idsCache, viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(node, on);
            expect(on ? viewport.alwaysDrawn : viewport.neverDrawn).to.deep.eq(new Set(elements));
          });
        }

        testChildElementsChange(true);
        testChildElementsChange(false);
      });
    });
  });

  describe("#integration", () => {
    before(async () => {
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

    after(async () => {
      await terminatePresentationTesting();
    });

    function createCommonProps(props: { imodel: IModelConnection; hierarchyConfig?: typeof defaultHierarchyConfiguration }) {
      const hierarchyConfig = { ...defaultHierarchyConfiguration, hideRootSubject: true, ...props.hierarchyConfig };
      const imodelAccess = createIModelAccess(props.imodel);
      const viewport = OffScreenViewport.create({
        view: createBlankViewState(props.imodel),
        viewRect: new ViewRect(),
      });
      const idsCache = new ModelsTreeIdsCache(imodelAccess, hierarchyConfig);
      return {
        imodelAccess,
        viewport,
        idsCache,
        hierarchyConfig,
      };
    }

    function createProvider(props: {
      idsCache: ModelsTreeIdsCache;
      imodelAccess: ReturnType<typeof createIModelAccess>;
      hierarchyConfig: typeof defaultHierarchyConfiguration;
      filterPaths?: HierarchyNodeIdentifiersPath[];
    }) {
      return createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ ...props }),
        imodelAccess: props.imodelAccess,
        ...(props.filterPaths ? { filtering: { paths: props.filterPaths } } : undefined),
      });
    }

    function createVisibilityTestData(props: { imodel: IModelConnection; hierarchyConfig?: typeof defaultHierarchyConfiguration }) {
      const commonProps = createCommonProps(props);
      const handler = createModelsTreeVisibilityHandler(commonProps);
      const provider = createProvider(commonProps);
      return {
        handler,
        provider,
        ...commonProps,
        [Symbol.dispose]() {
          commonProps.idsCache[Symbol.dispose]();
          commonProps.viewport[Symbol.dispose]();
          handler[Symbol.dispose]();
          provider[Symbol.dispose]();
        },
      };
    }

    interface IModelWithSubModelIds {
      subjectId: Id64String;
      modeledElementId: Id64String;
      modelId: Id64String;
      categoryId: Id64String;
      subModelCategoryId?: Id64String;
      subModelElementId?: Id64String;
    }

    const testCases: Array<{
      describeName: string;
      createIModel: (context: Mocha.Context) => Promise<{ imodel: IModelConnection } & IModelWithSubModelIds>;
      cases: Array<{
        only?: boolean;
        name: string;
        getTargetNode: (ids: IModelWithSubModelIds) => NonGroupingHierarchyNode | GroupingHierarchyNode;
        expectations: (ids: IModelWithSubModelIds) => ReturnType<typeof VisibilityExpectations.all>;
      }>;
    }> = [
      {
        describeName: "with modeled elements",
        createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(context, async (builder, testSchema) => {
            const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const modeledElement = insertPhysicalElement({
              builder,
              userLabel: `element`,
              modelId: model.id,
              categoryId: category.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            const subModel = insertPhysicalSubModel({ builder, modeledElementId: modeledElement.id });
            const subModelCategory = insertSpatialCategory({ builder, codeValue: "category2" });
            const subModelElement = insertPhysicalElement({ builder, userLabel: `element2`, modelId: subModel.id, categoryId: subModelCategory.id });
            return {
              subjectId: rootSubject.id,
              modeledElementId: modeledElement.id,
              modelId: model.id,
              categoryId: category.id,
              subModelCategoryId: subModelCategory.id,
              subModelElementId: subModelElement.id,
            };
          });
        },
        cases: [
          {
            name: "modeled element's children display is turned on when its subject display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createSubjectHierarchyNode({ ids: [ids.subjectId] }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "modeled element's children display is turned on when its model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createModelHierarchyNode({
                modelId: ids.modelId,
                hasChildren: true,
              }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "modeled element's children display is turned on when its category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createCategoryHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                hasChildren: true,
              }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "modeled element's children display is turned on when its class grouping node display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createClassGroupingHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elements: [ids.modeledElementId],
              }),
            expectations: () => VisibilityExpectations.all("visible"),
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
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "modeled element's children display is turned on when its sub-model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createModelHierarchyNode({
                modelId: ids.modeledElementId,
                hasChildren: true,
              }),
            expectations: (ids: IModelWithSubModelIds): ReturnType<typeof VisibilityExpectations.all> => ({
              subject: () => "partial",
              model: (modelId) => (modelId === ids.modelId ? "partial" : "visible"),
              category: ({ categoryId }) => {
                if (categoryId === ids.subModelCategoryId) {
                  return "visible";
                }
                return "partial";
              },
              groupingNode: ({ elementIds }) => {
                if (elementIds.includes(ids.modeledElementId)) {
                  return "partial";
                }
                return "visible";
              },
              element: ({ elementId }) => {
                if (elementId === ids.modeledElementId) {
                  return "partial";
                }
                return "visible";
              },
            }),
          },
          {
            name: "modeled element, its model and category have partial visibility when its sub-model element's category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createCategoryHierarchyNode({
                modelId: ids.modeledElementId,
                categoryId: ids.subModelCategoryId,
                hasChildren: true,
              }),
            expectations: (ids: IModelWithSubModelIds): ReturnType<typeof VisibilityExpectations.all> => ({
              subject: () => "partial",
              model: () => "partial",
              category: ({ categoryId }) => {
                if (categoryId === ids.subModelCategoryId) {
                  return "visible";
                }
                return "partial";
              },
              groupingNode: ({ elementIds }) => {
                if (elementIds.includes(ids.modeledElementId)) {
                  return "partial";
                }
                return "visible";
              },
              element: ({ elementId }) => {
                if (elementId === ids.subModelElementId) {
                  return "visible";
                }
                return "partial";
              },
            }),
          },
          {
            name: "modeled element, its model and category have partial visibility when its sub-model element's display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createElementHierarchyNode({
                modelId: ids.modeledElementId,
                categoryId: ids.subModelCategoryId,
                elementId: ids.subModelElementId,
              }),
            expectations: (ids: IModelWithSubModelIds): ReturnType<typeof VisibilityExpectations.all> => ({
              subject: () => "partial",
              model: () => "partial",
              category: ({ categoryId }) => {
                if (categoryId === ids.subModelCategoryId) {
                  return "visible";
                }
                return "partial";
              },
              groupingNode: ({ elementIds }) => {
                if (elementIds.includes(ids.modeledElementId)) {
                  return "partial";
                }
                return "visible";
              },
              element: ({ elementId }) => {
                if (elementId === ids.subModelElementId) {
                  return "visible";
                }
                return "partial";
              },
            }),
          },
        ],
      },
      {
        describeName: "with modeled elements that have private subModel",
        createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(context, async (builder, testSchema) => {
            const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const modeledElement = insertPhysicalElement({
              builder,
              userLabel: `element`,
              modelId: model.id,
              categoryId: category.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            const subModel = insertPhysicalSubModel({ builder, modeledElementId: modeledElement.id, isPrivate: true });
            const subModelCategory = insertSpatialCategory({ builder, codeValue: "category2" });
            const subModelElement = insertPhysicalElement({ builder, userLabel: `element2`, modelId: subModel.id, categoryId: subModelCategory.id });
            return {
              subjectId: rootSubject.id,
              modeledElementId: modeledElement.id,
              modelId: model.id,
              categoryId: category.id,
              subModelCategoryId: subModelCategory.id,
              subModelElementId: subModelElement.id,
            };
          });
        },
        cases: [
          {
            name: "everything is visible when subject display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createSubjectHierarchyNode({ ids: [ids.subjectId] }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createModelHierarchyNode({
                modelId: ids.modelId,
                hasChildren: true,
              }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createCategoryHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                hasChildren: true,
              }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when elements class grouping node display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createClassGroupingHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elements: [ids.modeledElementId],
              }),
            expectations: () => VisibilityExpectations.all("visible"),
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
            expectations: () => VisibilityExpectations.all("visible"),
          },
        ],
      },
      {
        describeName: "with modeled elements that have subModel with no children",
        createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(context, async (builder, testSchema) => {
            const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const modeledElement = insertPhysicalElement({
              builder,
              userLabel: `element`,
              modelId: model.id,
              categoryId: category.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
            });
            insertPhysicalSubModel({ builder, modeledElementId: modeledElement.id });
            return {
              subjectId: rootSubject.id,
              modeledElementId: modeledElement.id,
              modelId: model.id,
              categoryId: category.id,
            };
          });
        },
        cases: [
          {
            name: "everything is visible when subject display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) => createSubjectHierarchyNode({ ids: [ids.subjectId] }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when model display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createModelHierarchyNode({
                modelId: ids.modelId,
                hasChildren: true,
              }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when category display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createCategoryHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                hasChildren: true,
              }),
            expectations: () => VisibilityExpectations.all("visible"),
          },
          {
            name: "everything is visible when elements class grouping node display is turned on",
            getTargetNode: (ids: IModelWithSubModelIds) =>
              createClassGroupingHierarchyNode({
                modelId: ids.modelId,
                categoryId: ids.categoryId,
                elements: [ids.modeledElementId],
              }),
            expectations: () => VisibilityExpectations.all("visible"),
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
            expectations: () => VisibilityExpectations.all("visible"),
          },
        ],
      },
    ];

    testCases.forEach(({ describeName, createIModel, cases }) => {
      describe(describeName, () => {
        let iModel: IModelConnection;
        let createdIds: IModelWithSubModelIds;

        before(async function () {
          const { imodel, ...ids } = await createIModel(this);
          iModel = imodel;
          createdIds = ids;
        });

        after(async () => {
          await iModel.close();
        });

        cases.forEach(({ name, getTargetNode, expectations, only }) => {
          (only ? it.only : it)(name, async function () {
            using visibilityTestData = createVisibilityTestData({ imodel: iModel });
            const { handler, provider, viewport } = visibilityTestData;

            const nodeToChangeVisibility = getTargetNode(createdIds);
            await validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              visibilityExpectations: VisibilityExpectations.all("hidden"),
            });
            await handler.changeVisibility(nodeToChangeVisibility, true);
            await validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              visibilityExpectations: expectations(createdIds),
            });
            await handler.changeVisibility(nodeToChangeVisibility, false);
            await validateHierarchyVisibility({
              provider,
              handler,
              viewport,
              visibilityExpectations: VisibilityExpectations.all("hidden"),
            });
          });
        });
      });
    });

    it("by default everything is hidden", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const modelId = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId, categoryId });
      });

      const { imodel } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "hidden",
          model: () => ({ tree: "hidden", modelSelector: false }),
          category: () => ({ tree: "hidden", categorySelector: false, perModelCategoryOverride: "none" }),
          groupingNode: () => "hidden",
          element: () => "hidden",
        },
      });
    });

    it("showing subject makes it, all its models, categories and elements visible", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const modelId = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId, categoryId });
      });

      const { imodel } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: [IModel.rootSubjectId] }), true);
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "visible",
          model: () => ({ tree: "visible", modelSelector: true }),
          category: () => ({ tree: "visible", categorySelector: false, perModelCategoryOverride: "show" }),
          groupingNode: () => "visible",
          element: () => "visible",
        },
      });
    });

    it("showing model makes it, all its categories and elements visible and doesn't affect other models", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId });

        const otherModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;
        insertPhysicalElement({ builder, modelId: otherModel, categoryId });
        return { model };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(
        createModelHierarchyNode({
          modelId: ids.model,
          hasChildren: true,
        }),
        true,
      );
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: (id) => {
            return id === ids.model ? { tree: "visible", modelSelector: true } : { tree: "hidden", modelSelector: false };
          },
          category: ({ modelId }) => {
            if (modelId === ids.model) {
              return { tree: "visible", categorySelector: false, perModelCategoryOverride: "show" };
            }
            return { tree: "hidden", categorySelector: false, perModelCategoryOverride: "none" };
          },
          groupingNode: ({ modelId }) => (modelId === ids.model ? "visible" : "hidden"),
          element: ({ modelId }) => (modelId === ids.model ? "visible" : "hidden"),
        },
      });
    });

    it("all parent hierarchy gets partial when it's visible and one of the elements are added to never drawn list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const elements = [
          insertPhysicalElement({ builder, modelId: model, categoryId }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId }).id,
        ];
        return { model, hiddenElement: elements[0] };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createModelHierarchyNode({ modelId: ids.model, hasChildren: true }), true);
      viewport.setNeverDrawn(new Set([ids.hiddenElement]));

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => ({ tree: "partial", modelSelector: true }),
          category: () => ({ tree: "partial", categorySelector: false, perModelCategoryOverride: "show" }),
          groupingNode: () => "partial",
          element: ({ elementId }) => (elementId === ids.hiddenElement ? "hidden" : "visible"),
        },
      });
    });

    it("hiding parent element makes it, its children, model and category hidden", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const parentElement = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
        const child = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: parentElement }).id;
        const childOfChild = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: child }).id;
        return { model, category, parentElement, child, childOfChild };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createModelHierarchyNode({ modelId: ids.model, hasChildren: true }), true);

      await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category, elementId: ids.parentElement }), false);

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: VisibilityExpectations.all("hidden"),
      });
    });

    it("hiding parent element makes it, its children (with different categories), model and category hidden", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const parentElement = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
        const category2 = insertSpatialCategory({ builder, codeValue: "category2" }).id;
        const category3 = insertSpatialCategory({ builder, codeValue: "category3" }).id;
        const child = insertPhysicalElement({ builder, modelId: model, categoryId: category2, parentId: parentElement }).id;
        const childOfChild = insertPhysicalElement({ builder, modelId: model, categoryId: category3, parentId: child }).id;
        return { model, category, category2, category3, parentElement, child, childOfChild };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await viewport.addViewedModels(ids.model);
      viewport.changeCategoryDisplay([ids.category2, ids.category3], false);
      viewport.setAlwaysDrawn(new Set([ids.parentElement, ids.child, ids.childOfChild]));
      viewport.renderFrame();

      await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category, elementId: ids.parentElement }), false);

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: VisibilityExpectations.all("hidden"),
      });
    });

    it("showing parent element makes it, its children (with different categories), model and category visible", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const parentElement = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
        const category2 = insertSpatialCategory({ builder, codeValue: "category2" }).id;
        const category3 = insertSpatialCategory({ builder, codeValue: "category3" }).id;
        const child = insertPhysicalElement({ builder, modelId: model, categoryId: category2, parentId: parentElement }).id;
        const childOfChild = insertPhysicalElement({ builder, modelId: model, categoryId: category3, parentId: child }).id;
        return { model, category, category2, category3, parentElement, child, childOfChild };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await viewport.addViewedModels(ids.model);
      viewport.setNeverDrawn(new Set([ids.parentElement, ids.child, ids.childOfChild]));
      viewport.changeCategoryDisplay([ids.category2, ids.category3], true, true);
      viewport.renderFrame();

      await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category, elementId: ids.parentElement }), true);

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: VisibilityExpectations.all("visible"),
      });
    });

    it("if model is hidden, showing element adds it to always drawn set and makes model and category visible in the viewport", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const elements = [
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
        ];

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });

        return { model, category, elementToShow: elements[0] };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(
        createElementHierarchyNode({
          modelId: ids.model,
          categoryId: ids.category,
          elementId: ids.elementToShow,
        }),
        true,
      );

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => ({ tree: "partial", modelSelector: true }),
          category: ({ categoryId }) =>
            categoryId === ids.category
              ? { tree: "partial", categorySelector: false, perModelCategoryOverride: "none" }
              : { tree: "hidden", categorySelector: false, perModelCategoryOverride: "none" },
          groupingNode: ({ categoryId }) => (categoryId === ids.category ? "partial" : "hidden"),
          element: ({ elementId }) => (elementId === ids.elementToShow ? "visible" : "hidden"),
        },
      });
    });

    it("if model is hidden, showing element removes all other model elements from the always drawn list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const otherModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;

        const modelElements = [
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id,
        ];

        const otherModelElements = [
          insertPhysicalElement({ builder, modelId: otherModel, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: otherModel, categoryId: category }).id,
          insertPhysicalElement({ builder, modelId: otherModel, categoryId: category }).id,
        ];

        return { model, category, modelElements, otherModelElements, allElements: [...modelElements, ...otherModelElements] };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      const elementToShow = ids.modelElements[0];
      viewport.setAlwaysDrawn(new Set(ids.allElements));

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: VisibilityExpectations.all("hidden"),
      });

      await handler.changeVisibility(
        createElementHierarchyNode({
          modelId: ids.model,
          categoryId: ids.category,
          elementId: elementToShow,
        }),
        true,
      );

      expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementToShow, ...ids.otherModelElements]));
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: (id) => (id === ids.model ? { tree: "partial", modelSelector: true } : { tree: "hidden", modelSelector: false }),
          category: ({ modelId }) => ({ tree: modelId === ids.model ? "partial" : "hidden", categorySelector: false, perModelCategoryOverride: "none" }),
          groupingNode: ({ elementIds }) => (elementIds.includes(elementToShow) ? "partial" : "hidden"),
          element: ({ elementId }) => (elementId === elementToShow ? "visible" : "hidden"),
        },
      });
    });

    it("model gets hidden when elements from other model are added to the exclusive always drawn list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId });

        const exclusiveModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;
        const exclusiveElement = insertPhysicalElement({ builder, modelId: exclusiveModel, categoryId }).id;
        insertPhysicalElement({ builder, modelId: exclusiveModel, categoryId });
        return { exclusiveModel, exclusiveElement };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: ["0x1"] }), true);
      viewport.setAlwaysDrawn(new Set([ids.exclusiveElement]), true);
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: (id) => {
            if (id === ids.exclusiveModel) {
              return { tree: "partial", modelSelector: true };
            }
            return { tree: "hidden", modelSelector: true };
          },
          category: ({ modelId }) => {
            if (modelId === ids.exclusiveModel) {
              return { tree: "partial", categorySelector: false, perModelCategoryOverride: "show" };
            }
            return { tree: "hidden", categorySelector: false, perModelCategoryOverride: "show" };
          },
          groupingNode: ({ modelId }) => (modelId === ids.exclusiveModel ? "partial" : "hidden"),
          element: ({ elementId }) => (elementId === ids.exclusiveElement ? "visible" : "hidden"),
        },
      });
    });

    it("model gets hidden when it has child only categories and elements from other model are added to the exclusive always drawn list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const childCategoryId = insertSpatialCategory({ builder, codeValue: "childCategory" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const rootElement = insertPhysicalElement({ builder, modelId: model, categoryId });
        insertPhysicalElement({ builder, modelId: model, categoryId: childCategoryId, parentId: rootElement.id });

        const exclusiveModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;
        const exclusiveElement = insertPhysicalElement({ builder, modelId: exclusiveModel, categoryId }).id;
        insertPhysicalElement({ builder, modelId: exclusiveModel, categoryId });
        return { exclusiveModel, exclusiveElement };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: ["0x1"] }), true);
      viewport.setAlwaysDrawn(new Set([ids.exclusiveElement]), true);
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: (id) => {
            if (id === ids.exclusiveModel) {
              return { tree: "partial", modelSelector: true };
            }
            return { tree: "hidden", modelSelector: true };
          },
          category: ({ modelId }) => {
            if (modelId === ids.exclusiveModel) {
              return { tree: "partial", categorySelector: false, perModelCategoryOverride: "show" };
            }
            return { tree: "hidden", categorySelector: false, perModelCategoryOverride: "show" };
          },
          groupingNode: ({ modelId }) => (modelId === ids.exclusiveModel ? "partial" : "hidden"),
          element: ({ elementId }) => (elementId === ids.exclusiveElement ? "visible" : "hidden"),
        },
      });
    });

    it("showing category makes its model visible in the viewport and per model override for that category is set to SHOW", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category });
        return { model, category };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(
        createCategoryHierarchyNode({
          modelId: ids.model,
          categoryId: ids.category,
          hasChildren: true,
        }),
        true,
      );
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "visible",
          model: () => ({ tree: "visible", modelSelector: true }),
          category: () => ({ tree: "visible", categorySelector: false, perModelCategoryOverride: "show" }),
          groupingNode: () => "visible",
          element: () => "visible",
        },
      });
    });

    it("hiding category visible in selector adds it to per model override list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category });

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });
        return { model, category };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: IModel.rootSubjectId }), true);
      viewport.changeCategoryDisplay(ids.category, true, true);
      viewport.renderFrame();

      await handler.changeVisibility(
        createCategoryHierarchyNode({
          modelId: ids.model,
          categoryId: ids.category,
          hasChildren: true,
        }),
        false,
      );

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => ({ tree: "partial", modelSelector: true }),
          category: ({ categoryId }) =>
            categoryId === ids.category
              ? { tree: "hidden", categorySelector: true, perModelCategoryOverride: "hide" }
              : { tree: "visible", categorySelector: false, perModelCategoryOverride: "show" },
          groupingNode: ({ categoryId }) => (categoryId === ids.category ? "hidden" : "visible"),
          element: ({ categoryId }) => (categoryId === ids.category ? "hidden" : "visible"),
        },
      });
    });

    it("showing grouping node makes it, its grouped elements and children visible", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const parentElement = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
        const child = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: parentElement }).id;
        const childOfChild = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: child }).id;

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });

        return { model, category, parentElement, child, childOfChild };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(
        createClassGroupingHierarchyNode({
          modelId: ids.model,
          categoryId: ids.category,
          elements: [ids.parentElement],
        }),
        true,
      );

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => ({ tree: "partial", modelSelector: true }),
          category: ({ categoryId }) =>
            categoryId === ids.category
              ? { tree: "visible", categorySelector: false, perModelCategoryOverride: "none" }
              : { tree: "hidden", categorySelector: false, perModelCategoryOverride: "none" },
          groupingNode: ({ elementIds }) =>
            elementIds.some((elementId) => [ids.parentElement, ids.child, ids.childOfChild].includes(elementId)) ? "visible" : "hidden",
          element: ({ elementId }) => ([ids.parentElement, ids.child, ids.childOfChild].includes(elementId) ? "visible" : "hidden"),
        },
      });
    });

    it("hiding grouping node makes it, its grouped elements and children hidden", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const parentElement = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
        const child = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: parentElement }).id;
        const childOfChild = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: child }).id;

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });

        return { model, category, parentElement, child, childOfChild };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: IModel.rootSubjectId }), true);
      await handler.changeVisibility(
        createClassGroupingHierarchyNode({
          modelId: ids.model,
          categoryId: ids.category,
          elements: [ids.parentElement],
        }),
        false,
      );

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => ({ tree: "partial", modelSelector: true }),
          category: ({ categoryId }) => ({
            tree: categoryId === ids.category ? "hidden" : "visible",
            categorySelector: false,
            perModelCategoryOverride: "show",
          }),
          groupingNode: ({ elementIds }) =>
            elementIds.some((elementId) => [ids.parentElement, ids.child, ids.childOfChild].includes(elementId)) ? "hidden" : "visible",
          element: ({ elementId }) => ([ids.parentElement, ids.child, ids.childOfChild].includes(elementId) ? "hidden" : "visible"),
        },
      });
    });

    it("changing merged category visibility changes child elements visibility", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const category1 = insertSpatialCategory({ builder, codeValue: "category1", userLabel: "SomeLabel" }).id;
        const category2 = insertSpatialCategory({ builder, codeValue: "category2", userLabel: "SomeLabel" }).id;
        const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category1 }).id;
        const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category2 }).id;
        return { model, element1, element2, category1, category2 };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(
        createCategoryHierarchyNode({
          modelId: ids.model,
          categoryId: [ids.category1, ids.category2],
          hasChildren: true,
        }),
        true,
      );

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: VisibilityExpectations.all("visible"),
      });
    });

    it("changing element visibility changes merged parent category visibility", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const category1 = insertSpatialCategory({ builder, codeValue: "category1", userLabel: "SomeLabel" }).id;
        const category2 = insertSpatialCategory({ builder, codeValue: "category2", userLabel: "SomeLabel" }).id;
        const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category1 }).id;
        const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category2 }).id;
        return { model, element1, element2, category1, category2 };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category2, elementId: ids.element2 }), true);

      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: {
          subject: () => "partial",
          model: () => "partial",
          category: () => "partial",
          groupingNode: () => "partial",
          element: (props) => (props.elementId === ids.element2 ? "visible" : "hidden"),
        },
      });
      await handler.changeVisibility(
        createElementHierarchyNode({
          modelId: ids.model,
          categoryId: ids.category1,
          elementId: ids.element1,
        }),
        true,
      );
      await validateHierarchyVisibility({
        provider,
        handler,
        viewport,
        visibilityExpectations: VisibilityExpectations.all("visible"),
      });
    });

    describe("child element category is different than parent's", () => {
      it("model visibility takes into account all element categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const parentCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const childCategory = insertSpatialCategory({ builder, codeValue: "childCategory" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: childCategory.id, parentId: parentElement.id });
          return { modelId: model.id, parentCategoryId: parentCategory.id, parentElementId: parentElement.id };
        });
        const { imodel, modelId, parentCategoryId, parentElementId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;
        const parentCategoryNode = createCategoryHierarchyNode({
          modelId,
          categoryId: parentCategoryId,
        });

        await handler.changeVisibility(parentCategoryNode, true);
        await validateHierarchyVisibility({
          ...props,
          handler,
          viewport,
          visibilityExpectations: {
            // Only categories of elements without parents are shown in the tree
            category: () => "visible",
            subject: () => "partial",
            model: () => "partial",
            groupingNode: ({ elementIds }) => (elementIds.includes(parentElementId) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === parentElementId ? "visible" : "hidden"),
          },
        });
      });

      it("model visibility takes into account all element categories when some elements are in always drawn list", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const parentCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const childCategory = insertSpatialCategory({ builder, codeValue: "childCategory" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          const childElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: childCategory.id, parentId: parentElement.id });
          return { modelId: model.id, parentCategoryId: parentCategory.id, parentElementId: parentElement.id, childElementId: childElement.id };
        });
        const { imodel, modelId, parentCategoryId, parentElementId, childElementId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;
        const parentCategoryNode = createCategoryHierarchyNode({
          modelId,
          categoryId: parentCategoryId,
        });
        await handler.changeVisibility(parentCategoryNode, true);
        viewport.setAlwaysDrawn(new Set([...(viewport.alwaysDrawn ?? []), parentElementId]));
        await validateHierarchyVisibility({
          ...props,
          handler,
          viewport,
          visibilityExpectations: {
            // Only categories of elements without parents are shown in the tree
            category: () => "visible",
            subject: () => "partial",
            model: () => "partial",
            groupingNode: ({ elementIds }) => (!elementIds.includes(childElementId) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId !== childElementId ? "visible" : "hidden"),
          },
        });
      });

      it("changing category visibility of hidden model does not turn on unrelated elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const parentCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const parentCategory2 = insertSpatialCategory({ builder, codeValue: "parentCategory2" });
          const childCategory = insertSpatialCategory({ builder, codeValue: "childCategory" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          const parentElement2 = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory2.id });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: childCategory.id, parentId: parentElement2.id });
          return { modelId: model.id, parentCategoryId: parentCategory.id, parentElementId: parentElement.id, childCategoryId: childCategory.id };
        });
        const { imodel, modelId, parentCategoryId, parentElementId, childCategoryId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;
        const modelNode = createModelHierarchyNode({ modelId, hasChildren: true });
        // Make child category enabled through category selector
        viewport.changeCategoryDisplay(childCategoryId, true);
        await handler.changeVisibility(modelNode, false);

        const parentCategoryNode = createCategoryHierarchyNode({
          modelId,
          categoryId: parentCategoryId,
        });
        // Changing category for hidden model should put all other categories into Hide overrides
        await handler.changeVisibility(parentCategoryNode, true);
        await validateHierarchyVisibility({
          ...props,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            category: ({ categoryId }) => (categoryId === parentCategoryId ? "visible" : "hidden"),
            model: () => "partial",
            groupingNode: ({ elementIds }) => (elementIds.includes(parentElementId) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === parentElementId ? "visible" : "hidden"),
          },
        });
      });

      it("changing category visibility turns on child elements that have the same category", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const sharedCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const parentCategory2 = insertSpatialCategory({ builder, codeValue: "parentCategory2" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          insertPhysicalElement({ builder, modelId: model.id, categoryId: sharedCategory.id });
          const parentElement2 = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory2.id });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: sharedCategory.id, parentId: parentElement2.id });
          return { modelId: model.id, parentCategoryId: sharedCategory.id, parentElementId: parentElement2.id };
        });
        const { imodel, modelId, parentCategoryId, parentElementId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;

        const parentCategoryNode = createCategoryHierarchyNode({
          modelId,
          categoryId: parentCategoryId,
          hasChildren: true,
        });
        // Changing category for hidden model should put all other categories into Hide overrides
        await handler.changeVisibility(parentCategoryNode, true);
        await validateHierarchyVisibility({
          ...props,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            category: ({ categoryId }) => (categoryId === parentCategoryId ? "visible" : "hidden"),
            model: () => "partial",
            groupingNode: ({ elementIds }) => (!elementIds.includes(parentElementId) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId !== parentElementId ? "visible" : "hidden"),
          },
        });
      });

      it("category visibility only takes into account element trees that start with those that have no parents", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const category = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });
          const element = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });

          const unrelatedParentCategory = insertSpatialCategory({ builder, codeValue: "differentParentCategory" });
          const unrelatedParentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: unrelatedParentCategory.id });
          insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: unrelatedParentElement.id });

          return { modelId: model.id, categoryId: category.id, elementId: element.id, unrelatedCategoryId: unrelatedParentCategory.id };
        });
        const { imodel, modelId, categoryId, elementId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...testProps } = visibilityTestData;
        const elementNode = createElementHierarchyNode({
          modelId,
          categoryId,
          elementId,
        });

        await handler.changeVisibility(elementNode, true);
        await validateHierarchyVisibility({
          ...testProps,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => ({ tree: "partial", modelSelector: true }),
            category: (props) => ({
              tree: props.categoryId === categoryId ? "visible" : "hidden",
              categorySelector: false,
              perModelCategoryOverride: "none",
            }),
            groupingNode: ({ elementIds }) => (elementIds.includes(elementId) ? "visible" : "hidden"),
            element: (props) => (props.elementId === elementId ? "visible" : "hidden"),
          },
        });
      });
    });

    describe("reacting to category selector", () => {
      async function createIModel(context: Mocha.Context) {
        return buildIModel(context, async (builder) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const category1 = insertSpatialCategory({ builder, codeValue: "category1" });
          const elements1 = [
            insertPhysicalElement({ builder, categoryId: category1.id, modelId: model.id }).id,
            insertPhysicalElement({ builder, categoryId: category1.id, modelId: model.id }).id,
          ];

          const category2 = insertSpatialCategory({ builder, codeValue: "category2" });
          const elements2 = [
            insertPhysicalElement({ builder, categoryId: category2.id, modelId: model.id }).id,
            insertPhysicalElement({ builder, categoryId: category2.id, modelId: model.id }).id,
          ];
          return { firstCategoryId: category1.id, secondCategoryId: category2.id, modelId: model.id, elements1, elements2 };
        });
      }

      it("showing category via the selector makes category and all elements visible when it has no always or never drawn elements", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, secondCategoryId, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
        });

        viewport.changeCategoryDisplay([firstCategoryId, secondCategoryId], true, true);

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
        });
      });

      it("hiding category via the selector makes category and all elements hidden when it has no always or never drawn elements", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, secondCategoryId, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);
        viewport.changeCategoryDisplay([firstCategoryId, secondCategoryId], true, true);

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
        });

        viewport.changeCategoryDisplay([firstCategoryId, secondCategoryId], false);

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
        });
      });

      it("hiding category via the selector makes it hidden when it only has never drawn elements", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, modelId, elements1 } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);
        viewport.changeCategoryDisplay(firstCategoryId, true, true);
        const elementId = elements1[0];
        viewport.setNeverDrawn(new Set([elementId]));

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => ({ tree: "partial", modelSelector: true }),
            category: ({ categoryId }) => (categoryId === firstCategoryId ? "partial" : "hidden"),
            groupingNode: ({ categoryId }) => (categoryId === firstCategoryId ? "partial" : "hidden"),
            element: (props) => (props.categoryId === firstCategoryId && props.elementId !== elementId ? "visible" : "hidden"),
          },
        });

        viewport.changeCategoryDisplay([firstCategoryId], false);

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
        });
      });

      it("showing category via the selector makes it visible when it only has always drawn elements", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, secondCategoryId, elements1, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);
        viewport.changeCategoryDisplay(secondCategoryId, true, true);
        const elementId = elements1[0];
        viewport.setAlwaysDrawn(new Set([elementId]));

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => ({ tree: "partial", modelSelector: true }),
            category: ({ categoryId }) => (categoryId === firstCategoryId ? "partial" : "visible"),
            groupingNode: ({ categoryId }) => (categoryId === firstCategoryId ? "partial" : "visible"),
            element: (props) => (props.categoryId === firstCategoryId && props.elementId !== elementId ? "hidden" : "visible"),
          },
        });

        viewport.changeCategoryDisplay(firstCategoryId, true, true);

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
        });
      });

      it("model is visible if category is disabled in selector but all category's elements are always drawn", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, secondCategoryId, elements1, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);
        viewport.changeCategoryDisplay([firstCategoryId, secondCategoryId], true, true);
        viewport.setAlwaysDrawn(new Set(elements1));

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
        });

        viewport.changeCategoryDisplay(firstCategoryId, false);

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("visible"),
        });
      });

      it("model is hidden if category is enabled in selector but all category's elements are never drawn", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, elements1, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        await viewport.addViewedModels(modelId);
        viewport.setNeverDrawn(new Set(elements1));

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
        });

        viewport.changeCategoryDisplay(firstCategoryId, true, true);

        await validateHierarchyVisibility({
          handler,
          provider,
          viewport,
          visibilityExpectations: VisibilityExpectations.all("hidden"),
        });
      });
    });

    describe("Custom Hierarchy configuration", () => {
      /**
       * Creates physical model that has one spatial category that contains contains 3 child elements
       * out of which the first and second belong to the same custom class while the last element is of class `PhysicalObject`
       */
      async function createHierarchyConfigurationModel(context: Mocha.Context) {
        return buildIModel(context, async (builder, schema) => {
          const emptyPartitionId = insertPhysicalPartition({ builder, codeValue: "EmptyPhysicalModel", parentId: IModel.rootSubjectId }).id;
          const emptyModelId = insertPhysicalSubModel({ builder, modeledElementId: emptyPartitionId }).id;

          const customClassName = schema.items.SubModelablePhysicalObject.fullName;

          const partitionId = insertPhysicalPartition({ builder, codeValue: "ConfigurationPhysicalModel ", parentId: IModel.rootSubjectId }).id;
          const configurationModelId = insertPhysicalSubModel({ builder, modeledElementId: partitionId }).id;
          const modelCategories = new Array<string>();

          const configurationCategoryId = insertSpatialCategory({ builder, codeValue: `ConfigurationSpatialCategory` }).id;
          modelCategories.push(configurationCategoryId);
          const elements = new Array<Id64String>();

          for (let childIdx = 0; childIdx < 3; ++childIdx) {
            const props: GeometricElement3dProps = {
              model: configurationModelId,
              category: configurationCategoryId,
              code: new Code({ scope: partitionId, spec: "", value: `Configuration_${customClassName}_${childIdx}` }),
              classFullName: childIdx !== 2 ? customClassName : "Generic:PhysicalObject",
            };
            elements.push(builder.insertElement(props));
          }
          const [customClassElement1, customClassElement2, nonCustomClassElement] = elements;

          const hierarchyConfig: typeof defaultHierarchyConfiguration = {
            ...defaultHierarchyConfiguration,
            showEmptyModels: true,
            elementClassSpecification: customClassName,
          };

          return {
            configurationModelId,
            configurationCategoryId,
            elements,
            customClassElement1,
            customClassElement2,
            nonCustomClassElement,
            modelCategories,
            emptyModelId,
            customClassName,
            hierarchyConfig,
          };
        });
      }

      describe("subject with empty model", () => {
        const node = createSubjectHierarchyNode({ ids: IModel.rootSubjectId });

        it("empty model hidden by default", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("hidden"),
          });
        });

        it("showing it makes empty model visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(node, true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });
        });

        it("gets partial when only empty model is visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, emptyModelId } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createModelHierarchyNode({ modelId: emptyModelId }), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === emptyModelId ? { tree: "visible", modelSelector: true } : { tree: "hidden", modelSelector: false }),
              category: () => ({ tree: "hidden", categorySelector: false, perModelCategoryOverride: "none" }),
              groupingNode: () => "hidden",
              element: () => "hidden",
            },
          });
        });
      });

      describe("model with custom class specification elements", () => {
        it("showing it makes it, all its categories and elements visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, configurationModelId } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createModelHierarchyNode({ modelId: configurationModelId }), true);
          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: {
              ...VisibilityExpectations.all("visible"),
              subject: () => "partial",
              model: (id) => (id === configurationModelId ? { tree: "visible", modelSelector: true } : { tree: "hidden", modelSelector: false }),
            },
          });
        });

        it("gets partial when custom class element is visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, configurationModelId, configurationCategoryId, customClassElement1 } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: configurationModelId,
              categoryId: configurationCategoryId,
              hasChildren: true,
              elementId: customClassElement1,
            }),
            true,
          );
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([customClassElement1]));

          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === configurationModelId ? { tree: "partial", modelSelector: true } : { tree: "hidden", modelSelector: false }),
              category: ({ modelId }) => ({
                tree: modelId === configurationModelId ? "partial" : "hidden",
                categorySelector: false,
                perModelCategoryOverride: "none",
              }),
              groupingNode: () => "partial",
              element: ({ elementId }) => (elementId === customClassElement1 ? "visible" : "hidden"),
            },
          });
        });

        it("gets visible when all custom class elements are visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, configurationModelId, configurationCategoryId, customClassElement1, customClassElement2, nonCustomClassElement } =
            buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: configurationModelId,
              categoryId: configurationCategoryId,
              hasChildren: true,
              elementId: customClassElement1,
            }),
            true,
          );
          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: configurationModelId,
              categoryId: configurationCategoryId,
              hasChildren: true,
              elementId: customClassElement2,
            }),
            true,
          );
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([customClassElement1, customClassElement2]));

          await validateHierarchyVisibility({
            provider,
            handler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === configurationModelId ? { tree: "visible", modelSelector: true } : { tree: "hidden", modelSelector: false }),
              category: ({ modelId }) => ({
                tree: modelId === configurationModelId ? "visible" : "hidden",
                categorySelector: false,
                perModelCategoryOverride: "none",
              }),
              groupingNode: ({ elementIds }) => (elementIds.includes(nonCustomClassElement) ? "hidden" : "visible"),
              element: ({ modelId }) => (modelId === nonCustomClassElement ? "hidden" : "visible"),
            },
          });
        });
      });
    });

    describe("IsAlwaysDrawnExclusive is true", () => {
      it("changing model visibility does not affect other models", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const model1 = insertPhysicalModelWithPartition({ builder, codeValue: "1" }).id;
          const category1 = insertSpatialCategory({ builder, codeValue: "category1" }).id;
          const element1 = insertPhysicalElement({ builder, modelId: model1, categoryId: category1 }).id;
          const element2 = insertPhysicalElement({ builder, modelId: model1, categoryId: category1 }).id;

          const otherModel = insertPhysicalModelWithPartition({ builder, codeValue: "2" }).id;
          const otherCategory = insertSpatialCategory({ builder, codeValue: "category2" }).id;
          insertPhysicalElement({ builder, modelId: otherModel, categoryId: otherCategory });

          return { model1, category1, element1, element2, otherModel, otherCategory };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay(ids.model1, true);
        viewport.setAlwaysDrawn(new Set([ids.element2]), true);

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: (id) => (id === ids.model1 ? "partial" : "hidden"),
            category: ({ categoryId }) => (categoryId === ids.category1 ? "partial" : "hidden"),
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.element2) ? "partial" : "hidden"),
            element: ({ elementId }) => (elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
        await handler.changeVisibility(createModelHierarchyNode({ modelId: ids.model1 }), true);

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: (id) => (id === ids.model1 ? "visible" : "hidden"),
            category: ({ categoryId }) => (categoryId === ids.category1 ? "visible" : "hidden"),
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.element1) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === ids.element1 || elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
      });

      it("changing category visibility does not affect other categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "1" }).id;
          const category1 = insertSpatialCategory({ builder, codeValue: "category1" }).id;
          const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category1 }).id;
          const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category1 }).id;

          const otherCategory = insertSpatialCategory({ builder, codeValue: "category2" }).id;
          insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });

          return { model, category1, element1, element2, otherCategory };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay(ids.model, true);
        viewport.setAlwaysDrawn(new Set([ids.element2]), true);

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => "partial",
            category: ({ categoryId }) => (categoryId === ids.category1 ? "partial" : "hidden"),
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.element2) ? "partial" : "hidden"),
            element: ({ elementId }) => (elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
        await handler.changeVisibility(createCategoryHierarchyNode({ modelId: ids.model, categoryId: ids.category1, hasChildren: true }), true);

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => "partial",
            category: ({ categoryId }) => (categoryId === ids.category1 ? "visible" : "hidden"),
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.element1) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === ids.element1 || elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
      });

      it("changing class grouping node visibility does not affect other class grouping nodes", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder, testSchema) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "1" }).id;
          const category = insertSpatialCategory({ builder, codeValue: "category1" }).id;
          const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
          const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;

          insertPhysicalElement({
            builder,
            userLabel: `element`,
            modelId: model,
            categoryId: category,
            classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
          });

          return { model, category, element1, element2 };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay(ids.model, true);
        viewport.setAlwaysDrawn(new Set([ids.element2]), true);

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => "partial",
            category: () => "partial",
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.element2) ? "partial" : "hidden"),
            element: ({ elementId }) => (elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
        await handler.changeVisibility(
          createClassGroupingHierarchyNode({ elements: [ids.element1, ids.element2], categoryId: ids.category, modelId: ids.model }),
          true,
        );

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => "partial",
            category: () => "partial",
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.element1) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === ids.element1 || elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
      });

      it("changing element visibility does not affect other elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "1" }).id;
          const category = insertSpatialCategory({ builder, codeValue: "category1", userLabel: "SomeLabel" }).id;
          const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
          const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
          insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;

          return { model, category, element1, element2 };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay(ids.model, true);
        viewport.setAlwaysDrawn(new Set([ids.element2]), true);

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => "partial",
            category: () => "partial",
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.element2) ? "partial" : "hidden"),
            element: ({ elementId }) => (elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
        await handler.changeVisibility(createElementHierarchyNode({ elementId: ids.element1, categoryId: ids.category, modelId: ids.model }), true);

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          visibilityExpectations: {
            subject: () => "partial",
            model: () => "partial",
            category: () => "partial",
            groupingNode: () => "partial",
            element: ({ elementId }) => (elementId === ids.element1 || elementId === ids.element2 ? "visible" : "hidden"),
          },
        });
      });
    });

    describe("filtered nodes", () => {
      function createFilteredVisibilityTestData({
        imodel,
        filterPaths,
      }: Parameters<typeof createVisibilityTestData>[0] & { filterPaths: HierarchyNodeIdentifiersPath[] }) {
        const commonProps = createCommonProps({ imodel });
        const filteredVisibilityHandler = createModelsTreeVisibilityHandler({ ...commonProps, filteredPaths: filterPaths });
        const defaultVisibilityHandler = createModelsTreeVisibilityHandler(commonProps);
        const defaultProvider = createProvider(commonProps);
        const filteredProvider = createProvider({ ...commonProps, filterPaths });
        return {
          defaultVisibilityHandler,
          defaultProvider,
          filteredProvider,
          filteredVisibilityHandler,
          ...commonProps,
          [Symbol.dispose]() {
            commonProps.idsCache[Symbol.dispose]();
            defaultVisibilityHandler[Symbol.dispose]();
            filteredVisibilityHandler[Symbol.dispose]();
            defaultProvider[Symbol.dispose]();
            filteredProvider[Symbol.dispose]();
            commonProps.viewport[Symbol.dispose]();
          },
        };
      }

      async function getNodeMatchingPath(provider: HierarchyProvider, identifierPath: InstanceKey[], parentNode?: HierarchyNode): Promise<HierarchyNode> {
        for (const [idx, pathKey] of identifierPath.entries()) {
          let newParentNode: HierarchyNode | undefined;
          for await (const node of provider.getNodes({ parentNode })) {
            if (HierarchyNode.isClassGroupingNode(node)) {
              if (node.key.className === pathKey.className) {
                return getNodeMatchingPath(provider, identifierPath.slice(idx + 1), node);
              }
              continue;
            }

            assert(HierarchyNode.isInstancesNode(node));
            const nodeKey = node.key.instanceKeys[0];
            if (InstanceKey.equals(nodeKey, pathKey)) {
              newParentNode = node;
              break;
            }
          }

          assert(!!newParentNode, `Couldn't find a node matching path: ${JSON.stringify(identifierPath, undefined, 2)}`);
          parentNode = newParentNode;
        }

        assert(!!parentNode, `Couldn't find a node matching path: ${JSON.stringify(identifierPath, undefined, 2)}`);
        return parentNode;
      }

      describe("single path to element", () => {
        it("showing category turns on only it and filtered children", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const filteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const unfilteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              filteredChildElement,
              unfilteredChildElement,
              parentElement,
              filterPaths: [[model, category, parentElement, filteredChildElement]],
            };
          });

          const { imodel, filterPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

          viewport.setNeverDrawn(new Set([keys.parentElement.id, keys.filteredChildElement.id, keys.unfilteredChildElement.id]));
          viewport.renderFrame();

          const node = createCategoryHierarchyNode({
            categoryId: keys.category.id,
            modelId: keys.model.id,
            parentKeys: [{ type: "instances", instanceKeys: [keys.model] }],
            filtering: {
              isFilterTarget: false,
              filteredChildrenIdentifierPaths: [[keys.parentElement], [keys.filteredChildElement]],
            },
          });
          await filteredVisibilityHandler.changeVisibility(node, true);

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler: filteredVisibilityHandler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: () => "partial",
              category: () => "partial",
              groupingNode: () => "partial",
              element: ({ elementId }) => (elementId === keys.parentElement.id ? "partial" : elementId === keys.filteredChildElement.id ? "visible" : "hidden"),
            },
          });
        });

        it("showing element turns on only it and filtered children", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const filteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const unfilteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              filteredChildElement,
              unfilteredChildElement,
              parentElement,
              filterPaths: [[model, category, parentElement, filteredChildElement]],
            };
          });

          const { imodel, filterPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;
          const node = createElementHierarchyNode({
            elementId: keys.parentElement.id,
            categoryId: keys.category.id,
            modelId: keys.model.id,
            childrenCount: 2,
            parentKeys: [
              { type: "instances", instanceKeys: [keys.model] },
              { type: "instances", instanceKeys: [keys.category] },
            ],
            filtering: {
              isFilterTarget: false,
              filteredChildrenIdentifierPaths: [[keys.filteredChildElement]],
            },
          });
          await filteredVisibilityHandler.changeVisibility(node, true);
          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler: filteredVisibilityHandler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });
          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: () => "partial",
              category: () => "partial",
              groupingNode: () => "partial",
              element: ({ elementId }) => (elementId === keys.parentElement.id ? "partial" : elementId === keys.filteredChildElement.id ? "visible" : "hidden"),
            },
          });
        });

        it("showing class grouping node turns on only it and filtered children", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const filteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const unfilteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              filteredChildElement,
              unfilteredChildElement,
              parentElement,
              filterPaths: [[model, category, parentElement, filteredChildElement]],
            };
          });

          const { imodel, filterPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;
          const node = await getNodeMatchingPath(filteredProvider, [keys.model, keys.category, keys.parentElement]);
          await filteredVisibilityHandler.changeVisibility(node, true);

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler: filteredVisibilityHandler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: () => "partial",
              category: () => "partial",
              groupingNode: () => "partial",
              element: ({ elementId }) => (elementId === keys.parentElement.id ? "partial" : elementId === keys.filteredChildElement.id ? "visible" : "hidden"),
            },
          });
        });

        it("hiding category turns off only it and filtered children", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const filteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const unfilteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              filteredChildElement,
              unfilteredChildElement,
              parentElement,
              filterPaths: [[model, category, parentElement, filteredChildElement]],
            };
          });

          const { imodel, filterPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;
          await viewport.addViewedModels(keys.model.id);
          viewport.setAlwaysDrawn(new Set([keys.parentElement.id, keys.filteredChildElement.id, keys.unfilteredChildElement.id]));
          viewport.renderFrame();

          const node = createCategoryHierarchyNode({
            categoryId: keys.category.id,
            modelId: keys.model.id,
            parentKeys: [{ type: "instances", instanceKeys: [keys.model] }],
            filtering: {
              isFilterTarget: false,
              filteredChildrenIdentifierPaths: [[keys.parentElement], [keys.filteredChildElement]],
            },
          });
          await filteredVisibilityHandler.changeVisibility(node, false);

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler: filteredVisibilityHandler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("hidden"),
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: () => "partial",
              category: () => "partial",
              groupingNode: () => "partial",
              element: ({ elementId }) =>
                elementId === keys.parentElement.id ? "partial" : elementId === keys.unfilteredChildElement.id ? "visible" : "hidden",
            },
          });
        });

        it("hiding element turns off only it and filtered children", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const filteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const unfilteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              filteredChildElement,
              unfilteredChildElement,
              parentElement,
              filterPaths: [[model, category, parentElement, filteredChildElement]],
            };
          });

          const { imodel, filterPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

          await viewport.addViewedModels(keys.model.id);
          viewport.setAlwaysDrawn(new Set([keys.parentElement.id, keys.filteredChildElement.id, keys.unfilteredChildElement.id]));
          viewport.renderFrame();

          const node = createElementHierarchyNode({
            elementId: keys.parentElement.id,
            categoryId: keys.category.id,
            modelId: keys.model.id,
            childrenCount: 2,
            parentKeys: [
              { type: "instances", instanceKeys: [keys.model] },
              { type: "instances", instanceKeys: [keys.category] },
            ],
            filtering: {
              isFilterTarget: false,
              filteredChildrenIdentifierPaths: [[keys.filteredChildElement]],
            },
          });
          await filteredVisibilityHandler.changeVisibility(node, false);

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler: filteredVisibilityHandler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("hidden"),
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: () => "partial",
              category: () => "partial",
              groupingNode: () => "partial",
              element: ({ elementId }) =>
                elementId === keys.parentElement.id ? "partial" : elementId === keys.unfilteredChildElement.id ? "visible" : "hidden",
            },
          });
        });

        it("hiding class grouping node turns on only it and filtered children", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const filteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const unfilteredChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              filteredChildElement,
              unfilteredChildElement,
              parentElement,
              filterPaths: [[model, category, parentElement, filteredChildElement]],
            };
          });

          const { imodel, filterPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

          await viewport.addViewedModels(keys.model.id);
          viewport.setAlwaysDrawn(new Set([keys.parentElement.id, keys.filteredChildElement.id, keys.unfilteredChildElement.id]));
          viewport.renderFrame();

          const node = await getNodeMatchingPath(filteredProvider, [keys.model, keys.category, keys.parentElement]);
          await filteredVisibilityHandler.changeVisibility(node, false);
          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler: filteredVisibilityHandler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("hidden"),
          });
          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: () => "partial",
              category: () => "partial",
              groupingNode: () => "partial",
              element: ({ elementId }) =>
                elementId === keys.parentElement.id ? "partial" : elementId === keys.unfilteredChildElement.id ? "visible" : "hidden",
            },
          });
        });

        it("switches on only filtered hierarchy when root node is clicked", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const filterTargetElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });

            const unfilteredCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" });
            const unfilteredModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" });
            insertPhysicalElement({ builder, modelId: unfilteredModel.id, categoryId: unfilteredCategory.id });

            return {
              model,
              category,
              filterTargetElement,
              filterPaths: [[model, category, filterTargetElement]],
            };
          });

          const { imodel, filterPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;
          const node = await getNodeMatchingPath(filteredProvider, [keys.model]);
          await filteredVisibilityHandler.changeVisibility(node, true);

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler: filteredVisibilityHandler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === keys.model.id ? "visible" : "hidden"),
              category: ({ modelId }) => (modelId === keys.model.id ? "visible" : "hidden"),
              groupingNode: ({ modelId }) => (modelId === keys.model.id ? "visible" : "hidden"),
              element: ({ modelId }) => (modelId === keys.model.id ? "visible" : "hidden"),
            },
          });
        });
      });

      describe("path to elements in different categories", () => {
        async function createIModel(context: Mocha.Context) {
          return buildIModel(context, async (builder) => {
            const filteredCategories = [
              insertSpatialCategory({ builder, codeValue: "category1" }),
              insertSpatialCategory({ builder, codeValue: "category2" }),
              insertSpatialCategory({ builder, codeValue: "category3" }),
            ];
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const paths: InstanceKey[][] = [];
            const filterTargets = new Set<Id64String>();
            filteredCategories.forEach((category) => {
              const filterTarget = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
              paths.push([model, category, filterTarget]);
              filterTargets.add(filterTarget.id);

              insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            });

            const unfilteredCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" });
            const unfilteredModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" });
            insertPhysicalElement({ builder, modelId: unfilteredModel.id, categoryId: unfilteredCategory.id });

            return {
              model,
              filteredCategories,
              filterPaths: paths,
              filterTargetElements: filterTargets,
            };
          });
        }

        it("switches on only filtered hierarchy when root node is clicked", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, filterPaths, filterTargetElements, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

          const node = await getNodeMatchingPath(filteredProvider, [keys.model]);
          await filteredVisibilityHandler.changeVisibility(node, true);
          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler: filteredVisibilityHandler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === keys.model.id ? "partial" : "hidden"),
              category: ({ modelId }) => (modelId === keys.model.id ? "partial" : "hidden"),
              groupingNode: ({ modelId }) => (modelId === keys.model.id ? "partial" : "hidden"),
              element: ({ elementId }) => (filterTargetElements.has(elementId) ? "visible" : "hidden"),
            },
          });
        });

        it("switches on only filtered hierarchy when one of the filtered categories is clicked", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, filterPaths, filteredCategories, filterTargetElements, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

          const pathToCategory = [keys.model, filteredCategories[0]];
          const node = await getNodeMatchingPath(filteredProvider, pathToCategory);
          await filteredVisibilityHandler.changeVisibility(node, true);

          const clickedCategoryId = filteredCategories[0].id;

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler: filteredVisibilityHandler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: () => "partial",
              category: ({ categoryId }) => (categoryId === clickedCategoryId ? "visible" : "hidden"),
              groupingNode: ({ categoryId }) => (categoryId === clickedCategoryId ? "visible" : "hidden"),
              element: ({ categoryId }) => (categoryId === clickedCategoryId ? "visible" : "hidden"),
            },
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            visibilityExpectations: {
              subject: () => "partial",
              model: (id) => (id === keys.model.id ? "partial" : "hidden"),
              category: ({ categoryId }) => (categoryId === clickedCategoryId ? "partial" : "hidden"),
              groupingNode: ({ categoryId }) => (categoryId === clickedCategoryId ? "partial" : "hidden"),
              element: ({ categoryId, elementId }) => (categoryId === clickedCategoryId && filterTargetElements.has(elementId) ? "visible" : "hidden"),
            },
          });
        });
      });

      describe("multiple paths to a category and element under it", () => {
        async function createIModel(context: Mocha.Context) {
          return buildIModel(context, async (builder) => {
            const filterPaths = new Array<InstanceKey[]>();
            const subjectIds = new Array<Id64String>();
            const modelIds = new Array<Id64String>();

            const parentSubject = insertSubject({ builder, codeValue: `parent subject`, parentId: IModel.rootSubjectId });

            for (let i = 0; i < 2; ++i) {
              const subject = insertSubject({ builder, codeValue: `subject${i}`, parentId: parentSubject.id });
              const model = insertPhysicalModelWithPartition({ builder, partitionParentId: subject.id, codeValue: `model${i}` });
              const category = insertSpatialCategory({ builder, codeValue: `category${i}` });
              const elements = [
                insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id }),
                insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id }),
              ];
              subjectIds.push(subject.id);
              modelIds.push(model.id);
              filterPaths.push([parentSubject, subject, model, category], [parentSubject, subject, model, category, elements[0]]);
            }

            return {
              parentSubject,
              subjectIds,
              modelIds,
              filterPaths,
            };
          });
        }

        it("when clicking on model turns on category and all its elements", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, filterPaths, parentSubject } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

          const node = await getNodeMatchingPath(filteredProvider, [parentSubject]);
          await filteredVisibilityHandler.changeVisibility(node, true);

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler: filteredVisibilityHandler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            visibilityExpectations: VisibilityExpectations.all("visible"),
          });
        });

        it("when clicking on one of the categories it turns on only that category", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, filterPaths, parentSubject, subjectIds, modelIds } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
          const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

          const pathToCategory = filterPaths[0];
          const node = await getNodeMatchingPath(filteredProvider, pathToCategory);
          await filteredVisibilityHandler.changeVisibility(node, true);

          const visibilityExpectations: ValidateNodeProps["visibilityExpectations"] = {
            subject: (id) => {
              if (id === parentSubject.id) {
                return "partial";
              }
              return id === subjectIds[0] ? "visible" : "hidden";
            },
            model: (id) => (id === modelIds[0] ? "visible" : "hidden"),
            category: ({ modelId }) => (modelId === modelIds[0] ? "visible" : "hidden"),
            groupingNode: ({ modelId }) => (modelId === modelIds[0] ? "visible" : "hidden"),
            element: ({ modelId }) => (modelId === modelIds[0] ? "visible" : "hidden"),
          };

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler: filteredVisibilityHandler,
            viewport,
            visibilityExpectations,
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            visibilityExpectations,
          });
        });
      });

      it("class grouping node visibility only takes into account grouped elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const schemaContentXml = `
            <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
            <ECEntityClass typeName="PhysicalElement1">
              <BaseClass>bis:PhysicalElement</BaseClass>
            </ECEntityClass>
            <ECEntityClass typeName="PhysicalElement2">
              <BaseClass>bis:PhysicalElement</BaseClass>
            </ECEntityClass>
          `;

          const { PhysicalElement1, PhysicalElement2 } = (
            await importSchema({
              mochaContext: this,
              builder,
              schemaContentXml,
              schemaAlias: "test1",
            })
          ).items;

          const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
          const category = insertSpatialCategory({ builder, codeValue: "category1" });
          const element1 = insertPhysicalElement({ builder, classFullName: PhysicalElement1.fullName, modelId: model.id, categoryId: category.id });
          const element2 = insertPhysicalElement({ builder, classFullName: PhysicalElement2.fullName, modelId: model.id, categoryId: category.id });

          const paths = [
            [model, category, element1],
            [model, category, element2],
          ];

          return {
            firstElement: element1.id,
            pathToFirstElement: paths[0],
            filterPaths: paths,
          };
        });

        const { imodel, filterPaths, firstElement, pathToFirstElement } = buildIModelResult;
        using visibilityTestData = createFilteredVisibilityTestData({ imodel, filterPaths });
        const { defaultVisibilityHandler, filteredVisibilityHandler, viewport, defaultProvider, filteredProvider } = visibilityTestData;

        const node = await getNodeMatchingPath(filteredProvider, pathToFirstElement);
        await filteredVisibilityHandler.changeVisibility(node, true);

        const visibilityExpectations: ValidateNodeProps["visibilityExpectations"] = {
          subject: () => "partial",
          model: () => "partial",
          category: () => "partial",
          groupingNode: ({ elementIds }) => (elementIds.includes(firstElement) ? "visible" : "hidden"),
          element: ({ elementId }) => (elementId === firstElement ? "visible" : "hidden"),
        };

        await validateHierarchyVisibility({
          provider: filteredProvider,
          handler: filteredVisibilityHandler,
          viewport,
          visibilityExpectations,
        });

        await validateHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          visibilityExpectations,
        });
      });
    });
  });
});

/** Copied from https://github.com/iTwin/appui/blob/c3683b8acef46572c661c4fa1b7933747a76d3c1/apps/test-providers/src/createBlankConnection.ts#L26 */
function createBlankViewState(iModel: IModelConnection) {
  const ext = iModel.projectExtents;
  const viewState = SpatialViewState.createBlank(iModel, ext.low, ext.high.minus(ext.low));

  viewState.setAllow3dManipulations(true);

  viewState.displayStyle.backgroundColor = ColorDef.white;
  const flags = viewState.viewFlags.copy({
    grid: false,
    renderMode: RenderMode.SmoothShade,
    backgroundMap: false,
  });
  viewState.displayStyle.viewFlags = flags;

  IModelApp.viewManager.onViewOpen.addOnce((vp) => {
    if (vp.view.hasSameCoordinates(viewState)) {
      vp.applyViewState(viewState);
    }
  });

  return viewState;
}

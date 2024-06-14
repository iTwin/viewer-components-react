/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { EMPTY, expand, filter, first, from, mergeMap, shareReplay } from "rxjs";
import sinon from "sinon";
import { assert, using } from "@itwin/core-bentley";
import { Code, ColorDef, IModel, RenderMode } from "@itwin/core-common";
import {
  IModelApp, NoRenderApp, OffScreenViewport, PerModelCategoryVisibility, SnapshotConnection, SpatialViewState, ViewRect,
} from "@itwin/core-frontend";
import { SchemaContext, SchemaJsonLocater } from "@itwin/ecschema-metadata";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createHierarchyProvider, createLimitingECSqlQueryExecutor, HierarchyNode } from "@itwin/presentation-hierarchies";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import {
  HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { toVoidPromise } from "../../../../../components/trees/common/Rxjs";
import { ModelsTreeIdsCache } from "../../../../../components/trees/stateless/models-tree/internal/ModelsTreeIdsCache";
import { createModelsTreeVisibilityHandler } from "../../../../../components/trees/stateless/models-tree/internal/ModelsTreeVisibilityHandler";
import { createVisibilityStatus } from "../../../../../components/trees/stateless/models-tree/internal/Tooltip";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../../../components/trees/stateless/models-tree/ModelsTreeDefinition";
import {
  buildIModel, createLocalIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertPhysicalPartition, insertPhysicalSubModel,
  insertSpatialCategory,
} from "../../../../IModelUtils";
import { TestUtils } from "../../../../TestUtils";
import { createFakeSinonViewport } from "../../../Common";
import {
  createCategoryHierarchyNode, createClassGroupingHierarchyNode, createElementHierarchyNode, createFakeIdsCache, createModelHierarchyNode,
  createSubjectHierarchyNode,
} from "../../Common";

import type { BackendTestIModelBuilder } from "../../../../IModelUtils";
import type { Observable } from "rxjs";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { Id64String } from "@itwin/core-bentley";
import type { GeometricElement3dProps } from "@itwin/core-common";
import type {
  ModelsTreeVisibilityHandler,
  ModelsTreeVisibilityHandlerProps,
} from "../../../../../components/trees/stateless/models-tree/internal/ModelsTreeVisibilityHandler";
import type { Visibility } from "../../../../../components/trees/stateless/models-tree/internal/Tooltip";
import type { ClassGroupingNodeKey } from "@itwin/presentation-hierarchies/lib/cjs/hierarchies/HierarchyNodeKey";
import type { IModelDb } from "@itwin/core-backend";

interface VisibilityOverrides {
  models?: Map<Id64String, Visibility>;
  categories?: Map<Id64String, Visibility>;
  elements?: Map<Id64String, Visibility>;
}

type ModelsTreeHierarchyConfiguration = Partial<ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"]>;

describe("HierarchyBasedVisibilityHandler", () => {
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
    let createdHandlers = new Array<ModelsTreeVisibilityHandler>();

    after(() => {
      sinon.restore();
    });

    afterEach(() => {
      createdHandlers.forEach((x) => x.dispose());
      createdHandlers = [];
    });

    function createHandler(props?: { overrides?: VisibilityOverrides; idsCache?: ModelsTreeIdsCache; viewport?: Viewport }) {
      const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
        getModelDisplayStatus:
          props?.overrides?.models &&
          (async ({ id, originalImplementation }) => {
            const res = props.overrides!.models!.get(id);
            return res ? createVisibilityStatus(res) : originalImplementation();
          }),
        getCategoryDisplayStatus:
          props?.overrides?.categories &&
          (async ({ categoryId, originalImplementation }) => {
            const res = props.overrides!.categories!.get(categoryId);
            return res ? createVisibilityStatus(res) : originalImplementation();
          }),
        getElementDisplayStatus:
          props?.overrides?.elements &&
          (async ({ elementId, originalImplementation }) => {
            const res = props.overrides!.elements!.get(elementId);
            return res ? createVisibilityStatus(res) : originalImplementation();
          }),
        changeCategoryState: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
        changeModelState: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
        changeElementState: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
      };
      const handler = createModelsTreeVisibilityHandler({
        viewport: props?.viewport ?? createFakeSinonViewport(),
        overrides,
        idsCache: props?.idsCache ?? createFakeIdsCache(),
      });
      return {
        handler,
        overrides,
      };
    }

    describe("overridden methods", () => {
      it("can call original implementation", async () => {
        let useOriginalImplFlag = false;
        const viewport = createFakeSinonViewport();
        const handler = createModelsTreeVisibilityHandler({
          viewport,
          idsCache: createIdsCache(viewport.iModel),
          overrides: {
            getElementDisplayStatus: async ({ originalImplementation }) => {
              return useOriginalImplFlag ? originalImplementation() : createVisibilityStatus("hidden");
            },
          },
        });

        const node = createElementHierarchyNode({ modelId: "0x1", categoryId: "0x2", elementId: "0x3" });
        await expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "hidden" });

        useOriginalImplFlag = true;
        await expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "visible" });
      });
    });

    describe("getVisibilityStatus", () => {
      it("returns disabled when node is not an instance node", async () => {
        const node: HierarchyNode = {
          key: {
            type: "label-grouping",
            label: "",
          },
          children: false,
          groupedInstanceKeys: [],
          label: "",
          parentKeys: [],
        };

        const { handler } = createHandler();
        const result = await handler.getVisibilityStatus(node);
        expect(result).to.include({ state: "hidden", isDisabled: true });
      });

      describe("subject", () => {
        it("can be overridden", async () => {
          const overrides = {
            getSubjectNodeVisibility: sinon.fake.resolves(createVisibilityStatus("visible")),
          };
          const viewport = createFakeSinonViewport();
          const handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache: createIdsCache(viewport.iModel),
            overrides,
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
          const { handler } = createHandler({ viewport });
          const result = await handler.getVisibilityStatus(node);
          expect(viewport.view.isSpatialView).to.be.called;
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });

        it("is visible when subject contains no models", async () => {
          const subjectIds = ["0x1", "0x2"];
          const node = createSubjectHierarchyNode(...subjectIds);
          const idsCache = createFakeIdsCache({
            subjectsHierarchy: new Map([["0x0", subjectIds]]),
          });
          const { handler } = createHandler({ idsCache });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible when all models are displayed", async () => {
          const subjectIds = ["0x1", "0x2"];
          const node = createSubjectHierarchyNode(...subjectIds);
          const idsCache = createFakeIdsCache({
            subjectsHierarchy: new Map([["0x0", subjectIds]]),
            subjectModels: new Map([
              [subjectIds[0], ["0x3"]],
              [subjectIds[1], ["0x4"]],
            ]),
          });
          const { handler } = createHandler({
            idsCache,
            overrides: {
              models: new Map([
                ["0x3", "visible"],
                ["0x4", "visible"],
              ]),
            },
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden when all models are hidden", async () => {
          const subjectIds = ["0x1", "0x2"];
          const node = createSubjectHierarchyNode(...subjectIds);
          const idsCache = createFakeIdsCache({
            subjectsHierarchy: new Map([["0x0", subjectIds]]),
            subjectModels: new Map([
              [subjectIds[0], ["0x3"]],
              [subjectIds[1], ["0x4"]],
            ]),
          });
          const { handler } = createHandler({
            idsCache,
            overrides: {
              models: new Map([
                ["0x3", "hidden"],
                ["0x4", "hidden"],
              ]),
            },
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is partially visible when at least one model is displayed and at least one model is hidden", async () => {
          const subjectIds = ["0x1", "0x2"];
          const node = createSubjectHierarchyNode(...subjectIds);
          const idsCache = createFakeIdsCache({
            subjectsHierarchy: new Map([["0x0", subjectIds]]),
            subjectModels: new Map([
              [subjectIds[0], ["0x3"]],
              [subjectIds[1], ["0x4"]],
            ]),
          });
          const { handler } = createHandler({
            idsCache,
            overrides: {
              models: new Map([
                ["0x3", "visible"],
                ["0x4", "hidden"],
              ]),
            },
          });
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
          const { handler } = createHandler({ viewport });
          const result = await handler.getVisibilityStatus(node);
          expect(viewport.view.isSpatialView).to.be.called;
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });

        it("doesn't query model element count if always/never drawn sets are empty and exclusive mode is off", async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelHierarchyNode(modelId);
          const idsCache = createFakeIdsCache({
            modelCategories: new Map([[modelId, categories]]),
            categoryElements: new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]),
          });
          const { handler } = createHandler({
            idsCache,
          });

          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
          expect(idsCache.getModelElementCount).not.to.be.called;
        });

        describe("visible", () => {
          it("when enabled and has no categories", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const { handler } = createHandler();
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });

          it("when enabled and all categories are displayed", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
            });
            const { handler } = createHandler({
              idsCache,
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });

          it("when all elements are in the exclusive always drawn list", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const modelCategories = new Map([[modelId, categories]]);
            const categoryElements = new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]);
            const idsCache = createFakeIdsCache({
              modelCategories,
              categoryElements,
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                isAlwaysDrawnExclusive: true,
                alwaysDrawn: new Set([...categoryElements.values()].flat()),
                queryHandler: () =>
                  [...categoryElements].flatMap(([categoryId, elements]) => {
                    return elements.map((elementId) => ({ elementId, categoryId, modelId }));
                  }),
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });

          it("when always drawn list is empty", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set(),
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });

          it("when all categories are displayed and always/never drawn lists contain no elements", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set(["0xfff"]),
                neverDrawn: new Set(["0xeee"]),
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });
        });

        describe("hidden", () => {
          it("when `viewport.view.viewsModel` returns false", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const { handler } = createHandler({
              viewport: createFakeSinonViewport({
                view: {
                  viewsModel: sinon.fake.returns(false),
                },
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("all categories are hidden", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                view: {
                  viewsCategory: sinon.fake.returns(false),
                },
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when all elements are in never drawn list", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const modelCategories = new Map([[modelId, ["0x10", "0x20"]]]);
            const categoryElements = new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]);
            const idsCache = createFakeIdsCache({
              modelCategories,
              categoryElements,
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                neverDrawn: new Set([...categoryElements.values()].flat()),
                queryHandler: () =>
                  [...categoryElements].flatMap(([categoryId, elements]) => {
                    return elements.map((elementId) => ({ elementId, categoryId, modelId }));
                  }),
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when none of the elements are in exclusive always drawn list", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const modelCategories = new Map([[modelId, ["0x10", "0x20"]]]);
            const categoryElements = new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]);
            const idsCache = createFakeIdsCache({
              modelCategories,
              categoryElements,
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set(["0xffff"]),
                isAlwaysDrawnExclusive: true,
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when in exclusive always drawn list is empty", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const modelCategories = new Map([[modelId, ["0x10", "0x20"]]]);
            const categoryElements = new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]);
            const idsCache = createFakeIdsCache({
              modelCategories,
              categoryElements,
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                isAlwaysDrawnExclusive: true,
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when all categories are hidden and always/never drawn lists contain no children", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                view: { viewsCategory: sinon.fake.returns(false) },
                alwaysDrawn: new Set(["0xfff"]),
                neverDrawn: new Set(["0xeee"]),
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });
        });

        describe("partially visible", () => {
          it("when at least one category is hidden", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                view: {
                  viewsCategory: sinon.fake((id) => id === categories[0]),
                },
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when some of the elements are in never drawn list", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                neverDrawn: new Set(["0x100"]),
                queryHandler: () => [{ elementId: "0x100", modelId, categoryId: "0xff" }],
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when some of the elements are not in the exclusive always drawn list", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                isAlwaysDrawnExclusive: true,
                alwaysDrawn: new Set(["0x100"]),
                queryHandler: () => [{ elementId: "0x100", modelId, categoryId: "0xff" }],
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when some categories are visible, some hidden and always/never drawn lists contain no children", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const idsCache = createFakeIdsCache({
              modelCategories: new Map([[modelId, categories]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            const { handler } = createHandler({
              idsCache,
              viewport: createFakeSinonViewport({
                view: { viewsCategory: sinon.fake((id) => id === categories[0]) },
                alwaysDrawn: new Set(["0xfff"]),
                neverDrawn: new Set(["0xeee"]),
              }),
            });
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
          const handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache: createIdsCache(viewport.iModel),
            overrides,
          });

          const status = await handler.getVisibilityStatus(createCategoryHierarchyNode("0x1"));
          expect(overrides.getCategoryDisplayStatus).to.be.called;
          expect(status.state).to.eq("visible");
        });

        it("doesn't query elements if model is hidden", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryHierarchyNode(modelId, categoryId);
          const idsCache = createFakeIdsCache({
            modelCategories: new Map([[modelId, [categoryId]]]),
            categoryElements: new Map([[categoryId, ["0x100", "0x200"]]]),
          });
          const { handler } = createHandler({
            idsCache,
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x400"]),
              view: {
                viewsModel: sinon.fake.returns(false),
              },
            }),
          });

          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
          expect(idsCache.getModelElementCount).not.to.be.called;
        });

        describe("is visible", () => {
          it("when `viewport.view.viewsCategory` returns TRUE and there are NO elements in the NEVER drawn list", async () => {
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode("0x1", categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                view: {
                  viewsCategory: sinon.fake.returns(true),
                },
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });

          it("when there's a per model category override to SHOW and there are NO elements in the NEVER drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                perModelCategoryVisibility: {
                  getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Show),
                },
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });
        });

        describe("is hidden", () => {
          it("when model is hidden", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                view: {
                  viewsModel: sinon.fake.returns(false),
                },
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("`viewport.view.viewsCategory` returns FALSE and there ARE NO elements in the ALWAYS drawn list", async () => {
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode("0x1", categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                view: {
                  viewsCategory: sinon.fake.returns(false),
                },
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when `viewport.view.viewsCategory` returns TRUE and there ARE UNRELATED elements in the EXCLUSIVE ALWAYS drawn list", async () => {
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode("0x1", categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set(["0x4"]),
                isAlwaysDrawnExclusive: true,
                view: {
                  viewsCategory: sinon.fake.returns(true),
                },
                queryHandler: () => [{ elementId: "0x4", modelId: "0xff", categoryId: "0xff" }],
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when `viewport.view.viewsCategory` returns TRUE and ALL elements are in the NEVER drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                neverDrawn: new Set(elements),
                view: {
                  viewsCategory: sinon.fake.returns(true),
                },
                queryHandler: () => elements.map((elementId) => ({ elementId, modelId, categoryId })),
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when there's a per model category override to HIDE and there ARE NO elements in the ALWAYS drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                perModelCategoryVisibility: {
                  getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Hide),
                },
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });

          it("when there's a per model category override to SHOW and there ARE UNRELATED elements in the EXCLUSIVE ALWAYS drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set(["0x4"]),
                isAlwaysDrawnExclusive: true,
                perModelCategoryVisibility: {
                  getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Show),
                },
                queryHandler: () => [{ elementId: "0x4", modelId: "0xff", categoryId: "0xff" }],
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "hidden" });
          });
        });

        describe("is partially visible", () => {
          it("when `viewport.view.viewsCategory` returns TRUE and there ARE SOME elements in the NEVER drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                neverDrawn: new Set([elements[0]]),
                view: {
                  viewsCategory: sinon.fake.returns(true),
                },
                queryHandler: () => [{ elementId: elements[0], modelId, categoryId }],
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when `viewport.view.viewsCategory` returns FALSE and there ARE SOME elements in the ALWAYS drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set([elements[0]]),
                view: {
                  viewsCategory: sinon.fake.returns(false),
                },
                queryHandler: () => [{ elementId: elements[0], modelId, categoryId }],
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when there's a per model category override to SHOW and there ARE SOME elements in the NEVER drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                neverDrawn: new Set([elements[0]]),
                perModelCategoryVisibility: {
                  getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Show),
                },
                queryHandler: () => [{ elementId: elements[0], modelId, categoryId }],
              }),
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "partial" });
          });

          it("when there's a per model category override to HIDE and there ARE SOME elements in the ALWAYS drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createHandler({
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeSinonViewport({
                alwaysDrawn: new Set([elements[0]]),
                perModelCategoryVisibility: {
                  getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Hide),
                },
                queryHandler: () => [{ elementId: elements[0], modelId, categoryId }],
              }),
            });
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
          const handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache: createIdsCache(viewport.iModel),
            overrides,
          });

          const status = await handler.getVisibilityStatus(createElementHierarchyNode({ modelId: "0x1", categoryId: "0x2", elementId: "0x3" }));
          expect(overrides.getElementDisplayStatus).to.be.called;
          expect(status.state).to.eq("visible");
        });

        it("is disabled when has no category or model", async () => {
          const { handler } = createHandler();
          let result = await handler.getVisibilityStatus(createElementHierarchyNode({ modelId: undefined, categoryId: undefined }));
          expect(result.isDisabled).to.be.true;
          result = await handler.getVisibilityStatus(createElementHierarchyNode({ modelId: "0x1", categoryId: undefined }));
          expect(result.isDisabled).to.be.true;
        });

        it("is hidden when model is hidden", async () => {
          const node = createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId });
          const viewport = createFakeSinonViewport({
            view: {
              viewsModel: sinon.fake.returns(false),
            },
          });
          const { handler } = createHandler({ viewport });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is visible when model and category is displayed", async () => {
          const node = createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId });
          const viewport = createFakeSinonViewport({
            view: {
              viewsModel: sinon.fake.returns(true),
              viewsCategory: sinon.fake.returns(true),
            },
          });
          const { handler } = createHandler({
            viewport,
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible if present in the always drawn list", async () => {
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const { handler } = createHandler({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set([elementId]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden if present in the never drawn list", async () => {
          const { handler } = createHandler({
            viewport: createFakeSinonViewport({
              neverDrawn: new Set([elementId]),
            }),
          });
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is hidden if other elements are present in the always drawn list and exclusive mode is enabled", async () => {
          const { handler } = createHandler({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x20"]),
              isAlwaysDrawnExclusive: true,
            }),
          });
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is visible when not present in always/never drawn sets", async () => {
          const { handler } = createHandler({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(),
              neverDrawn: new Set(),
            }),
          });
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible when always/never drawn sets are undefined", async () => {
          const { handler } = createHandler();
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible when always/never drawn sets doesn't contain it", async () => {
          const { handler } = createHandler({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0xff"]),
              neverDrawn: new Set(["0xffff"]),
            }),
          });
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden if category has per model override to hide", async () => {
          const { handler } = createHandler({
            viewport: createFakeSinonViewport({
              perModelCategoryVisibility: {
                getOverride: () => PerModelCategoryVisibility.Override.Hide,
              },
            }),
          });
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
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
          const handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache: createIdsCache(viewport.iModel),
            overrides,
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
          });
          const { handler } = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
            overrides: {
              elements: new Map(elementIds.map((x) => [x, "visible"])),
            },
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden if all node elements are hidden", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
          });
          const { handler } = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(elementIds),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is partially visible if some node elements are hidden", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
          });
          const { handler } = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set([elementIds[0]]),
              neverDrawn: new Set([elementIds[1]]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });

        it("is visible if always/never drawn sets are empty", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
          });
          const { handler } = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible if always drawn set contains no elements of the grouping node", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
          });
          const { handler } = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0xfff"]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible if never drawn set contains no elements of the grouping node", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
          });
          const { handler } = createHandler({
            idsCache: createFakeIdsCache({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(["0xfff"]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("uses category visibility when always/never drawn lists are empty", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
          });

          for (const categoryOn of [true, false]) {
            const { handler } = createHandler({
              viewport: createFakeSinonViewport({
                view: { viewsCategory: sinon.fake.returns(categoryOn) },
              }),
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elementIds]]),
              }),
            });
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
          const handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache: createIdsCache(viewport.iModel),
            overrides,
          });

          await handler.changeVisibility(createSubjectHierarchyNode("0x1"), true);
          expect(overrides.changeSubjectNodeState).to.be.called;
        });

        describe("on", () => {
          it("marks all models as visible", async () => {
            const subjectIds = ["0x1", "0x2"];
            const modelIds = [
              ["0x3", "0x4"],
              ["0x5", "0x6"],
            ];
            const node = createSubjectHierarchyNode(...subjectIds);
            const viewport = createFakeSinonViewport();
            const { handler, overrides } = createHandler({
              idsCache: createFakeIdsCache({
                subjectModels: new Map(subjectIds.map((id, idx) => [id, modelIds[idx]])),
              }),
              viewport,
            });

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
            const node = createSubjectHierarchyNode(...subjectIds);
            const { handler, overrides } = createHandler({
              idsCache: createFakeIdsCache({
                subjectModels: new Map(subjectIds.map((id, idx) => [id, modelIds[idx]])),
              }),
            });

            await handler.changeVisibility(node, false);
            expect(overrides.changeModelState).to.be.calledOnceWith(sinon.match({ ids: sinon.match.array.deepEquals(modelIds.flat()), on: false }));
          });
        });
      });

      describe("model", () => {
        describe("on", () => {
          it("adds it to the viewport", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const viewport = createFakeSinonViewport();
            const { handler } = createHandler({ viewport });
            await handler.changeVisibility(node, true);
            expect(viewport.addViewedModels).to.be.calledOnceWith(modelId);
          });

          it("doesn't change always/never drawn sets if they don't have any of the model's children", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const viewport = createFakeSinonViewport({
              alwaysDrawn: new Set(["abcd", "efgh"]),
              neverDrawn: new Set(["1234", "3456"]),
            });
            const { handler } = createHandler({
              viewport,
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
                categoryElements: new Map([
                  ["0x10", ["0x100", "0x200"]],
                  ["0x20", ["0x300", "0x400"]],
                ]),
              }),
            });
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
            const node = createModelHierarchyNode(modelId);
            const viewport = createFakeSinonViewport({
              alwaysDrawn: new Set([...alwaysDrawnElements, otherAlwaysDrawnElement]),
              neverDrawn: new Set([...neverDrawnElements, otherNeverDrawnElement]),
              queryHandler: sinon
                .stub()
                .onFirstCall()
                .returns([
                  ...alwaysDrawnElements.map((elementId) => ({ elementId, modelId, categoryId })),
                  { elementId: otherAlwaysDrawnElement, modelId: otherModelId, categoryId: otherCategoryId },
                ])
                .onSecondCall()
                .returns([
                  ...neverDrawnElements.map((elementId) => ({ elementId, modelId, categoryId })),
                  { elementId: otherNeverDrawnElement, modelId: otherModelId, categoryId: otherCategoryId },
                ]),
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
            const { handler } = createHandler({ viewport, idsCache });
            await handler.changeVisibility(node, true);
            expect(viewport.alwaysDrawn).to.deep.eq(new Set([otherAlwaysDrawnElement]));
            expect(viewport.neverDrawn).to.deep.eq(new Set([otherNeverDrawnElement]));
          });

          it(`removes per model category overrides`, async () => {
            const modelId = "0x1";
            const categoryIds = ["0x2", "0x3", "0x4"];
            const node = createModelHierarchyNode(modelId);
            const viewport = createFakeSinonViewport();
            const { handler } = createHandler({
              viewport,
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, categoryIds]]),
              }),
            });
            await handler.changeVisibility(node, true);

            expect(viewport.perModelCategoryVisibility.clearOverrides).to.be.calledWith(modelId);
          });
        });

        describe("off", () => {
          it("removes it from the viewport", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const viewport = createFakeSinonViewport();
            const { handler } = createHandler({ viewport });
            await handler.changeVisibility(node, false);
            expect(viewport.changeModelDisplay).to.be.calledOnceWith(modelId, false);
          });
        });
      });

      describe("category", () => {
        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            changeCategoryState: sinon.fake.resolves(undefined),
          };
          const viewport = createFakeSinonViewport();
          const handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache: createIdsCache(viewport.iModel),
            overrides,
          });

          await handler.changeVisibility(createCategoryHierarchyNode("0x1"), true);
          expect(overrides.changeCategoryState).to.be.called;
        });

        describe("on", () => {
          it("removes HIDE override if model is shown", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const viewport = createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(false),
              },
              perModelCategoryVisibility: {
                getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Hide),
              },
            });
            const { handler } = createHandler({ viewport });

            await handler.changeVisibility(node, true);
            expect(viewport.perModelCategoryVisibility.setOverride).to.be.calledWith(modelId, categoryId, PerModelCategoryVisibility.Override.None);
          });

          it("sets SHOW override if model is shown but category is hidden in selector", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const viewport = createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(true),
                viewsCategory: sinon.fake.returns(false),
              },
              perModelCategoryVisibility: {
                getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.None),
              },
            });
            const { handler } = createHandler({ viewport });

            await handler.changeVisibility(node, true);
            expect(viewport.perModelCategoryVisibility.setOverride).to.be.calledWith(modelId, categoryId, PerModelCategoryVisibility.Override.Show);
          });
        });

        describe("off", () => {
          it("sets HIDE override if model is visible", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const viewport = createFakeSinonViewport({
              viewsModel: sinon.fake.returns(true),
            });
            const { handler } = createHandler({ viewport });

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
            changeElementState: sinon.fake.resolves(undefined),
          };
          const viewport = createFakeSinonViewport();
          const handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache: createIdsCache(viewport.iModel),
            overrides,
          });

          await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, elementId }), true);
          expect(overrides.changeElementState).to.be.called;
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
            const { handler } = createHandler({ viewport });
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
            const { handler } = createHandler({ viewport });
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
            const { handler } = createHandler({ viewport });
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
            const { handler } = createHandler({
              viewport,
              overrides: {
                models: new Map([[modelId, "hidden"]]),
              },
            });
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
            const { handler } = createHandler({
              viewport,
            });

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
            const { handler } = createHandler({ viewport });
            await handler.changeVisibility(node, false);
            expect(viewport.alwaysDrawn?.size ?? 0).to.eq(0);
          });

          it("adds element to the never drawn list if model is visible", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            const viewport = createFakeSinonViewport();
            const { handler } = createHandler({ viewport });
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
            const { handler } = createHandler({ viewport });
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
            const { handler } = createHandler({ viewport });
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
          const handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache: createIdsCache(viewport.iModel),
            overrides,
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
            const { handler } = createHandler({
              idsCache,
              viewport,
            });

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
    let iModelPath: string;
    let iModel: IModelDb;
    let iModelConnection: IModelConnection;
    let firstModelId: Id64String;
    let otherModelId: Id64String;
    let emptyModelId: Id64String;
    let configurationModelId: Id64String;
    let configurationModelElementClassName: string;
    const models = new Map<Id64String, Id64String[]>();
    const categoryParentElements = new Map<Id64String, Id64String[]>();
    const elementHierarchy = new Map<Id64String, Set<Id64String>>();

    /**
     * Creates physical model that has one spatial category that contains contains 3 child elements
     * out of which the first and second belong to the same custom class while the last element is of class `PhysicalObject`
     * */
    function createHierarchyConfigurationModel(builder: BackendTestIModelBuilder, customClassName: string) {
      const partitionId = insertPhysicalPartition({ builder, codeValue: "ConfigurationPhysicalModel ", parentId: IModel.rootSubjectId }).id;
      const modelId = insertPhysicalSubModel({ builder, modeledElementId: partitionId }).id;
      const modelCategories = new Array<string>();

      const categoryId = insertSpatialCategory({ builder, codeValue: `ConfigurationSpatialCategory` }).id;
      modelCategories.push(categoryId);
      const elements: string[] = [];

      for (let childIdx = 0; childIdx < 3; ++childIdx) {
        const props: GeometricElement3dProps = {
          model: modelId,
          category: categoryId,
          code: new Code({ scope: partitionId, spec: "", value: `Configuration_${customClassName}_${childIdx}` }),
          classFullName: childIdx !== 2 ? customClassName : "Generic:PhysicalObject",
        };
        elements.push(builder.insertElement(props));
      }

      categoryParentElements.set(categoryId, elements);
      models.set(modelId, modelCategories);
    }

    before(async () => {
      await initializePresentationTesting({
        backendProps: {
          caching: {
            hierarchies: {
              mode: HierarchyCacheMode.Memory,
            },
          },
        },
        testOutputDir: path.join(__dirname, "output"),
        backendHostProps: {
          cacheDir: path.join(__dirname, "cache"),
        },
      });

      const tempFolder = path.join(__dirname, "temp");
      if (!fs.existsSync(tempFolder)) {
        fs.mkdirSync(tempFolder);
      }
      iModelPath = path.join(tempFolder, `${randomUUID()}.bim`);

      iModel = await createLocalIModel("ModelsTreeTest", iModelPath, async (builder) => {
        const schemaName = "VisibilityHandlerIntegrationTests";
        const schemaAlias = "test";
        const classNames = [...Array(3).keys()].map((i) => `ElementClass${i}`);
        const schema = `
          <?xml version="1.0" encoding="UTF-8"?>
          <ECSchema schemaName="${schemaName}" alias="${schemaAlias}" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA" />
            <ECSchemaReference name="ECDbMap" version="02.00.01" alias="ecdbmap" />
            <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />

            ${classNames
              .map(
                (className) => `
                  <ECEntityClass typeName="${className}">
                    <BaseClass>bis:GeometricElement3d</BaseClass>
                  </ECEntityClass>
                `,
              )
              .join("\n")}
          </ECSchema>
        `;
        await builder.importSchema(schema);

        const partitions = [
          insertPhysicalPartition({ builder, codeValue: "TestPhysicalModel 1", parentId: IModel.rootSubjectId }),
          insertPhysicalPartition({ builder, codeValue: "TestPhysicalModel 2", parentId: IModel.rootSubjectId }),
        ];
        for (let modelIdx = 0; modelIdx < 2; ++modelIdx) {
          const partitionId = partitions[modelIdx].id;
          const modelId = insertPhysicalSubModel({ builder, modeledElementId: partitionId }).id;
          const modelCategories = new Array<string>();

          for (let categoryIdx = 0; categoryIdx < 2; ++categoryIdx) {
            const categoryId = insertSpatialCategory({ builder, codeValue: `Test SpatialCategory ${modelIdx}_${categoryIdx}` }).id;
            modelCategories.push(categoryId);

            const parents = new Array<string>();
            for (const className of classNames) {
              const props: GeometricElement3dProps = {
                classFullName: "Generic:PhysicalObject",
                code: new Code({ scope: partitionId, spec: "", value: `${categoryIdx}_${className}` }),
                model: modelId,
                category: categoryId,
              };
              const parent = builder.insertElement(props);
              parents.push(parent);
              const elements = new Set<string>();
              for (let childIdx = 0; childIdx < 2; ++childIdx) {
                const element = builder.insertElement({
                  ...props,
                  code: new Code({ scope: partitionId, spec: "", value: `${categoryIdx}_${className}_${childIdx}` }),
                  classFullName: `test:${className}`,
                  parent: { id: parent, relClassName: "BisCore:PhysicalElementAssemblesElements" },
                });
                elements.add(element);
              }
              elementHierarchy.set(parent, elements);
            }
            categoryParentElements.set(categoryId, parents);
          }
          models.set(modelId, modelCategories);
        }

        const emptyPartitionId = insertPhysicalPartition({ builder, codeValue: "EmptyPhysicalModel", parentId: IModel.rootSubjectId }).id;
        emptyModelId = insertPhysicalSubModel({ builder, modeledElementId: emptyPartitionId }).id;
        configurationModelElementClassName = `test:${classNames[0]}`;
        createHierarchyConfigurationModel(builder, configurationModelElementClassName);
        [firstModelId, otherModelId, configurationModelId] = [...models.keys()];
      });

      iModelConnection = await SnapshotConnection.openFile(iModelPath);
    });

    after(async () => {
      await iModelConnection?.close();
      iModel?.close();
      iModelPath && fs.rmSync(iModelPath);
      await terminatePresentationTesting();
    });

    let viewport: Viewport;
    let handler: ModelsTreeVisibilityHandler;

    beforeEach(async () => {
      viewport = OffScreenViewport.create({
        view: createBlankViewState(iModelConnection),
        viewRect: new ViewRect(),
      });
    });

    afterEach(() => {
      handler.dispose();
    });

    function filterMatches(id: string, idsFilter: undefined | string | ((id: string) => boolean)) {
      if (!idsFilter) {
        return true;
      }
      if (typeof idsFilter === "string") {
        return id === idsFilter;
      }
      return idsFilter(id);
    }

    async function assertModelVisibility(props: { viewportVisibility: boolean; handlerVisibility: Visibility; modelId?: Id64String }) {
      const modelIds = props.modelId ? [props.modelId] : [...models.keys()];
      await Promise.all(
        modelIds.map(async (id) => {
          expect(viewport.view.viewsModel(id)).to.eq(props.viewportVisibility, `Model ${id} has unexpected viewport visibility`);
          const status = await handler.getVisibilityStatus(createModelHierarchyNode(id));
          expect(status.state).to.eq(props.handlerVisibility, `Model ${id} has unexpected visibility in the handler`);
        }),
      );
    }

    async function assertCategoryVisibility(props: {
      viewportVisibility?: boolean;
      perModelVisibilityOverride: "none" | "show" | "hide";
      handlerVisibility: Visibility;
      modelIdFilter?: string | ((id: string) => boolean);
      categoryIdFilter?: string | ((id: string) => boolean);
    }) {
      const overrideToString = (ovr: PerModelCategoryVisibility.Override) => {
        switch (ovr) {
          case PerModelCategoryVisibility.Override.None:
            return "none";
          case PerModelCategoryVisibility.Override.Show:
            return "show";
          case PerModelCategoryVisibility.Override.Hide:
            return "hide";
        }
      };

      const obs = from(models).pipe(
        filter(([id]) => filterMatches(id, props.modelIdFilter)),
        mergeMap(([modelId, categoryIds]) => {
          return from(categoryIds).pipe(
            filter((id) => filterMatches(id, props.categoryIdFilter)),
            mergeMap(async (categoryId) => {
              expect(viewport.view.viewsCategory(categoryId)).to.eq(!!props.viewportVisibility, `Category has unexpected viewport visibility`);
              const actualOverride = viewport.perModelCategoryVisibility.getOverride(modelId, categoryId);
              expect(overrideToString(actualOverride)).to.eq(props.perModelVisibilityOverride);
              const status = await handler.getVisibilityStatus(createCategoryHierarchyNode(modelId, categoryId));
              expect(status.state).to.eq(props.handlerVisibility, `Category ${categoryId} has unexpected visibility in the handler`);
            }),
          );
        }),
      );
      return toVoidPromise(obs);
    }

    async function assertElementsVisibility(props: {
      modelIdFilter?: string | ((id: string) => boolean);
      categoryIdFilter?: string | ((id: string) => boolean);
      elementIdFilter?: string | ((id: string) => boolean);
      visibility: Visibility;
    }) {
      const obs = from(models).pipe(
        filter(([id]) => filterMatches(id, props.modelIdFilter)),
        mergeMap(([modelId, categoryIds]) => {
          return from(categoryIds).pipe(
            filter((id) => filterMatches(id, props.categoryIdFilter)),
            mergeMap((categoryId) => {
              return from(categoryParentElements.get(categoryId)!).pipe(
                filter((id) => filterMatches(id, props.elementIdFilter)),
                mergeMap(async (elementId) => {
                  const status = await handler.getVisibilityStatus(createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId }));
                  expect(status.state).to.eq(props.visibility, `Element ${elementId} has unexpected visibility`);
                }),
              );
            }),
          );
        }),
      );
      return toVoidPromise(obs);
    }

    describe("Default hierarchy configuration", () => {
      beforeEach(() => {
        handler = createModelsTreeVisibilityHandler({
          viewport,
          idsCache: createIdsCache(viewport.iModel),
        });
      });

      describe("subject", () => {
        let node: HierarchyNode;

        before(() => (node = createSubjectHierarchyNode(iModelConnection.elements.rootSubjectId)));

        it("by default all subject models, categories and elements are hidden", async () => {
          await Promise.all([
            expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "hidden" }),
            assertModelVisibility({ viewportVisibility: false, handlerVisibility: "hidden" }),
            assertCategoryVisibility({ handlerVisibility: "hidden", perModelVisibilityOverride: "none" }),
            assertElementsVisibility({ visibility: "hidden" }),
          ]);
        });

        it("showing it makes it, all its models, categories and elements visible", async () => {
          await handler.changeVisibility(node, true);
          await Promise.all([
            expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "visible" }),
            assertModelVisibility({ viewportVisibility: true, handlerVisibility: "visible" }),
            assertCategoryVisibility({ perModelVisibilityOverride: "show", handlerVisibility: "visible" }),
            assertElementsVisibility({ visibility: "visible" }),
          ]);
        });
      });

      describe("model", () => {
        it("by default it, all its categories and elements are hidden", async () => {
          await Promise.all([
            assertModelVisibility({ viewportVisibility: false, handlerVisibility: "hidden", modelId: firstModelId }),
            assertCategoryVisibility({ handlerVisibility: "hidden", perModelVisibilityOverride: "none", modelIdFilter: firstModelId }),
            assertElementsVisibility({ visibility: "hidden", modelIdFilter: firstModelId }),
          ]);
        });

        it("showing it makes it, all its categories and elements visible", async () => {
          await handler.changeVisibility(createModelHierarchyNode(firstModelId), true);
          await Promise.all([
            assertModelVisibility({ viewportVisibility: true, handlerVisibility: "visible", modelId: firstModelId }),
            assertCategoryVisibility({ perModelVisibilityOverride: "show", handlerVisibility: "visible", modelIdFilter: firstModelId }),
            assertElementsVisibility({ visibility: "visible", modelIdFilter: firstModelId }),
          ]);
        });

        it("gets partial when it's visible and elements are added to never drawn list", async () => {
          await handler.changeVisibility(createModelHierarchyNode(firstModelId), true);

          const categoryId = getFirstValue(models.get(firstModelId)!);
          const element = getFirstValue(categoryParentElements.get(categoryId)!);
          viewport.setNeverDrawn(new Set([element]));
          viewport.renderFrame();
          await assertModelVisibility({ modelId: firstModelId, viewportVisibility: true, handlerVisibility: "partial" });
        });

        it("gets hidden when elements from other model are added to the exclusive always drawn list", async () => {
          await handler.changeVisibility(createModelHierarchyNode(firstModelId), true);
          await handler.changeVisibility(createModelHierarchyNode(otherModelId), true);

          const categoryId = getFirstValue(models.get(otherModelId)!);
          const element = getFirstValue(categoryParentElements.get(categoryId)!);
          viewport.setAlwaysDrawn(new Set([element]), true);
          viewport.renderFrame();

          await Promise.all([
            assertModelVisibility({ modelId: firstModelId, viewportVisibility: true, handlerVisibility: "hidden" }),
            assertModelVisibility({ modelId: otherModelId, viewportVisibility: true, handlerVisibility: "partial" }),
          ]);
        });
      });

      describe("category", () => {
        let modelId: Id64String;
        let categoryId: Id64String;

        before(() => {
          modelId = firstModelId;
          categoryId = getFirstValue(models.get(modelId)!.values());
        });

        it("showing category makes its model visible in the viewport and per model override for that category has to be set", async () => {
          await handler.changeVisibility(createCategoryHierarchyNode(modelId, categoryId), true);
          const categoryIdFilter = (id: string) => id === categoryId;
          await Promise.all([
            assertModelVisibility({
              modelId,
              viewportVisibility: true,
              handlerVisibility: "partial",
            }),
            assertCategoryVisibility({
              categoryIdFilter,
              perModelVisibilityOverride: "show",
              handlerVisibility: "visible",
            }),
            assertCategoryVisibility({
              modelIdFilter: modelId,
              categoryIdFilter: (id) => id !== categoryId,
              handlerVisibility: "hidden",
              perModelVisibilityOverride: "none",
            }),
            assertElementsVisibility({ visibility: "visible", categoryIdFilter: categoryId }),
            assertElementsVisibility({ visibility: "hidden", categoryIdFilter: (id) => id !== categoryId }),
          ]);
        });

        it("hiding visible category adds it to per model override list and model partially visible", async () => {
          viewport.changeCategoryDisplay(categoryId, true, true);
          await handler.changeVisibility(createModelHierarchyNode(modelId), true);
          await handler.changeVisibility(createCategoryHierarchyNode(modelId, categoryId), false);
          await Promise.all([
            assertModelVisibility({
              modelId,
              viewportVisibility: true,
              handlerVisibility: "partial",
            }),
            assertCategoryVisibility({
              categoryIdFilter: categoryId,
              viewportVisibility: true,
              perModelVisibilityOverride: "hide",
              handlerVisibility: "hidden",
            }),
            assertCategoryVisibility({
              modelIdFilter: modelId,
              categoryIdFilter: (id) => id !== categoryId,
              perModelVisibilityOverride: "show",
              handlerVisibility: "visible",
            }),
            assertElementsVisibility({
              categoryIdFilter: categoryId,
              visibility: "hidden",
            }),
            assertElementsVisibility({
              modelIdFilter: modelId,
              categoryIdFilter: (id) => id !== categoryId,
              visibility: "visible",
            }),
          ]);
        });

        it("gets partial when it's visible and elements are added to never drawn list", async () => {
          await handler.changeVisibility(createModelHierarchyNode(modelId), true);
          await handler.changeVisibility(createCategoryHierarchyNode(modelId, categoryId), true);
          const element = getFirstValue(categoryParentElements.get(categoryId)!.values());
          viewport.setNeverDrawn(new Set([element]));
          viewport.renderFrame();
          await assertCategoryVisibility({ categoryIdFilter: categoryId, perModelVisibilityOverride: "show", handlerVisibility: "partial" });
        });
      });

      describe("element", () => {
        let modelId: string;
        let categoryId: string;
        let elementId: string;

        before(() => {
          modelId = firstModelId;
          categoryId = getFirstValue(models.get(modelId)!.values());
          elementId = getFirstValue(categoryParentElements.get(categoryId)!.values());
        });

        it("if model is hidden, showing element makes model and category partially visible", async () => {
          const elementNode = createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId });
          await handler.changeVisibility(elementNode, true);
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId]));
          viewport.renderFrame();
          await Promise.all([
            assertModelVisibility({
              modelId,
              viewportVisibility: true,
              handlerVisibility: "partial",
            }),
            assertCategoryVisibility({
              categoryIdFilter: categoryId,
              handlerVisibility: "partial",
              perModelVisibilityOverride: "none",
            }),
            assertCategoryVisibility({
              modelIdFilter: modelId,
              categoryIdFilter: (id) => id !== categoryId,
              handlerVisibility: "hidden",
              perModelVisibilityOverride: "none",
            }),
            assertElementsVisibility({
              elementIdFilter: elementId,
              visibility: "visible",
            }),
          ]);
        });

        it("if model is hidden, showing element removes all model elements from the always drawn list", async () => {
          const elementIds = categoryParentElements.get(categoryId);
          viewport.setAlwaysDrawn(new Set(elementIds));

          const elementNode = createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId });
          await handler.changeVisibility(elementNode, true);

          expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId]));
          viewport.renderFrame();
          await Promise.all([
            assertModelVisibility({
              modelId,
              viewportVisibility: true,
              handlerVisibility: "partial",
            }),
            assertCategoryVisibility({
              categoryIdFilter: categoryId,
              handlerVisibility: "partial",
              perModelVisibilityOverride: "none",
            }),
            assertCategoryVisibility({
              modelIdFilter: modelId,
              categoryIdFilter: (id) => id !== categoryId,
              handlerVisibility: "hidden",
              perModelVisibilityOverride: "none",
            }),
            assertElementsVisibility({
              elementIdFilter: elementId,
              visibility: "visible",
            }),
          ]);
        });

        it("hiding parent element makes it hidden,  model and category partially visible, while children remain visible", async () => {
          await handler.changeVisibility(createModelHierarchyNode(modelId), true);
          await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId }), false);
          viewport.renderFrame();
          await Promise.all([
            assertElementsVisibility({
              modelIdFilter: modelId,
              categoryIdFilter: categoryId,
              elementIdFilter: elementId,
              visibility: "hidden",
            }),
            assertModelVisibility({
              modelId,
              viewportVisibility: true,
              handlerVisibility: "partial",
            }),
            assertCategoryVisibility({
              categoryIdFilter: categoryId,
              perModelVisibilityOverride: "show",
              handlerVisibility: "partial",
            }),
            assertElementsVisibility({
              modelIdFilter: modelId,
              categoryIdFilter: categoryId,
              elementIdFilter: (id) => elementHierarchy.get(elementId)!.has(id),
              visibility: "visible",
            }),
          ]);
        });
      });

      describe("grouping nodes", () => {
        const classGroups = new Array<{
          parent: HierarchyNode & { key: ClassGroupingNodeKey };
          children: Observable<HierarchyNode>;
        }>();

        before(async () => {
          const schemas = new SchemaContext();
          const locater = new SchemaJsonLocater((schemaName) => iModel.getSchemaProps(schemaName));
          schemas.addLocater(locater);
          const schemaProvider = createECSchemaProvider(schemas);
          const imodelAccess = {
            ...schemaProvider,
            ...createCachingECClassHierarchyInspector({ schemaProvider, cacheSize: 1000 }),
            ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(iModelConnection), 1000),
          };
          const idsCache = new ModelsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);
          const provider = createHierarchyProvider({
            imodelAccess,
            hierarchyDefinition: new ModelsTreeDefinition({
              imodelAccess,
              idsCache,
              hierarchyConfig: defaultHierarchyConfiguration,
            }),
          });

          const obs = from(provider.getNodes({ parentNode: undefined })).pipe(
            expand((parentNode) => {
              if (!parentNode.children) {
                return EMPTY;
              }

              let children = from(provider.getNodes({ parentNode }));
              if (HierarchyNode.isClassGroupingNode(parentNode)) {
                children = children.pipe(shareReplay());
                classGroups.push({ parent: parentNode, children });
              }
              return children;
            }),
          );
          await toVoidPromise(obs);
        });

        it("is hidden by default", async () => {
          await Promise.all(
            classGroups.map(async ({ parent }) => {
              await expect(handler.getVisibilityStatus(parent)).to.eventually.include({ state: "hidden" });
            }),
          );
        });

        it("showing node makes it and its children visible", async () => {
          classGroups.forEach(async ({ parent, children }) => {
            // eslint-disable-next-line @itwin/no-internal
            const parentClassName = parent.key.className;
            await handler.changeVisibility(parent, true);
            await expect(handler.getVisibilityStatus(parent)).to.eventually.include(
              { state: "visible" },
              `Grouping node for ${parentClassName} has unexpected visibility`,
            );

            await toVoidPromise(
              from(children).pipe(
                mergeMap(async (node) => {
                  assert(HierarchyNode.isInstancesNode(node));
                  await expect(handler.getVisibilityStatus(node)).to.eventually.include(
                    { state: "visible" },
                    `element node ${JSON.stringify(node.key.instanceKeys[0])}, grouping by ${parentClassName}`,
                  );
                }),
              ),
            );
            await handler.changeVisibility(parent, false);
            await toVoidPromise(
              from(children).pipe(
                mergeMap(async (node) => {
                  assert(HierarchyNode.isInstancesNode(node));
                  await expect(handler.getVisibilityStatus(node)).to.eventually.include(
                    { state: "hidden" },
                    `element node ${JSON.stringify(node.key.instanceKeys[0])}, grouping by ${parentClassName}`,
                  );
                }),
              ),
            );
          });
        });

        it("hiding child node makes grouping node partial", async () => {
          classGroups.forEach(async ({ parent, children }) => {
            await toVoidPromise(
              children.pipe(
                first(),
                mergeMap(async (node) => handler.changeVisibility(node, false)),
                mergeMap(() => expect(handler.getVisibilityStatus(parent)).to.eventually.include({ state: "partial" })),
              ),
            );
          });
        });
      });

      describe("child element category is different than parent's", () => {
        // TODO: these tests should be merged with the ones refactored by
        // https://github.com/iTwin/viewer-components-react/pull/931

        it("model visibility only takes into account parent element categories", async function () {
          const { imodel, modelId, parentCategoryId } = await buildIModel(this, async (builder) => {
            const parentCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
            const childCategory = insertSpatialCategory({ builder, codeValue: "childCategory" });
            const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
            insertPhysicalElement({ builder, modelId: model.id, categoryId: childCategory.id, parentId: parentElement.id });
            return { modelId: model.id, parentCategoryId: parentCategory.id };
          });
          const idsCache = createIdsCache(imodel);
          viewport = OffScreenViewport.create({
            view: createBlankViewState(imodel),
            viewRect: new ViewRect(),
          });
          const visibilityHandler = createModelsTreeVisibilityHandler({ idsCache, viewport });
          const modelNode = createModelHierarchyNode(modelId);
          const parentCategoryNode = createCategoryHierarchyNode(modelId, parentCategoryId);

          await using(visibilityHandler, async (_) => {
            await visibilityHandler.changeVisibility(parentCategoryNode, true);
            await expect(visibilityHandler.getVisibilityStatus(modelNode)).to.eventually.include({ state: "visible" });
          });
        });

        it("category visibility only takes into account element trees that start with those that have no parents", async function () {
          const { imodel, modelId, categoryId, elementId, unrelatedCategoryId } = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "parentCategory" });
            const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });
            const element = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });

            const unrelatedParentCategory = insertSpatialCategory({ builder, codeValue: "differentParentCategory" });
            const unrelatedParentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: unrelatedParentCategory.id });
            insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: unrelatedParentElement.id });

            return { modelId: model.id, categoryId: category.id, elementId: element.id, unrelatedCategoryId: unrelatedParentCategory.id };
          });
          const idsCache = createIdsCache(imodel);
          viewport = OffScreenViewport.create({
            view: createBlankViewState(imodel),
            viewRect: new ViewRect(),
          });
          const visibilityHandler = createModelsTreeVisibilityHandler({ idsCache, viewport });
          const modelNode = createModelHierarchyNode(modelId);
          const categoryNode = createCategoryHierarchyNode(modelId, categoryId);
          const elementNode = createElementHierarchyNode({ modelId, categoryId, elementId });
          const unrelatedCategoryNode = createCategoryHierarchyNode(modelId, unrelatedCategoryId);

          await using(visibilityHandler, async (_) => {
            await visibilityHandler.changeVisibility(elementNode, true);
            viewport.renderFrame();
            await expect(visibilityHandler.getVisibilityStatus(modelNode)).to.eventually.include({ state: "partial" });
            await expect(visibilityHandler.getVisibilityStatus(categoryNode)).to.eventually.include({ state: "visible" });
            await expect(visibilityHandler.getVisibilityStatus(unrelatedCategoryNode)).to.eventually.include({ state: "hidden" });
          });
        });
      });
    });

    describe("Custom Hierarchy configuration", () => {
      let customClassElement1: Id64String;
      let customClassElement2: Id64String;
      let nonCustomClassElement: Id64String;

      before(() => {
        const categoryId = getFirstValue(models.get(configurationModelId)!);
        [customClassElement1, customClassElement2, nonCustomClassElement] = categoryParentElements.get(categoryId)!;
      });

      beforeEach(async () => {
        handler = createModelsTreeVisibilityHandler({
          viewport,
          idsCache: createIdsCache(viewport.iModel, { showEmptyModels: true, elementClassSpecification: configurationModelElementClassName }),
        });
      });

      afterEach(() => {
        handler.dispose();
      });

      describe("subject with empty model", () => {
        let node: HierarchyNode;

        before(() => (node = createSubjectHierarchyNode(iModelConnection.elements.rootSubjectId)));

        it("empty model hidden by default", async () => {
          await Promise.all([
            expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "hidden" }),
            assertModelVisibility({ modelId: emptyModelId, viewportVisibility: false, handlerVisibility: "hidden" }),
          ]);
        });

        it("showing it makes empty model visible", async () => {
          await handler.changeVisibility(node, true);
          await Promise.all([
            expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "visible" }),
            assertModelVisibility({ modelId: emptyModelId, viewportVisibility: true, handlerVisibility: "visible" }),
          ]);
        });

        it("gets partial when only empty model is visible", async () => {
          await handler.changeVisibility(createModelHierarchyNode(emptyModelId), true);
          await Promise.all([
            expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "partial" }),
            assertModelVisibility({ modelId: emptyModelId, viewportVisibility: true, handlerVisibility: "visible" }),
          ]);
        });
      });

      describe("model with custom class specification elements", () => {
        it("by default it, all its categories and elements are hidden", async () => {
          await Promise.all([
            assertModelVisibility({ viewportVisibility: false, handlerVisibility: "hidden", modelId: configurationModelId }),
            assertCategoryVisibility({ handlerVisibility: "hidden", perModelVisibilityOverride: "none", modelIdFilter: configurationModelId }),
            assertElementsVisibility({ visibility: "hidden", modelIdFilter: configurationModelId }),
          ]);
        });

        it("showing it makes it, all its categories and elements visible", async () => {
          await handler.changeVisibility(createModelHierarchyNode(configurationModelId), true);
          viewport.renderFrame();
          await Promise.all([
            assertModelVisibility({ viewportVisibility: true, handlerVisibility: "visible", modelId: configurationModelId }),
            assertCategoryVisibility({ perModelVisibilityOverride: "show", handlerVisibility: "visible", modelIdFilter: configurationModelId }),
            assertElementsVisibility({ visibility: "visible", modelIdFilter: configurationModelId }),
          ]);
        });

        it("gets partial when custom class element is visible", async () => {
          const categoryId = getFirstValue(models.get(configurationModelId)!);
          await handler.changeVisibility(
            createElementHierarchyNode({ modelId: configurationModelId, categoryId, hasChildren: true, elementId: customClassElement1 }),
            true,
          );
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([customClassElement1]));
          viewport.renderFrame();
          await Promise.all([
            assertModelVisibility({ viewportVisibility: true, handlerVisibility: "partial", modelId: configurationModelId }),
            assertCategoryVisibility({ perModelVisibilityOverride: "none", handlerVisibility: "partial", modelIdFilter: configurationModelId }),
            assertElementsVisibility({ visibility: "visible", elementIdFilter: customClassElement1 }),
            assertElementsVisibility({ visibility: "hidden", elementIdFilter: customClassElement2 }),
            assertElementsVisibility({ visibility: "hidden", elementIdFilter: nonCustomClassElement }),
          ]);
        });

        it("gets visible when all custom class elements are visible", async () => {
          const categoryId = getFirstValue(models.get(configurationModelId)!);
          await handler.changeVisibility(
            createElementHierarchyNode({ modelId: configurationModelId, categoryId, hasChildren: true, elementId: customClassElement1 }),
            true,
          );
          await handler.changeVisibility(
            createElementHierarchyNode({ modelId: configurationModelId, categoryId, hasChildren: true, elementId: customClassElement2 }),
            true,
          );
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([customClassElement1, customClassElement2]));
          viewport.renderFrame();
          await Promise.all([
            assertModelVisibility({ viewportVisibility: true, handlerVisibility: "visible", modelId: configurationModelId }),
            assertCategoryVisibility({ perModelVisibilityOverride: "none", handlerVisibility: "visible", modelIdFilter: configurationModelId }),
            assertElementsVisibility({ visibility: "visible", elementIdFilter: customClassElement1 }),
            assertElementsVisibility({ visibility: "visible", elementIdFilter: customClassElement2 }),
            assertElementsVisibility({ visibility: "hidden", elementIdFilter: nonCustomClassElement }),
          ]);
        });
      });
    });
  });
});

/** Copied from https://github.com/iTwin/appui/blob/master/test-apps/appui-test-app/appui-test-handlers/src/createBlankConnection.ts#L26 */
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

function getFirstValue<T>(iterable: Iterable<T>): T {
  const iter = iterable[Symbol.iterator]();
  const iterResult = iter.next();
  if (iterResult.done) {
    throw new Error("Iterator is empty");
  }
  return iterResult.value;
}

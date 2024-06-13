/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import path from "path";
import sinon from "sinon";
import { using } from "@itwin/core-bentley";
import { ColorDef, IModel, IModelReadRpcInterface, RenderMode, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp, OffScreenViewport, PerModelCategoryVisibility, SpatialViewState, ViewRect } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createHierarchyProvider, createLimitingECSqlQueryExecutor, HierarchyNode } from "@itwin/presentation-hierarchies";
import {
  HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { ModelsTreeIdsCache } from "../../../../../components/trees/stateless/models-tree/internal/ModelsTreeIdsCache";
import { createModelsTreeVisibilityHandler } from "../../../../../components/trees/stateless/models-tree/internal/ModelsTreeVisibilityHandler";
import { createVisibilityStatus } from "../../../../../components/trees/stateless/models-tree/internal/Tooltip";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../../../components/trees/stateless/models-tree/ModelsTreeDefinition";
import {
  buildIModel, importSchema, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory, insertSubject,
} from "../../../../IModelUtils";
import { TestUtils } from "../../../../TestUtils";
import { createFakeSinonViewport, createIModelAccess } from "../../../Common";
import {
  createCategoryHierarchyNode, createClassGroupingHierarchyNode, createElementHierarchyNode, createFakeIdsCache, createModelHierarchyNode,
  createSubjectHierarchyNode,
} from "../../Common";
import { ExpectedVisibility, validateHierarchyVisibility } from "./VisibilityValidation";

import type { HierarchyNodeIdentifiersPath, HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { Id64String } from "@itwin/core-bentley";
import type {
  ModelsTreeVisibilityHandler,
  ModelsTreeVisibilityHandlerProps,
} from "../../../../../components/trees/stateless/models-tree/internal/ModelsTreeVisibilityHandler";
import type { Visibility } from "../../../../../components/trees/stateless/models-tree/internal/Tooltip";

import type { InstanceKey } from "@itwin/presentation-shared";
import type { ValidateNodeProps } from "./VisibilityValidation";
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

    function createFakeIModelAccess(): ModelsTreeVisibilityHandlerProps["imodelAccess"] {
      return {
        classDerivesFrom: sinon.fake.returns(false),
      };
    }

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
        imodelAccess: createFakeIModelAccess(),
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
          imodelAccess: createFakeIModelAccess(),
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
            imodelAccess: createFakeIModelAccess(),
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
            imodelAccess: createFakeIModelAccess(),
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
            imodelAccess: createFakeIModelAccess(),
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
            imodelAccess: createFakeIModelAccess(),
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
        rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
      });
      // eslint-disable-next-line @itwin/no-internal
      ECSchemaRpcImpl.register();

      // Logger.initializeToConsole();
      // Logger.setLevelDefault(LogLevel.Trace);
    });

    after(async () => {
      await terminatePresentationTesting();
    });

    function createHandler(imodel: IModelConnection) {
      const imodelAccess = createIModelAccess(imodel);
      const viewport = OffScreenViewport.create({
        view: createBlankViewState(imodel),
        viewRect: new ViewRect(),
      });
      const idsCache = new ModelsTreeIdsCache(imodelAccess, defaultHierarchyConfiguration);
      const handler = createModelsTreeVisibilityHandler({ imodelAccess, viewport, idsCache });
      return { handler, imodelAccess, viewport, idsCache };
    }

    function createProvider(props: {
      idsCache: ModelsTreeIdsCache;
      imodelAccess: ReturnType<typeof createIModelAccess>;
      filterPaths?: HierarchyNodeIdentifiersPath[];
    }) {
      return createHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ ...props, hierarchyConfig: defaultHierarchyConfiguration }),
        imodelAccess: props.imodelAccess,
        ...(props.filterPaths ? { filtering: { paths: props.filterPaths } } : undefined),
      });
    }

    it("by default everything is hidden", async function () {
      const { imodel } = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const modelId = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId, categoryId });
      });

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "hidden",
            model: () => ({ handler: "hidden", selector: false }),
            category: () => ({ handler: "hidden", selector: false, override: "none" }),
            groupingNode: () => "hidden",
            element: () => "hidden",
          },
        });
      });
    });

    it("showing subject makes it, all its models, categories and elements visible", async function () {
      const { imodel } = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const modelId = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId, categoryId });
      });

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        await handler.changeVisibility(createSubjectHierarchyNode(IModel.rootSubjectId), true);
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "visible",
            model: () => ({ handler: "visible", selector: true }),
            category: () => ({ handler: "visible", selector: false, override: "show" }),
            groupingNode: () => "visible",
            element: () => "visible",
          },
        });
      });
    });

    it("showing model makes it, all its categories and elements visible and doesn't affect other models", async function () {
      const { imodel, ...ids } = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId });

        const otherModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;
        insertPhysicalElement({ builder, modelId: otherModel, categoryId });
        return { model };
      });

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        await handler.changeVisibility(createModelHierarchyNode(ids.model), true);
        viewport.renderFrame();
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "partial",
            model: (id) => {
              return id === ids.model ? { handler: "visible", selector: true } : { handler: "hidden", selector: false };
            },
            category: ({ modelId }) => {
              if (modelId === ids.model) {
                return { handler: "visible", selector: false, override: "show" };
              }
              return { handler: "hidden", selector: false, override: "none" };
            },
            groupingNode: ({ modelId }) => (modelId === ids.model ? "visible" : "hidden"),
            element: ({ modelId }) => (modelId === ids.model ? "visible" : "hidden"),
          },
        });
      });
    });

    it("all parent hierarchy gets partial when it's visible and one of the elements are added to never drawn list", async function () {
      const { imodel, ...ids } = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const elements = [
          insertPhysicalElement({ builder, modelId: model, categoryId }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId }).id,
          insertPhysicalElement({ builder, modelId: model, categoryId }).id,
        ];
        return { model, hiddenElement: elements[0] };
      });

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        await handler.changeVisibility(createModelHierarchyNode(ids.model), true);
        viewport.setNeverDrawn(new Set([ids.hiddenElement]));
        viewport.renderFrame();
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "partial",
            model: () => ({ handler: "partial", selector: true }),
            category: () => ({ handler: "partial", selector: false, override: "show" }),
            groupingNode: () => "partial",
            element: ({ elementId }) => (elementId === ids.hiddenElement ? "hidden" : "visible"),
          },
        });
      });
    });

    it("hiding parent element makes it hidden, model and category partially visible, while children remain visible", async function () {
      const { imodel, ...ids } = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const parentElement = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
        const child = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: parentElement }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: child });
        return { model, category, parentElement };
      });

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        await handler.changeVisibility(createModelHierarchyNode(ids.model), true);
        viewport.renderFrame();
        await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category, elementId: ids.parentElement }), false);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "partial",
            model: () => ({ handler: "partial", selector: true }),
            category: () => ({ handler: "partial", selector: false, override: "show" }),
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.parentElement) ? "hidden" : "visible"),
            element: ({ elementId }) => (elementId === ids.parentElement ? "hidden" : "visible"),
          },
        });
      });
    });

    it("if model is hidden, showing element adds it to AD set and makes model and category visible in the viewport", async function () {
      const { imodel, ...ids } = await buildIModel(this, async (builder) => {
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

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category, elementId: ids.elementToShow }), true);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "partial",
            model: () => ({ handler: "partial", selector: true }),
            category: ({ categoryId }) =>
              categoryId === ids.category
                ? { handler: "partial", selector: false, override: "none" }
                : { handler: "hidden", selector: false, override: "none" },
            groupingNode: ({ categoryId }) => (categoryId === ids.category ? "partial" : "hidden"),
            element: ({ elementId }) => (elementId === ids.elementToShow ? "visible" : "hidden"),
          },
        });
      });
    });

    it("if model is hidden, showing element removes all other model elements from the always drawn list", async function () {
      const { imodel, ...ids } = await buildIModel(this, async (builder) => {
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

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        const elementToShow = ids.modelElements[0];
        viewport.setAlwaysDrawn(new Set(ids.allElements));
        viewport.renderFrame();

        await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category, elementId: elementToShow }), true);
        viewport.renderFrame();

        expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementToShow, ...ids.otherModelElements]));
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "partial",
            model: (id) => (id === ids.model ? { handler: "partial", selector: true } : { handler: "hidden", selector: false }),
            category: ({ modelId }) => ({ handler: modelId === ids.model ? "partial" : "hidden", selector: false, override: "none" }),
            groupingNode: ({ elementIds }) => (elementIds.includes(elementToShow) ? "partial" : "hidden"),
            element: ({ elementId }) => (elementId === elementToShow ? "visible" : "hidden"),
          },
        });
      });
    });

    it("model gets hidden when elements from other model are added to the exclusive always drawn list", async function () {
      const { imodel, ...ids } = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId });

        const exclusiveModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;
        const exclusiveElement = insertPhysicalElement({ builder, modelId: exclusiveModel, categoryId }).id;
        insertPhysicalElement({ builder, modelId: exclusiveModel, categoryId });
        return { exclusiveModel, exclusiveElement };
      });

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        await handler.changeVisibility(createSubjectHierarchyNode("0x1"), true);
        viewport.setAlwaysDrawn(new Set([ids.exclusiveElement]), true);
        viewport.renderFrame();
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "partial",
            model: (id) => {
              if (id === ids.exclusiveModel) {
                return { handler: "partial", selector: true };
              }
              return { handler: "hidden", selector: true };
            },
            category: ({ modelId }) => {
              if (modelId === ids.exclusiveModel) {
                return { handler: "partial", selector: false, override: "show" };
              }
              return { handler: "hidden", selector: false, override: "show" };
            },
            groupingNode: ({ modelId }) => (modelId === ids.exclusiveModel ? "partial" : "hidden"),
            element: ({ elementId }) => (elementId === ids.exclusiveElement ? "visible" : "hidden"),
          },
        });
      });
    });

    it("showing category makes its model visible in the viewport and per model override for that category is set to SHOW", async function () {
      const { imodel, ...ids } = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category });
        return { model, category };
      });

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        await handler.changeVisibility(createCategoryHierarchyNode(ids.model, ids.category), true);
        viewport.renderFrame();
        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "visible",
            model: () => ({ handler: "visible", selector: true }),
            category: () => ({ handler: "visible", selector: false, override: "show" }),
            groupingNode: () => "visible",
            element: () => "visible",
          },
        });
      });
    });

    it("hiding category visible in selector adds it to per model override list", async function () {
      const { imodel, ...ids } = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category });

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });
        return { model, category };
      });

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        await handler.changeVisibility(createSubjectHierarchyNode(IModel.rootSubjectId), true);
        viewport.changeCategoryDisplay(ids.category, true, true);
        viewport.renderFrame();

        await handler.changeVisibility(createCategoryHierarchyNode(ids.model, ids.category), false);
        viewport.renderFrame();

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "partial",
            model: () => ({ handler: "partial", selector: true }),
            category: ({ categoryId }) =>
              categoryId === ids.category ? { handler: "hidden", selector: true, override: "hide" } : { handler: "visible", selector: false, override: "show" },
            groupingNode: ({ categoryId }) => (categoryId === ids.category ? "hidden" : "visible"),
            element: ({ categoryId }) => (categoryId === ids.category ? "hidden" : "visible"),
          },
        });
      });
    });

    it("showing grouping node makes it and its grouped elements visible", async function () {
      const { imodel, ...ids } = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const parentElement = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
        const child = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: parentElement }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: child });

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });

        return { model, category, parentElement };
      });

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        await handler.changeVisibility(
          createClassGroupingHierarchyNode({
            modelId: ids.model,
            categoryId: ids.category,
            elements: [ids.parentElement],
          }),
          true,
        );
        viewport.renderFrame();

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "partial",
            model: () => ({ handler: "partial", selector: true }),
            category: ({ categoryId }) =>
              categoryId === ids.category
                ? { handler: "partial", selector: false, override: "none" }
                : { handler: "hidden", selector: false, override: "none" },
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.parentElement) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === ids.parentElement ? "visible" : "hidden"),
          },
        });
      });
    });

    it("hiding grouping node makes it and its grouped elements hidden", async function () {
      const { imodel, ...ids } = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const parentElement = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
        const child = insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: parentElement }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: category, parentId: child });

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory });

        return { model, category, parentElement };
      });

      const { handler, viewport, ...props } = createHandler(imodel);
      const provider = createProvider(props);
      await using(handler, async (_) => {
        await handler.changeVisibility(createSubjectHierarchyNode(IModel.rootSubjectId), true);
        viewport.renderFrame();
        await handler.changeVisibility(
          createClassGroupingHierarchyNode({
            modelId: ids.model,
            categoryId: ids.category,
            elements: [ids.parentElement],
          }),
          false,
        );
        viewport.renderFrame();

        await validateHierarchyVisibility({
          provider,
          handler,
          viewport,
          expectedVisibility: {
            subject: () => "partial",
            model: () => ({ handler: "partial", selector: true }),
            category: ({ categoryId }) => ({ handler: categoryId === ids.category ? "partial" : "visible", selector: false, override: "show" }),
            groupingNode: ({ elementIds }) => (elementIds.includes(ids.parentElement) ? "hidden" : "visible"),
            element: ({ elementId }) => (elementId === ids.parentElement ? "hidden" : "visible"),
          },
        });
      });
    });

    describe("filtered nodes", () => {
      const rootSubjectInstanceKey: InstanceKey = { id: IModel.rootSubjectId, className: "BisCore.Subject" };

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
            if (nodeKey.id === pathKey.id && nodeKey.className === pathKey.className) {
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

      const getRootNode = async (provider: HierarchyProvider) => getNodeMatchingPath(provider, [rootSubjectInstanceKey]);

      describe("single path to element", () => {
        it("switches on only filtered hierarchy when root node is clicked", async function () {
          const { imodel, filterPaths, ...keys } = await buildIModel(this, async (builder) => {
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
              filterPaths: [[rootSubjectInstanceKey, model, category, filterTargetElement]],
            };
          });

          const { handler, viewport, ...props } = createHandler(imodel);
          const defaultProvider = createProvider(props);
          const filteredProvider = createProvider({ ...props, filterPaths });

          await using(handler, async (_) => {
            const node = await getRootNode(filteredProvider);
            await handler.changeVisibility(node, true);
            viewport.renderFrame();

            await validateHierarchyVisibility({
              provider: filteredProvider,
              handler,
              viewport,
              expectedVisibility: ExpectedVisibility.all("visible"),
            });

            await validateHierarchyVisibility({
              provider: defaultProvider,
              handler,
              viewport,
              expectedVisibility: {
                subject: () => "partial",
                model: (id) => (id === keys.model.id ? "visible" : "hidden"),
                category: ({ modelId }) => (modelId === keys.model.id ? "visible" : "hidden"),
                groupingNode: ({ modelId }) => (modelId === keys.model.id ? "visible" : "hidden"),
                element: ({ modelId }) => (modelId === keys.model.id ? "visible" : "hidden"),
              },
            });
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
              paths.push([rootSubjectInstanceKey, model, category, filterTarget]);
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
          const { imodel, filterPaths, filterTargetElements, ...keys } = await createIModel(this);

          const { handler, viewport, ...props } = createHandler(imodel);
          const defaultProvider = createProvider(props);
          const filteredProvider = createProvider({ ...props, filterPaths });

          await using(handler, async (_) => {
            const node = await getRootNode(filteredProvider);
            await handler.changeVisibility(node, true);
            viewport.renderFrame();

            await validateHierarchyVisibility({
              provider: filteredProvider,
              handler,
              viewport,
              expectedVisibility: ExpectedVisibility.all("visible"),
            });

            await validateHierarchyVisibility({
              provider: defaultProvider,
              handler,
              viewport,
              expectedVisibility: {
                subject: () => "partial",
                model: (id) => (id === keys.model.id ? "partial" : "hidden"),
                category: ({ modelId }) => (modelId === keys.model.id ? "partial" : "hidden"),
                groupingNode: ({ modelId }) => (modelId === keys.model.id ? "partial" : "hidden"),
                element: ({ elementId }) => (filterTargetElements.has(elementId) ? "visible" : "hidden"),
              },
            });
          });
        });

        it("switches on only filtered hierarchy when one of the filtered categories is clicked", async function () {
          const { imodel, filterPaths, filteredCategories, filterTargetElements, ...keys } = await createIModel(this);
          const { handler, viewport, ...props } = createHandler(imodel);
          const defaultProvider = createProvider(props);
          const filteredProvider = createProvider({ ...props, filterPaths });

          await using(handler, async (_) => {
            const pathToCategory = [rootSubjectInstanceKey, keys.model, filteredCategories[0]];
            const node = await getNodeMatchingPath(filteredProvider, pathToCategory);
            await handler.changeVisibility(node, true);
            viewport.renderFrame();

            const clickedCategoryId = filteredCategories[0].id;

            await validateHierarchyVisibility({
              provider: filteredProvider,
              handler,
              viewport,
              expectedVisibility: {
                subject: () => "partial",
                model: () => "partial",
                category: ({ categoryId }) => (categoryId === clickedCategoryId ? "visible" : "hidden"),
                groupingNode: ({ categoryId }) => (categoryId === clickedCategoryId ? "visible" : "hidden"),
                element: ({ categoryId }) => (categoryId === clickedCategoryId ? "visible" : "hidden"),
              },
            });

            await validateHierarchyVisibility({
              provider: defaultProvider,
              handler,
              viewport,
              expectedVisibility: {
                subject: () => "partial",
                model: (id) => (id === keys.model.id ? "partial" : "hidden"),
                category: ({ categoryId }) => (categoryId === clickedCategoryId ? "partial" : "hidden"),
                groupingNode: ({ categoryId }) => (categoryId === clickedCategoryId ? "partial" : "hidden"),
                element: ({ categoryId, elementId }) => (categoryId === clickedCategoryId && filterTargetElements.has(elementId) ? "visible" : "hidden"),
              },
            });
          });
        });
      });

      describe("multiple paths to a category and element under it", () => {
        async function createIModel(context: Mocha.Context) {
          return buildIModel(context, async (builder) => {
            const paths = new Array<InstanceKey[]>();
            const subjectIds = new Array<Id64String>();
            const modelIds = new Array<Id64String>();

            for (let i = 0; i < 2; ++i) {
              const subject = insertSubject({ builder, codeValue: `subject${i}` });
              const model = insertPhysicalModelWithPartition({ builder, partitionParentId: subject.id, codeValue: `model${i}` });
              const category = insertSpatialCategory({ builder, codeValue: `category${i}` });
              const elements = [
                insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id }),
                insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id }),
              ];
              subjectIds.push(subject.id);
              modelIds.push(model.id);
              paths.push([rootSubjectInstanceKey, subject, model, category]);
              paths.push([rootSubjectInstanceKey, subject, model, category, elements[0]]);
            }

            return {
              subjectIds,
              modelIds,
              filterPaths: paths,
            };
          });
        }

        it("when clicking on root subject turns on category and all its elements", async function () {
          const { imodel, filterPaths } = await createIModel(this);
          const { handler, viewport, ...props } = createHandler(imodel);
          const defaultProvider = createProvider(props);
          const filteredProvider = createProvider({ ...props, filterPaths });

          await using(handler, async (_) => {
            const node = await getRootNode(filteredProvider);
            await handler.changeVisibility(node, true);
            viewport.renderFrame();

            await validateHierarchyVisibility({
              provider: filteredProvider,
              handler,
              viewport,
              expectedVisibility: ExpectedVisibility.all("visible"),
            });

            await validateHierarchyVisibility({
              provider: defaultProvider,
              handler,
              viewport,
              expectedVisibility: ExpectedVisibility.all("visible"),
            });
          });
        });

        it("when clicking on one of the categories it turns on only that category", async function () {
          const { imodel, filterPaths, subjectIds, modelIds } = await createIModel(this);
          const { handler, viewport, ...props } = createHandler(imodel);
          const defaultProvider = createProvider(props);
          const filteredProvider = createProvider({ ...props, filterPaths });

          await using(handler, async (_) => {
            const pathToCategory = filterPaths[0];
            const node = await getNodeMatchingPath(filteredProvider, pathToCategory);
            await handler.changeVisibility(node, true);
            viewport.renderFrame();

            const expectedVisibility: ValidateNodeProps["expectedVisibility"] = {
              subject: (id) => {
                if (id === rootSubjectInstanceKey.id) {
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
              handler,
              viewport,
              expectedVisibility,
            });

            await validateHierarchyVisibility({
              provider: defaultProvider,
              handler,
              viewport,
              expectedVisibility,
            });
          });
        });
      });

      it("class grouping node visibility only takes into account grouped elements", async function () {
        const { imodel, filterPaths, firstElement, pathToFirstElement } = await buildIModel(this, async (builder) => {
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
            [rootSubjectInstanceKey, model, category, element1],
            [rootSubjectInstanceKey, model, category, element2],
          ];

          return {
            firstElement: element1.id,
            pathToFirstElement: paths[0],
            filterPaths: paths,
          };
        });

        const { handler, viewport, ...props } = createHandler(imodel);
        const defaultProvider = createProvider(props);
        const filteredProvider = createProvider({ ...props, filterPaths });

        await using(handler, async (_) => {
          const node = await getNodeMatchingPath(filteredProvider, pathToFirstElement);
          await handler.changeVisibility(node, true);
          viewport.renderFrame();

          const expectedVisibility: ValidateNodeProps["expectedVisibility"] = {
            subject: () => "partial",
            model: () => "partial",
            category: () => "partial",
            groupingNode: ({ elementIds }) => (elementIds.includes(firstElement) ? "visible" : "hidden"),
            element: ({ elementId }) => (elementId === firstElement ? "visible" : "hidden"),
          };

          await validateHierarchyVisibility({
            provider: filteredProvider,
            handler,
            viewport,
            expectedVisibility,
          });

          await validateHierarchyVisibility({
            provider: defaultProvider,
            handler,
            viewport,
            expectedVisibility,
          });
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

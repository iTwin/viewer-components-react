/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { CompressedId64Set, Id64 } from "@itwin/core-bentley";
import { Code, IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createIModelHierarchyProvider, createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { BaseIdsCache } from "../../../../tree-widget-react/components/trees/common/internal/caches/BaseIdsCache.js";
import {
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_SpatialCategory,
  CLASS_NAME_Subject,
} from "../../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { createVisibilityStatus } from "../../../../tree-widget-react/components/trees/common/internal/Tooltip.js";
import { ModelsTreeIdsCache } from "../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { createModelsTreeVisibilityHandler } from "../../../../tree-widget-react/components/trees/models-tree/internal/visibility/ModelsTreeVisibilityHandler.js";
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
import { validateHierarchyVisibility } from "../../common/VisibilityValidation.js";
import { createTreeWidgetTestingViewport } from "../../TreeUtils.js";
import {
  createCategoryHierarchyNode,
  createClassGroupingHierarchyNode,
  createElementHierarchyNode,
  createFakeIdsCache,
  createModelHierarchyNode,
  createSubjectHierarchyNode,
} from "../Utils.js";
import { validateNodeVisibility } from "./VisibilityValidation.js";

import type { Id64String } from "@itwin/core-bentley";
import type { GeometricElement3dProps, QueryBinder } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { GroupingHierarchyNode, HierarchyNodeIdentifiersPath, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, InstanceKey, Props } from "@itwin/presentation-shared";
import type { Visibility } from "../../../../tree-widget-react/components/trees/common/internal/Tooltip.js";
import type { TreeWidgetViewport } from "../../../../tree-widget-react/components/trees/common/TreeWidgetViewport.js";
import type { HierarchyVisibilityHandler } from "../../../../tree-widget-react/components/trees/common/UseHierarchyVisibility.js";
import type { ModelsTreeVisibilityHandlerProps } from "../../../../tree-widget-react/components/trees/models-tree/internal/visibility/ModelsTreeVisibilityHandler.js";
import type { VisibilityExpectations } from "../../common/VisibilityValidation.js";

interface VisibilityOverrides {
  models?: Map<Id64String, Visibility>;
  categories?: Map<Id64String, Visibility>;
  elements?: Map<Id64String, Visibility>;
}

type ModelsTreeHierarchyConfiguration = Partial<ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"]>;

describe("ModelsTreeVisibilityHandler", () => {
  function createIdsCache(iModel: IModelConnection, hierarchyConfig?: ModelsTreeHierarchyConfiguration) {
    const queryExecutor = createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(iModel), "unbounded");
    const baseIdsCache = new BaseIdsCache({
      queryExecutor,
      elementClassName: hierarchyConfig?.elementClassSpecification ?? defaultHierarchyConfiguration.elementClassSpecification,
      type: "3d",
    });
    const idsCache = new ModelsTreeIdsCache({
      queryExecutor: createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(iModel), "unbounded"),
      hierarchyConfig: {
        ...defaultHierarchyConfiguration,
        ...hierarchyConfig,
      },
      baseIdsCache,
    });
    const symbolDispose = idsCache[Symbol.dispose];
    idsCache[Symbol.dispose] = () => {
      symbolDispose();
      baseIdsCache[Symbol.dispose]();
    };
    return idsCache;
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
      createdHandlers.forEach((x) => x[Symbol.dispose]());
      createdHandlers = [];
    });

    function createFakeIModelAccess(): ECClassHierarchyInspector {
      return {
        classDerivesFrom: sinon.fake.returns(false),
      };
    }

    function createHandler(props?: { overrides?: VisibilityOverrides; idsCache?: ModelsTreeIdsCache; viewport?: TreeWidgetViewport }) {
      const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
        getModelsVisibilityStatus:
          props?.overrides?.models &&
          (async ({ modelIds, originalImplementation }) => {
            let visibility: Visibility | "unknown" = "unknown";
            for (const modelId of Id64.iterable(modelIds)) {
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
        getCategoriesVisibilityStatus:
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
        getElementsVisibilityStatus:
          props?.overrides?.elements &&
          (async ({ elementIds, originalImplementation }) => {
            let visibility: Visibility | "unknown" = "unknown";
            for (const id of Id64.iterable(elementIds)) {
              const res = props.overrides!.elements!.get(id);
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
        changeCategoriesVisibilityStatus: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
        changeModelsVisibilityStatus: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
        changeElementsVisibilityStatus: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
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
            getElementsVisibilityStatus: async ({ originalImplementation }) => {
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
      describe("subject", () => {
        it("can be overridden", async () => {
          const overrides = {
            getSubjectsVisibilityStatus: sinon.fake.resolves(createVisibilityStatus("visible")),
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
          expect(overrides.getSubjectsVisibilityStatus).to.be.called;
        });

        it("returns disabled when active view is not spatial", async () => {
          const node = createSubjectHierarchyNode();
          const viewport = createFakeSinonViewport({ viewType: "2d" });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ isDisabled: true });
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

          const viewport = createFakeSinonViewport({ viewType: "2d" });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ isDisabled: true });
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
                viewsModel: sinon.fake.returns(false),
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
                viewsCategory: sinon.fake.returns(false),
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
                viewsCategory: sinon.fake.returns(false),
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
                viewsCategory: sinon.fake((id) => id === categories[0]),
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
                viewsCategory: sinon.fake((id) => id === categories[0]),
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
            getCategoriesVisibilityStatus: sinon.fake.resolves(createVisibilityStatus("visible")),
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
          expect(overrides?.getCategoriesVisibilityStatus).to.be.called;
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
                viewsCategory: sinon.fake.returns(true),
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
                getPerModelCategoryOverride: sinon.fake.returns("show"),
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
                viewsModel: sinon.fake.returns(false),
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
                viewsCategory: sinon.fake.returns(false),
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
                viewsCategory: sinon.fake.returns(true),
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
                viewsCategory: sinon.fake.returns(true),
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
                getPerModelCategoryOverride: sinon.fake.returns("hide"),
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
                getPerModelCategoryOverride: sinon.fake.returns("show"),
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
                viewsCategory: sinon.fake.returns(true),
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
                viewsCategory: sinon.fake.returns(false),
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
                getPerModelCategoryOverride: sinon.fake.returns("show"),
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
                getPerModelCategoryOverride: sinon.fake.returns("hide"),
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
            getElementsVisibilityStatus: sinon.fake.resolves(createVisibilityStatus("visible")),
          };
          const viewport = createFakeSinonViewport();
          using idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          const status = await handler.getVisibilityStatus(createElementHierarchyNode({ modelId: "0x1", categoryId: "0x2", elementId: "0x3" }));
          expect(overrides?.getElementsVisibilityStatus).to.be.called;
          expect(status.state).to.eq("visible");
        });

        it("is hidden when model is hidden", async () => {
          const node = createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId });
          const viewport = createFakeSinonViewport({
            viewsModel: sinon.fake.returns(false),
          });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is visible when model and category is displayed", async () => {
          const node = createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId });
          const viewport = createFakeSinonViewport({
            viewsModel: sinon.fake.returns(true),
            viewsCategory: sinon.fake.returns(true),
          });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible if present in the always drawn list", async () => {
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
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
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
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
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
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
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible when always/never drawn sets are undefined", async () => {
          using handlerResult = createHandler();
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
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
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden if category has per model override to hide", async () => {
          using handlerResult = createHandler({
            viewport: createFakeSinonViewport({
              getPerModelCategoryOverride: () => "hide",
            }),
          });
          const { handler } = handlerResult;
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
            getElementGroupingNodeVisibilityStatus: sinon.fake.resolves(createVisibilityStatus("visible")),
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
          expect(overrides?.getElementGroupingNodeVisibilityStatus).to.be.called;
        });

        it("is visible if all node elements are visible", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
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
          });

          for (const categoryOn of [true, false]) {
            using handlerResult = createHandler({
              viewport: createFakeSinonViewport({
                viewsCategory: sinon.fake.returns(categoryOn),
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
            changeSubjectsVisibilityStatus: sinon.fake.resolves(undefined),
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
          expect(overrides?.changeSubjectsVisibilityStatus).to.be.called;
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
            expect(overrides?.changeModelsVisibilityStatus).to.be.calledOnceWith(
              sinon.match({ modelIds: sinon.match.array.deepEquals(modelIds.flat()), on: true }),
            );
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
            expect(overrides?.changeModelsVisibilityStatus).to.be.calledWith(
              sinon.match({ modelIds: sinon.match.array.deepEquals(modelIds.flat()), on: false }),
            );
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
            expect(viewport.changeModelDisplay).to.be.calledOnceWith({ modelIds: [modelId], display: true });
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

            expect(viewport.clearPerModelCategoryOverrides).to.be.calledWith({ modelIds: [modelId] });
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
            expect(viewport.changeModelDisplay).to.be.calledOnceWith({ modelIds: [modelId], display: false });
          });
        });
      });

      describe("category", () => {
        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            changeCategoriesVisibilityStatus: sinon.fake.resolves(undefined),
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
          expect(overrides?.changeCategoriesVisibilityStatus).to.be.called;
        });

        describe("on", () => {
          it("sets SHOW override if model is hidden", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            const viewport = createFakeSinonViewport({
              viewsModel: sinon.fake.returns(false),
              getPerModelCategoryOverride: sinon.fake.returns("hide"),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(node, true);
            expect(viewport.setPerModelCategoryOverride).to.be.calledWith({
              modelIds: modelId,
              categoryIds: [categoryId],
              override: "show",
            });
          });

          it("sets SHOW override if model is shown but category is hidden in selector", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            const viewport = createFakeSinonViewport({
              viewsModel: sinon.fake.returns(true),
              viewsCategory: sinon.fake.returns(false),
              getPerModelCategoryOverride: sinon.fake.returns("none"),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(node, true);
            expect(viewport.setPerModelCategoryOverride).to.be.calledWith({
              modelIds: modelId,
              categoryIds: [categoryId],
              override: "show",
            });
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
            expect(viewport.setPerModelCategoryOverride).to.be.calledWith({
              modelIds: modelId,
              categoryIds: [categoryId],
              override: "hide",
            });
          });
        });
      });

      describe("element", () => {
        it("can be overridden", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x10";
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            changeElementsVisibilityStatus: sinon.fake.resolves(undefined),
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
          expect(overrides.changeElementsVisibilityStatus).to.be.called;
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
              viewsModel: sinon.fake.returns(false),
              viewsCategory: sinon.fake.returns(false),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.changeModelDisplay).to.be.calledOnceWith({ modelIds: modelId, display: true });
            expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId]));
          });

          it("adds element to the always drawn list if category is hidden", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            const viewport = createFakeSinonViewport({
              viewsCategory: sinon.fake.returns(false),
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
              viewsModel: sinon.fake.returns(true),
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
            changeElementGroupingNodeVisibilityStatus: sinon.fake.resolves(undefined),
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
            expect(overrides?.changeElementGroupingNodeVisibilityStatus).to.be.calledWithMatch({
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
              viewsModel: sinon.fake.returns(true),
              viewsCategory: sinon.fake.returns(!on),
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

    after(async () => {
      await terminatePresentationTesting();
    });

    function createCommonProps(props: { imodel: IModelConnection; hierarchyConfig?: typeof defaultHierarchyConfiguration; visibleByDefault?: boolean }) {
      const hierarchyConfig = { ...defaultHierarchyConfiguration, hideRootSubject: true, ...props.hierarchyConfig };
      const imodelAccess = createIModelAccess(props.imodel);
      const viewport = createTreeWidgetTestingViewport({ iModel: props.imodel, viewType: "3d", visibleByDefault: props.visibleByDefault });
      const baseIdsCache = new BaseIdsCache({ queryExecutor: imodelAccess, elementClassName: hierarchyConfig.elementClassSpecification, type: "3d" });
      const idsCache = new ModelsTreeIdsCache({ queryExecutor: imodelAccess, hierarchyConfig, baseIdsCache });
      return {
        imodelAccess,
        viewport,
        idsCache,
        hierarchyConfig,
        baseIdsCache,
      };
    }

    function createProvider(props: {
      idsCache: ModelsTreeIdsCache;
      imodelAccess: ReturnType<typeof createIModelAccess>;
      hierarchyConfig: typeof defaultHierarchyConfiguration;
      searchPaths?: HierarchyNodeIdentifiersPath[];
    }) {
      return createIModelHierarchyProvider({
        hierarchyDefinition: new ModelsTreeDefinition({ ...props }),
        imodelAccess: props.imodelAccess,
        ...(props.searchPaths ? { search: { paths: props.searchPaths } } : undefined),
      });
    }

    function createVisibilityTestData(props: { imodel: IModelConnection; hierarchyConfig?: typeof defaultHierarchyConfiguration; visibleByDefault?: boolean }) {
      const commonProps = createCommonProps(props);
      const handler = createModelsTreeVisibilityHandler(commonProps);
      const provider = createProvider(commonProps);
      return {
        handler,
        provider,
        imodelAccess: commonProps.imodelAccess,
        viewport: commonProps.viewport,
        idsCache: commonProps.idsCache,
        hierarchyConfig: commonProps.hierarchyConfig,
        [Symbol.dispose]() {
          commonProps.idsCache[Symbol.dispose]();
          handler[Symbol.dispose]();
          provider[Symbol.dispose]();
          commonProps.baseIdsCache[Symbol.dispose]();
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
      parentElementId?: Id64String;
    }

    const testCases: Array<{
      only?: boolean;
      describeName: string;
      createIModel: (context: Mocha.Context) => Promise<{ imodel: IModelConnection } & IModelWithSubModelIds>;
      cases: Array<{
        only?: boolean;
        name: string;
        getTargetNode: (ids: IModelWithSubModelIds) => NonGroupingHierarchyNode | GroupingHierarchyNode;
        expectations: (ids: IModelWithSubModelIds) => "all-visible" | "all-hidden" | VisibilityExpectations;
      }>;
    }> = [
      {
        describeName: "with child modeled elements",
        createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(context, async (builder, testSchema) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
            const partition = insertPhysicalPartition({ builder, codeValue: "model", parentId: rootSubject.id });
            const model = insertPhysicalSubModel({ builder, modeledElementId: partition.id });
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const parentElement = insertPhysicalElement({ modelId: model.id, categoryId: category.id, builder, userLabel: "parent element" });
            const modeledElement = insertPhysicalElement({
              builder,
              userLabel: `element`,
              modelId: model.id,
              categoryId: category.id,
              classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
              parentId: parentElement.id,
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
              parentElementId: parentElement.id,
            };
          });
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
                elementId: ids.parentElementId,
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
              [ids.subjectId]: "partial",
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
              [ids.subjectId]: "partial",
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
              [ids.subjectId]: "partial",
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
              [ids.subjectId]: "partial",
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
              [ids.subjectId]: "partial",
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
        createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(context, async (builder, testSchema) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
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
        createIModel: async function createIModel(context: Mocha.Context): Promise<{ imodel: IModelConnection } & IModelWithSubModelIds> {
          return buildIModel(context, async (builder, testSchema) => {
            const rootSubject: InstanceKey = { className: CLASS_NAME_Subject, id: IModel.rootSubjectId };
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

        before(async function () {
          const { imodel, ...ids } = await createIModel(this);
          iModel = imodel;
          createdIds = ids;
        });

        after(async () => {
          await iModel.close();
        });

        cases.forEach(({ name, getTargetNode, expectations, ...itProps }) => {
          (itProps.only ? it.only : it)(name, async function () {
            using visibilityTestData = createVisibilityTestData({ imodel: iModel });
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

    it("by default everything is hidden", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const modelId = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        insertPhysicalElement({ builder, modelId, categoryId });
      });

      const { imodel } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
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
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    });

    it("showing model makes it, all its categories and elements visible and doesn't affect other models", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const element = insertPhysicalElement({ builder, modelId: model, categoryId }).id;

        const otherModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;
        const otherElement = insertPhysicalElement({ builder, modelId: otherModel, categoryId }).id;
        return { model, categoryId, element, otherModel, otherElement };
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

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [IModel.rootSubjectId]: "partial",
            [ids.model]: "visible",
              [`${ids.model}-${ids.categoryId}`]: "visible",
                [ids.element]: "visible",

            [ids.otherModel]: "hidden",
              [`${ids.otherModel}-${ids.categoryId}`]: "hidden",
                [ids.otherElement]: "hidden",
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
        return { model, hiddenElement: elements[0], categoryId, element1: elements[1], element2: elements[2] };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createModelHierarchyNode({ modelId: ids.model, hasChildren: true }), true);
      viewport.setNeverDrawn({ elementIds: new Set([ids.hiddenElement]) });

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [IModel.rootSubjectId]: "partial",
            [ids.model]: "partial",
              [`${ids.model}-${ids.categoryId}`]: "partial",
                [ids.hiddenElement]: "hidden",
                [ids.element1]: "visible",
                [ids.element2]: "visible",
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

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
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
      viewport.changeModelDisplay({ modelIds: ids.model, display: true });
      viewport.changeCategoryDisplay({ categoryIds: [ids.category2, ids.category3], display: false });
      viewport.setAlwaysDrawn({ elementIds: new Set([ids.parentElement, ids.child, ids.childOfChild]) });
      viewport.renderFrame();

      await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category, elementId: ids.parentElement }), false);

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
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
      viewport.changeModelDisplay({ modelIds: ids.model, display: true });
      viewport.setNeverDrawn({ elementIds: new Set([ids.parentElement, ids.child, ids.childOfChild]) });
      viewport.changeCategoryDisplay({ categoryIds: [ids.category2, ids.category3], display: true, enableAllSubCategories: true });
      viewport.renderFrame();

      await handler.changeVisibility(createElementHierarchyNode({ modelId: ids.model, categoryId: ids.category, elementId: ids.parentElement }), true);

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
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
        const otherElement = insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory }).id;

        return { model, category, elementToShow: elements[0], elements1: elements[1], elements2: elements[2], otherCategory, otherElement };
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

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [IModel.rootSubjectId]: "partial",
            [ids.model]: "partial",
              [`${ids.model}-${ids.category}`]: "partial",
                [ids.elementToShow]: "visible",
                [ids.elements1]: "hidden",
                [ids.elements2]: "hidden",

              [`${ids.model}-${ids.otherCategory}`]: "hidden",
                [ids.otherElement]: "hidden",
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

        return { model, category, modelElements, otherModelElements, allElements: [...modelElements, ...otherModelElements], otherModel };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      const elementToShow = ids.modelElements[0];
      viewport.setAlwaysDrawn({ elementIds: new Set(ids.allElements) });

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-hidden",
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
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [IModel.rootSubjectId]: "partial",
            [ids.model]: "partial",
              [`${ids.model}-${ids.category}`]: "partial",
                [elementToShow]: "visible",
                [ids.modelElements[1]]: "hidden",
                [ids.modelElements[2]]: "hidden",

            [ids.otherModel]: "hidden",
              [`${ids.otherModel}-${ids.category}`]: "hidden",
                [ids.otherModelElements[0]]: "hidden",
                [ids.otherModelElements[1]]: "hidden",
                [ids.otherModelElements[2]]: "hidden",
        },
      });
    });

    it("model gets hidden when elements from other model are added to the exclusive always drawn list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const exclusiveElement = insertPhysicalElement({ builder, modelId: model, categoryId }).id;
        const element = insertPhysicalElement({ builder, modelId: model, categoryId }).id;

        const otherModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;
        const otherElement = insertPhysicalElement({ builder, modelId: otherModel, categoryId }).id;
        return { model, otherModel, categoryId, element, exclusiveElement, otherElement };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: ["0x1"] }), true);
      viewport.setAlwaysDrawn({ elementIds: new Set([ids.exclusiveElement]), exclusive: true });
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [IModel.rootSubjectId]: "partial",
            [ids.model]: "partial",
              [`${ids.model}-${ids.categoryId}`]: "partial",
                [ids.exclusiveElement]: "visible",
                [ids.element]: "hidden",

            [ids.otherModel]: "hidden",
              [`${ids.otherModel}-${ids.categoryId}`]: "hidden",
                [ids.otherElement]: "hidden",
        },
      });
    });

    it("model gets hidden when it has child only categories and elements from other model are added to the exclusive always drawn list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const categoryId = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const childCategoryId = insertSpatialCategory({ builder, codeValue: "childCategory" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const exclusiveElement = insertPhysicalElement({ builder, modelId: model, categoryId }).id;
        const childElement = insertPhysicalElement({ builder, modelId: model, categoryId: childCategoryId, parentId: exclusiveElement }).id;

        const otherModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" }).id;
        const otherElement = insertPhysicalElement({ builder, modelId: otherModel, categoryId }).id;
        return { model, categoryId, exclusiveElement, childElement, otherModel, otherElement };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: ["0x1"] }), true);
      viewport.setAlwaysDrawn({ elementIds: new Set([ids.exclusiveElement]), exclusive: true });
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [IModel.rootSubjectId]: "partial",
            [ids.model]: "partial",
              [`${ids.model}-${ids.categoryId}`]: "partial",
                [ids.exclusiveElement]: "partial",
                  [ids.childElement]: "hidden",

            [ids.otherModel]: "hidden",
              [`${ids.otherModel}-${ids.categoryId}`]: "hidden",
                [ids.otherElement]: "hidden",
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

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    });

    it("hiding category visible in selector adds it to per model override list", async function () {
      await using buildIModelResult = await buildIModel(this, async (builder) => {
        const category = insertSpatialCategory({ builder, codeValue: "category" }).id;
        const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" }).id;
        const element = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;

        const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" }).id;
        const otherElement = insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory }).id;
        return { model, category, element, otherCategory, otherElement };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: IModel.rootSubjectId }), true);
      viewport.changeCategoryDisplay({ categoryIds: ids.category, display: true, enableAllSubCategories: true });
      viewport.renderFrame();

      await handler.changeVisibility(
        createCategoryHierarchyNode({
          modelId: ids.model,
          categoryId: ids.category,
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
          [IModel.rootSubjectId]: "partial",
            [ids.model]: "partial",
              [`${ids.model}-${ids.category}`]: "hidden",
                [ids.element]: "hidden",

              [`${ids.model}-${ids.otherCategory}`]: "visible",
                [ids.otherElement]: "visible",
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
        const otherElement = insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory }).id;

        return { model, category, parentElement, child, childOfChild, otherCategory, otherElement };
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

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [IModel.rootSubjectId]: "partial",
            [ids.model]: "partial",
              [`${ids.model}-${ids.category}`]: "visible",
                [ids.parentElement]: "visible",
                  [ids.child]: "visible",
                    [ids.childOfChild]: "visible",

              [`${ids.model}-${ids.otherCategory}`]: "hidden",
                [ids.otherElement]: "hidden",
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
        const otherElement = insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory }).id;

        return { model, category, parentElement, child, childOfChild, otherCategory, otherElement };
      });

      const { imodel, ...ids } = buildIModelResult;
      using visibilityTestData = createVisibilityTestData({ imodel });
      const { handler, provider, viewport } = visibilityTestData;
      await handler.changeVisibility(createSubjectHierarchyNode({ ids: IModel.rootSubjectId }), true);
      viewport.renderFrame();
      await handler.changeVisibility(
        createClassGroupingHierarchyNode({
          modelId: ids.model,
          categoryId: ids.category,
          elements: [ids.parentElement],
        }),
        false,
      );

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [IModel.rootSubjectId]: "partial",
            [ids.model]: "partial",
              [`${ids.model}-${ids.category}`]: "hidden",
                [ids.parentElement]: "hidden",
                  [ids.child]: "hidden",
                    [ids.childOfChild]: "hidden",

              [`${ids.model}-${ids.otherCategory}`]: "visible",
                [ids.otherElement]: "visible",
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

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
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

      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        // prettier-ignore
        expectations: {
          [IModel.rootSubjectId]: "partial",
            [ids.model]: "partial",
              // Validation uses first category id to check expected visibility
              [`${ids.model}-${ids.category1}`]: "partial",
                [ids.element1]: "hidden",
                [ids.element2]: "visible",
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
      await validateModelsTreeHierarchyVisibility({
        provider,
        handler,
        viewport,
        expectations: "all-visible",
      });
    });

    describe("child element category is different than parent's", () => {
      it("model visibility takes into account all element categories", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const parentCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const childCategory = insertSpatialCategory({ builder, codeValue: "childCategory" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          const childElementWithDifferentCategory = insertPhysicalElement({
            builder,
            modelId: model.id,
            categoryId: childCategory.id,
            parentId: parentElement.id,
          });
          return {
            modelId: model.id,
            parentCategoryId: parentCategory.id,
            parentElementId: parentElement.id,
            childElementWithDifferentCategoryId: childElementWithDifferentCategory.id,
          };
        });
        const { imodel, modelId, parentCategoryId, parentElementId, childElementWithDifferentCategoryId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;
        const parentCategoryNode = createCategoryHierarchyNode({
          modelId,
          categoryId: parentCategoryId,
        });

        await handler.changeVisibility(parentCategoryNode, true);
        await validateModelsTreeHierarchyVisibility({
          ...props,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [modelId]: "partial",
                // Only categories of elements without parents are shown in the tree
                [`${modelId}-${parentCategoryId}`]: "visible",
                  [parentElementId]: "visible",
                    [childElementWithDifferentCategoryId]: "hidden",

          },
        });
      });

      it("model visibility takes into account all element categories when some elements are in always drawn list", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const parentCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const childCategory = insertSpatialCategory({ builder, codeValue: "childCategory" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          const childElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          const childElementWithDifferentCategory = insertPhysicalElement({
            builder,
            modelId: model.id,
            categoryId: childCategory.id,
            parentId: parentElement.id,
          });
          return {
            modelId: model.id,
            parentCategoryId: parentCategory.id,
            parentElementId: parentElement.id,
            childElementId: childElement.id,
            childElementWithDifferentCategoryId: childElementWithDifferentCategory.id,
          };
        });
        const { imodel, modelId, parentCategoryId, parentElementId, childElementId, childElementWithDifferentCategoryId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;
        const parentCategoryNode = createCategoryHierarchyNode({ modelId, categoryId: parentCategoryId, hasChildren: true });
        await handler.changeVisibility(parentCategoryNode, true);
        viewport.setAlwaysDrawn({ elementIds: new Set([...(viewport.alwaysDrawn ?? []), parentElementId]) });
        await validateModelsTreeHierarchyVisibility({
          ...props,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [modelId]: "partial",
                [`${modelId}-${parentCategoryId}`]: "visible",
                  [parentElementId]: "visible",
                    [childElementId]: "visible",
                    [childElementWithDifferentCategoryId]: "hidden",
          },
        });
      });

      it("changing category visibility of hidden model does not turn on unrelated elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const category1 = insertSpatialCategory({ builder, codeValue: "category1" });
          const category2 = insertSpatialCategory({ builder, codeValue: "category2" });
          const childCategory = insertSpatialCategory({ builder, codeValue: "childCategory" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category1.id });
          const element2 = insertPhysicalElement({ builder, modelId: model.id, categoryId: category2.id });
          const childElementWithDifferentCategory = insertPhysicalElement({
            builder,
            modelId: model.id,
            categoryId: childCategory.id,
            parentId: parentElement.id,
          });
          return {
            modelId: model.id,
            category1Id: category1.id,
            parentElementId: parentElement.id,
            childCategoryId: childCategory.id,
            childElementWithDifferentCategoryId: childElementWithDifferentCategory.id,
            element2Id: element2.id,
            category2Id: category2.id,
          };
        });
        const { imodel, modelId, category1Id, parentElementId, childCategoryId, childElementWithDifferentCategoryId, element2Id, category2Id } =
          buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;
        const modelNode = createModelHierarchyNode({ modelId, hasChildren: true });
        // Make child category enabled through category selector
        viewport.changeCategoryDisplay({ categoryIds: childCategoryId, display: true });
        await handler.changeVisibility(modelNode, false);

        const parentCategoryNode = createCategoryHierarchyNode({
          modelId,
          categoryId: category1Id,
        });
        // Changing category for hidden model should put all other categories into Hide overrides
        await handler.changeVisibility(parentCategoryNode, true);
        await validateModelsTreeHierarchyVisibility({
          ...props,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [modelId]: "partial",
                [`${modelId}-${category1Id}`]: "visible",
                  [parentElementId]: "visible",
                    [childElementWithDifferentCategoryId]: "hidden",

                [`${modelId}-${category2Id}`]: "hidden",
                  [element2Id]: "hidden",
          },
        });
      });

      it("changing category visibility turns on child elements that have the same category", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const sharedCategory = insertSpatialCategory({ builder, codeValue: "parentCategory" });
          const parentCategory = insertSpatialCategory({ builder, codeValue: "parentCategory2" });
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "model" });

          const elementWithSharedCategory = insertPhysicalElement({ builder, modelId: model.id, categoryId: sharedCategory.id });
          const parentElement2 = insertPhysicalElement({ builder, modelId: model.id, categoryId: parentCategory.id });
          const childElementWithSharedCategory = insertPhysicalElement({
            builder,
            modelId: model.id,
            categoryId: sharedCategory.id,
            parentId: parentElement2.id,
          });
          return {
            modelId: model.id,
            parentCategoryId: parentCategory.id,
            parentElementId: parentElement2.id,
            sharedCategoryId: sharedCategory.id,
            elementWithSharedCategoryId: elementWithSharedCategory.id,
            childElementWithSharedCategoryId: childElementWithSharedCategory.id,
          };
        });
        const { imodel, modelId, parentCategoryId, parentElementId, sharedCategoryId, elementWithSharedCategoryId, childElementWithSharedCategoryId } =
          buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...props } = visibilityTestData;

        const sharedCategoryNode = createCategoryHierarchyNode({
          modelId,
          categoryId: sharedCategoryId,
          hasChildren: true,
        });
        // Changing category for hidden model should put all other categories into Hide overrides
        await handler.changeVisibility(sharedCategoryNode, true);

        await validateModelsTreeHierarchyVisibility({
          ...props,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [modelId]: "partial",
                [`${modelId}-${sharedCategoryId}`]: "visible",
                  [elementWithSharedCategoryId]: "visible",

                [`${modelId}-${parentCategoryId}`]: "hidden",
                  [parentElementId]: "hidden",
                    [childElementWithSharedCategoryId]: "visible",
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
          const childOfUnrelatedElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: unrelatedParentElement.id });

          return {
            modelId: model.id,
            categoryId: category.id,
            elementId: element.id,
            unrelatedCategoryId: unrelatedParentCategory.id,
            unrelatedParentElementId: unrelatedParentElement.id,
            childOfUnrelatedElementId: childOfUnrelatedElement.id,
          };
        });
        const { imodel, modelId, categoryId, elementId, unrelatedParentElementId, childOfUnrelatedElementId, unrelatedCategoryId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, viewport, ...testProps } = visibilityTestData;
        const elementNode = createElementHierarchyNode({
          modelId,
          categoryId,
          elementId,
        });

        await handler.changeVisibility(elementNode, true);

        await validateModelsTreeHierarchyVisibility({
          ...testProps,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [modelId]: "partial",
                [`${modelId}-${categoryId}`]: "visible",
                  [elementId]: "visible",

                [`${modelId}-${unrelatedCategoryId}`]: "hidden",
                  [unrelatedParentElementId]: "hidden",
                    [childOfUnrelatedElementId]: "hidden",
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
        viewport.changeModelDisplay({ modelIds: modelId, display: true });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-hidden",
        });

        viewport.changeCategoryDisplay({ categoryIds: [firstCategoryId, secondCategoryId], display: true, enableAllSubCategories: true });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-visible",
        });
      });

      it("hiding category via the selector makes category and all elements hidden when it has no always or never drawn elements", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, secondCategoryId, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: modelId, display: true });
        viewport.changeCategoryDisplay({ categoryIds: [firstCategoryId, secondCategoryId], display: true, enableAllSubCategories: true });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-visible",
        });

        viewport.changeCategoryDisplay({ categoryIds: [firstCategoryId, secondCategoryId], display: false });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-hidden",
        });
      });

      it("hiding category via the selector makes it hidden when it only has never drawn elements", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, modelId, elements1, elements2, secondCategoryId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: modelId, display: true });
        viewport.changeCategoryDisplay({ categoryIds: firstCategoryId, display: true, enableAllSubCategories: true });
        const elementId = elements1[0];
        viewport.setNeverDrawn({ elementIds: new Set([elementId]) });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [modelId]: "partial",
                [`${modelId}-${firstCategoryId}`]: "partial",
                  [elements1[0]]: "hidden",
                  [elements1[1]]: "visible",

                [`${modelId}-${secondCategoryId}`]: "hidden",
                  [elements2[0]]: "hidden",
                  [elements2[1]]: "hidden",
          },
        });

        viewport.changeCategoryDisplay({ categoryIds: firstCategoryId, display: false });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-hidden",
        });
      });

      it("showing category via the selector makes it visible when it only has always drawn elements", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, secondCategoryId, elements1, modelId, elements2 } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: modelId, display: true });
        viewport.changeCategoryDisplay({ categoryIds: secondCategoryId, display: true, enableAllSubCategories: true });
        const elementId = elements1[0];
        viewport.setAlwaysDrawn({ elementIds: new Set([elementId]) });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [modelId]: "partial",
                [`${modelId}-${firstCategoryId}`]: "partial",
                  [elements1[0]]: "visible",
                  [elements1[1]]: "hidden",

                [`${modelId}-${secondCategoryId}`]: "visible",
                  [elements2[0]]: "visible",
                  [elements2[1]]: "visible",
          },
        });

        viewport.changeCategoryDisplay({ categoryIds: firstCategoryId, display: true, enableAllSubCategories: true });
        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-visible",
        });
      });

      it("model is visible if category is disabled in selector but all category's elements are always drawn", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, secondCategoryId, elements1, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: modelId, display: true });
        viewport.changeCategoryDisplay({ categoryIds: [firstCategoryId, secondCategoryId], display: true, enableAllSubCategories: true });
        viewport.setAlwaysDrawn({ elementIds: new Set(elements1) });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-visible",
        });

        viewport.changeCategoryDisplay({ categoryIds: firstCategoryId, display: false });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-visible",
        });
      });

      it("model is hidden if category is enabled in selector but all category's elements are never drawn", async function () {
        await using buildIModelResult = await createIModel(this);
        const { imodel, firstCategoryId, elements1, modelId } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: modelId, display: true });
        viewport.setNeverDrawn({ elementIds: new Set(elements1) });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-hidden",
        });

        viewport.changeCategoryDisplay({ categoryIds: firstCategoryId, display: true, enableAllSubCategories: true });

        await validateModelsTreeHierarchyVisibility({
          handler,
          provider,
          viewport,
          expectations: "all-hidden",
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
        const node = createSubjectHierarchyNode({ ids: [IModel.rootSubjectId] });

        it("empty model hidden by default", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-hidden",
          });
        });

        it("showing it makes empty model visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(node, true);
          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            expectations: "all-visible",
          });
        });

        it("gets partial when only empty model is visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, ...ids } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createModelHierarchyNode({ modelId: ids.emptyModelId }), true);
          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [ids.emptyModelId]: "visible",

                [ids.configurationModelId]: "hidden",
                  [`${ids.configurationModelId}-${ids.configurationCategoryId}`]: "hidden",
                  [ids.customClassElement1]: "hidden",
                  [ids.customClassElement2]: "hidden",
                  [ids.nonCustomClassElement]: "hidden",
            },
          });
        });
      });

      describe("model with custom class specification elements", () => {
        it("showing it makes it, all its categories and elements visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, ...ids } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(createModelHierarchyNode({ modelId: ids.configurationModelId }), true);
          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [ids.emptyModelId]: "hidden",

                [ids.configurationModelId]: "visible",
                  [`${ids.configurationModelId}-${ids.configurationCategoryId}`]: "visible",
                    [ids.customClassElement1]: "visible",
                    [ids.customClassElement2]: "visible",
                    [ids.nonCustomClassElement]: "visible",
            },
          });
        });

        it("gets partial when custom class element is visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, ...ids } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: ids.configurationModelId,
              categoryId: ids.configurationCategoryId,
              hasChildren: true,
              elementId: ids.customClassElement1,
            }),
            true,
          );
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([ids.customClassElement1]));

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [ids.emptyModelId]: "hidden",

                [ids.configurationModelId]: "partial",
                  [`${ids.configurationModelId}-${ids.configurationCategoryId}`]: "partial",
                    [ids.customClassElement1]: "visible",
                    [ids.customClassElement2]: "hidden",
                    [ids.nonCustomClassElement]: "hidden",
            },
          });
        });

        it("gets visible when all custom class elements are visible", async function () {
          await using buildIModelResult = await createHierarchyConfigurationModel(this);
          const { imodel, hierarchyConfig, ...ids } = buildIModelResult;
          using visibilityTestData = createVisibilityTestData({ imodel, hierarchyConfig });
          const { handler, provider, viewport } = visibilityTestData;

          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: ids.configurationModelId,
              categoryId: ids.configurationCategoryId,
              hasChildren: true,
              elementId: ids.customClassElement1,
            }),
            true,
          );
          await handler.changeVisibility(
            createElementHierarchyNode({
              modelId: ids.configurationModelId,
              categoryId: ids.configurationCategoryId,
              hasChildren: true,
              elementId: ids.customClassElement2,
            }),
            true,
          );
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([ids.customClassElement1, ids.customClassElement2]));

          await validateModelsTreeHierarchyVisibility({
            provider,
            handler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [ids.emptyModelId]: "hidden",

                [ids.configurationModelId]: "visible",
                  [`${ids.configurationModelId}-${ids.configurationCategoryId}`]: "visible",
                    [ids.customClassElement1]: "visible",
                    [ids.customClassElement2]: "visible",
                    [ids.nonCustomClassElement]: "hidden",
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
          const otherElement = insertPhysicalElement({ builder, modelId: otherModel, categoryId: otherCategory }).id;

          return { model1, category1, element1, element2, otherModel, otherCategory, otherElement };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: ids.model1, display: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([ids.element2]), exclusive: true });

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [ids.model1]: "partial",
                [`${ids.model1}-${ids.category1}`]: "partial",
                  [ids.element1]: "hidden",
                  [ids.element2]: "visible",

              [ids.otherModel]: "hidden",
                [`${ids.otherModel}-${ids.otherCategory}`]: "hidden",
                  [ids.otherElement]: "hidden",
          },
        });
        await handler.changeVisibility(createModelHierarchyNode({ modelId: ids.model1 }), true);

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [ids.model1]: "visible",
                [`${ids.model1}-${ids.category1}`]: "visible",
                  [ids.element1]: "visible",
                  [ids.element2]: "visible",

              [ids.otherModel]: "hidden",
                [`${ids.otherModel}-${ids.otherCategory}`]: "hidden",
                  [ids.otherElement]: "hidden",
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
          const otherElement = insertPhysicalElement({ builder, modelId: model, categoryId: otherCategory }).id;

          return { model, category1, element1, element2, otherCategory, otherElement };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;
        viewport.changeModelDisplay({ modelIds: ids.model, display: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([ids.element2]), exclusive: true });

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [ids.model]: "partial",
                [`${ids.model}-${ids.category1}`]: "partial",
                  [ids.element1]: "hidden",
                  [ids.element2]: "visible",

                [`${ids.model}-${ids.otherCategory}`]: "hidden",
                  [ids.otherElement]: "hidden",
          },
        });
        await handler.changeVisibility(createCategoryHierarchyNode({ modelId: ids.model, categoryId: ids.category1, hasChildren: true }), true);

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [ids.model]: "partial",
                [`${ids.model}-${ids.category1}`]: "visible",
                  [ids.element1]: "visible",
                  [ids.element2]: "visible",

                [`${ids.model}-${ids.otherCategory}`]: "hidden",
                  [ids.otherElement]: "hidden",
          },
        });
      });

      it("changing class grouping node visibility does not affect other class grouping nodes", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder, testSchema) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "1" }).id;
          const category = insertSpatialCategory({ builder, codeValue: "category1" }).id;
          const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
          const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;

          const elementOfOtherClass = insertPhysicalElement({
            builder,
            userLabel: `element`,
            modelId: model,
            categoryId: category,
            classFullName: testSchema.items.SubModelablePhysicalObject.fullName,
          }).id;

          return { model, category, element1, element2, elementOfOtherClass };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;

        viewport.changeModelDisplay({ modelIds: ids.model, display: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([ids.element2]), exclusive: true });

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [ids.model]: "partial",
                [`${ids.model}-${ids.category}`]: "partial",
                  [ids.element1]: "hidden",
                  [ids.element2]: "visible",
                  [ids.elementOfOtherClass]: "hidden",
          },
        });
        await handler.changeVisibility(
          createClassGroupingHierarchyNode({ elements: [ids.element1, ids.element2], categoryId: ids.category, modelId: ids.model }),
          true,
        );

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [ids.model]: "partial",
                [`${ids.model}-${ids.category}`]: "partial",
                  [ids.element1]: "visible",
                  [ids.element2]: "visible",
                  [ids.elementOfOtherClass]: "hidden",
          },
        });
      });

      it("changing element visibility does not affect other elements", async function () {
        await using buildIModelResult = await buildIModel(this, async (builder) => {
          const model = insertPhysicalModelWithPartition({ builder, codeValue: "1" }).id;
          const category = insertSpatialCategory({ builder, codeValue: "category1", userLabel: "SomeLabel" }).id;
          const element1 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
          const element2 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;
          const element3 = insertPhysicalElement({ builder, modelId: model, categoryId: category }).id;

          return { model, category, element1, element2, element3 };
        });

        const { imodel, ...ids } = buildIModelResult;
        using visibilityTestData = createVisibilityTestData({ imodel });
        const { handler, provider, viewport } = visibilityTestData;

        viewport.changeModelDisplay({ modelIds: ids.model, display: true });
        viewport.setAlwaysDrawn({ elementIds: new Set([ids.element2]), exclusive: true });

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [ids.model]: "partial",
                [`${ids.model}-${ids.category}`]: "partial",
                  [ids.element1]: "hidden",
                  [ids.element2]: "visible",
                  [ids.element3]: "hidden",
          },
        });
        await handler.changeVisibility(createElementHierarchyNode({ elementId: ids.element1, categoryId: ids.category, modelId: ids.model }), true);

        await validateModelsTreeHierarchyVisibility({
          provider,
          handler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [ids.model]: "partial",
                [`${ids.model}-${ids.category}`]: "partial",
                  [ids.element1]: "visible",
                  [ids.element2]: "visible",
                  [ids.element3]: "hidden",
          },
        });
      });
    });

    describe("search nodes", () => {
      function createFilteredVisibilityTestData({
        imodel,
        searchPaths,
      }: Parameters<typeof createVisibilityTestData>[0] & { searchPaths: HierarchyNodeIdentifiersPath[] }) {
        const commonProps = createCommonProps({ imodel });
        const visibilityHandlerWithSearchPaths = createModelsTreeVisibilityHandler({ ...commonProps, searchPaths });
        const defaultVisibilityHandler = createModelsTreeVisibilityHandler(commonProps);
        const defaultProvider = createProvider(commonProps);
        const providerWithSearchPaths = createProvider({ ...commonProps, searchPaths });
        return {
          defaultVisibilityHandler,
          defaultProvider,
          providerWithSearchPaths,
          ...commonProps,
          visibilityHandlerWithSearchPaths,
          [Symbol.dispose]() {
            commonProps.idsCache[Symbol.dispose]();
            commonProps.baseIdsCache[Symbol.dispose]();
            defaultVisibilityHandler[Symbol.dispose]();
            visibilityHandlerWithSearchPaths[Symbol.dispose]();
            defaultProvider[Symbol.dispose]();
            providerWithSearchPaths[Symbol.dispose]();
          },
        };
      }

      describe("single path to element", () => {
        it("showing category changes visibility for nodes in search paths", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const searchTargetChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const childElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              searchTargetChildElement,
              childElement,
              parentElement,
              searchPaths: [[model, category, parentElement, searchTargetChildElement]],
            };
          });

          const { imodel, searchPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
          const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

          viewport.setNeverDrawn({ elementIds: new Set([keys.parentElement.id, keys.searchTargetChildElement.id, keys.childElement.id]) });
          viewport.renderFrame();

          const node = createCategoryHierarchyNode({
            categoryId: keys.category.id,
            modelId: keys.model.id,
            parentKeys: [keys.model],
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[keys.parentElement], [keys.searchTargetChildElement]],
            },
          });
          await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

          await validateModelsTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithSearchPaths,
            viewport,
            expectations: "all-visible",
          });

          await validateModelsTreeHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.model.id]: "partial",
                  [`${keys.model.id}-${keys.category.id}`]: "partial",
                    [keys.parentElement.id]: "partial",
                      [keys.searchTargetChildElement.id]: "visible",
                      [keys.childElement.id]: "hidden",
            },
          });
        });

        it("showing element changes visibility for nodes in search paths", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const searchTargetChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const childElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              searchTargetChildElement,
              childElement,
              parentElement,
              searchPaths: [[model, category, parentElement, searchTargetChildElement]],
            };
          });

          const { imodel, searchPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
          const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
          const node = createElementHierarchyNode({
            elementId: keys.parentElement.id,
            categoryId: keys.category.id,
            modelId: keys.model.id,
            parentKeys: [keys.model, keys.category],
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[keys.searchTargetChildElement]],
            },
          });
          await visibilityHandlerWithSearchPaths.changeVisibility(node, true);
          await validateModelsTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithSearchPaths,
            viewport,
            expectations: "all-visible",
          });
          await validateModelsTreeHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.model.id]: "partial",
                  [`${keys.model.id}-${keys.category.id}`]: "partial",
                    [keys.parentElement.id]: "partial",
                      [keys.searchTargetChildElement.id]: "visible",
                      [keys.childElement.id]: "hidden",
            },
          });
        });

        it("showing class grouping node changes visibility for nodes in search paths", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const searchTargetChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const childElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              searchTargetChildElement,
              childElement,
              parentElement,
              searchPaths: [[model, category, parentElement, searchTargetChildElement]],
            };
          });

          const { imodel, searchPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
          const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
          const node = createClassGroupingHierarchyNode({
            elements: [keys.parentElement.id],
            modelId: keys.model.id,
            categoryId: keys.category.id,
            parentKeys: [keys.model, keys.category],
            hasDirectNonSearchTargets: true,
            hasSearchTargetAncestor: false,
          });
          await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

          await validateModelsTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithSearchPaths,
            viewport,
            expectations: "all-visible",
          });

          await validateModelsTreeHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.model.id]: "partial",
                  [`${keys.model.id}-${keys.category.id}`]: "partial",
                    [keys.parentElement.id]: "partial",
                      [keys.searchTargetChildElement.id]: "visible",
                      [keys.childElement.id]: "hidden",
            },
          });
        });

        it("hiding category changes visibility for nodes in search paths", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const searchTargetChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const childElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              searchTargetChildElement,
              childElement,
              parentElement,
              searchPaths: [[model, category, parentElement, searchTargetChildElement]],
            };
          });

          const { imodel, searchPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
          const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
          viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
          viewport.setAlwaysDrawn({ elementIds: new Set([keys.parentElement.id, keys.searchTargetChildElement.id, keys.childElement.id]) });
          viewport.renderFrame();

          const node = createCategoryHierarchyNode({
            categoryId: keys.category.id,
            modelId: keys.model.id,
            parentKeys: [keys.model],
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[keys.parentElement], [keys.searchTargetChildElement]],
            },
          });
          await visibilityHandlerWithSearchPaths.changeVisibility(node, false);

          await validateModelsTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithSearchPaths,
            viewport,
            expectations: "all-hidden",
          });

          await validateModelsTreeHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.model.id]: "partial",
                  [`${keys.model.id}-${keys.category.id}`]: "partial",
                    [keys.parentElement.id]: "partial",
                      [keys.searchTargetChildElement.id]: "hidden",
                      [keys.childElement.id]: "visible",
            },
          });
        });

        it("hiding element changes visibility for nodes in search paths", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const searchTargetChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const childElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              searchTargetChildElement,
              childElement,
              parentElement,
              searchPaths: [[model, category, parentElement, searchTargetChildElement]],
            };
          });

          const { imodel, searchPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
          const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

          viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
          viewport.setAlwaysDrawn({ elementIds: new Set([keys.parentElement.id, keys.searchTargetChildElement.id, keys.childElement.id]) });
          viewport.renderFrame();

          const node = createElementHierarchyNode({
            elementId: keys.parentElement.id,
            categoryId: keys.category.id,
            modelId: keys.model.id,
            parentKeys: [keys.model, keys.category],
            search: {
              isSearchTarget: false,
              childrenTargetPaths: [[keys.searchTargetChildElement]],
            },
          });
          await visibilityHandlerWithSearchPaths.changeVisibility(node, false);

          await validateModelsTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithSearchPaths,
            viewport,
            expectations: "all-hidden",
          });

          await validateModelsTreeHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.model.id]: "partial",
                  [`${keys.model.id}-${keys.category.id}`]: "partial",
                    [keys.parentElement.id]: "partial",
                      [keys.searchTargetChildElement.id]: "hidden",
                      [keys.childElement.id]: "visible",
            },
          });
        });

        it("hiding class grouping node changes visibility for nodes in search paths", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const parentElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
            const searchTargetChildElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });
            const childElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id, parentId: parentElement.id });

            return {
              model,
              category,
              searchTargetChildElement,
              childElement,
              parentElement,
              searchPaths: [[model, category, parentElement, searchTargetChildElement]],
            };
          });

          const { imodel, searchPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
          const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

          viewport.changeModelDisplay({ modelIds: keys.model.id, display: true });
          viewport.setAlwaysDrawn({ elementIds: new Set([keys.parentElement.id, keys.searchTargetChildElement.id, keys.childElement.id]) });
          viewport.renderFrame();

          const node = createClassGroupingHierarchyNode({
            elements: [keys.parentElement.id],
            modelId: keys.model.id,
            categoryId: keys.category.id,
            parentKeys: [keys.model, keys.category],
            hasDirectNonSearchTargets: true,
            hasSearchTargetAncestor: false,
          });
          await visibilityHandlerWithSearchPaths.changeVisibility(node, false);
          await validateModelsTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithSearchPaths,
            viewport,
            expectations: "all-hidden",
          });
          await validateModelsTreeHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.model.id]: "partial",
                  [`${keys.model.id}-${keys.category.id}`]: "partial",
                    [keys.parentElement.id]: "partial",
                      [keys.searchTargetChildElement.id]: "hidden",
                      [keys.childElement.id]: "visible",
            },
          });
        });

        it("showing model node changes visibility for nodes in search paths", async function () {
          await using buildIModelResult = await buildIModel(this, async (builder) => {
            const category = insertSpatialCategory({ builder, codeValue: "category" });
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const searchTargetElement = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });

            const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" });
            const otherModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" });
            const otherElement = insertPhysicalElement({ builder, modelId: otherModel.id, categoryId: otherCategory.id });

            return {
              model,
              category,
              searchTargetElement,
              otherModel,
              otherCategory,
              otherElement,
              searchPaths: [[model, category, searchTargetElement]],
            };
          });

          const { imodel, searchPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
          const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;
          const node = createModelHierarchyNode({
            modelId: keys.model.id,
            search: {
              childrenTargetPaths: [[keys.category], [keys.searchTargetElement]],
            },
          });
          await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

          await validateModelsTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithSearchPaths,
            viewport,
            expectations: "all-visible",
          });

          await validateModelsTreeHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.model.id]: "visible",
                  [`${keys.model.id}-${keys.category.id}`]: "visible",
                    [keys.searchTargetElement.id]: "visible",

                [keys.otherModel.id]: "hidden",
                  [`${keys.otherModel.id}-${keys.otherCategory.id}`]: "hidden",
                    [keys.otherElement.id]: "hidden",
            },
          });
        });
      });

      describe("path to elements in different categories", () => {
        async function createIModel(context: Mocha.Context) {
          return buildIModel(context, async (builder) => {
            const categoriesOfSearchTargets = [
              insertSpatialCategory({ builder, codeValue: "category1" }),
              insertSpatialCategory({ builder, codeValue: "category2" }),
              insertSpatialCategory({ builder, codeValue: "category3" }),
            ];
            const model = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "1" });
            const paths: InstanceKey[][] = [];
            const searchTargets = new Array<Id64String>();
            const nonSearchTargets = new Array<Id64String>();
            categoriesOfSearchTargets.forEach((category) => {
              const searchTarget = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
              paths.push([model, category, searchTarget]);
              searchTargets.push(searchTarget.id);

              const nonSearchTarget = insertPhysicalElement({ builder, modelId: model.id, categoryId: category.id });
              nonSearchTargets.push(nonSearchTarget.id);
            });

            const otherCategory = insertSpatialCategory({ builder, codeValue: "otherCategory" });
            const otherModel = insertPhysicalModelWithPartition({ builder, partitionParentId: IModel.rootSubjectId, codeValue: "2" });
            const otherElement = insertPhysicalElement({ builder, modelId: otherModel.id, categoryId: otherCategory.id });

            return {
              model,
              categoriesOfSearchTargets,
              searchPaths: paths,
              searchTargetElements: searchTargets,
              nonSearchTargetElements: nonSearchTargets,
              otherModel,
              otherCategory,
              otherElement,
            };
          });
        }

        it("showing model node changes visibility for nodes in search paths", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, searchPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
          const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

          const node = createModelHierarchyNode({
            modelId: keys.model.id,
            search: {
              childrenTargetPaths: searchPaths.map((path) => path.slice(1)),
            },
          });
          await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

          await validateModelsTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithSearchPaths,
            viewport,
            expectations: "all-visible",
          });

          await validateModelsTreeHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.model.id]: "partial",
                  [`${keys.model.id}-${keys.categoriesOfSearchTargets[0].id}`]: "partial",
                    [keys.searchTargetElements[0]]: "visible",
                    [keys.nonSearchTargetElements[0]]: "hidden",

                  [`${keys.model.id}-${keys.categoriesOfSearchTargets[1].id}`]: "partial",
                    [keys.searchTargetElements[1]]: "visible",
                    [keys.nonSearchTargetElements[1]]: "hidden",

                  [`${keys.model.id}-${keys.categoriesOfSearchTargets[2].id}`]: "partial",
                    [keys.searchTargetElements[2]]: "visible",
                    [keys.nonSearchTargetElements[2]]: "hidden",

                [keys.otherModel.id]: "hidden",
                  [`${keys.otherModel.id}-${keys.otherCategory.id}`]: "hidden",
                    [keys.otherElement.id]: "hidden",
            },
          });
        });

        it("showing category node changes visibility for related nodes in search paths", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, searchPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
          const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

          const node = createCategoryHierarchyNode({
            modelId: keys.model.id,
            categoryId: keys.categoriesOfSearchTargets[0].id,
            parentKeys: [keys.model],
            search: { childrenTargetPaths: [searchPaths[0].slice(2)] },
          });
          await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

          await validateModelsTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithSearchPaths,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.model.id]: "partial",
                  [`${keys.model.id}-${keys.categoriesOfSearchTargets[0].id}`]: "visible",
                    [keys.searchTargetElements[0]]: "visible",

                  [`${keys.model.id}-${keys.categoriesOfSearchTargets[1].id}`]: "hidden",
                    [keys.searchTargetElements[1]]: "hidden",

                  [`${keys.model.id}-${keys.categoriesOfSearchTargets[2].id}`]: "hidden",
                    [keys.searchTargetElements[2]]: "hidden",
            },
          });

          await validateModelsTreeHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.model.id]: "partial",
                  [`${keys.model.id}-${keys.categoriesOfSearchTargets[0].id}`]: "partial",
                    [keys.searchTargetElements[0]]: "visible",
                    [keys.nonSearchTargetElements[0]]: "hidden",

                  [`${keys.model.id}-${keys.categoriesOfSearchTargets[1].id}`]: "hidden",
                    [keys.searchTargetElements[1]]: "hidden",
                    [keys.nonSearchTargetElements[1]]: "hidden",

                  [`${keys.model.id}-${keys.categoriesOfSearchTargets[2].id}`]: "hidden",
                    [keys.searchTargetElements[2]]: "hidden",
                    [keys.nonSearchTargetElements[2]]: "hidden",

                [keys.otherModel.id]: "hidden",
                  [`${keys.otherModel.id}-${keys.otherCategory.id}`]: "hidden",
                    [keys.otherElement.id]: "hidden",
            },
          });
        });
      });

      describe("multiple paths to a category and element under it", () => {
        async function createIModel(context: Mocha.Context) {
          return buildIModel(context, async (builder) => {
            const searchPaths = new Array<InstanceKey[]>();
            const subjectIds = new Array<Id64String>();
            const modelIds = new Array<Id64String>();
            const categoryIds = new Array<Id64String>();

            const parentSubject = insertSubject({ builder, codeValue: `parent subject`, parentId: IModel.rootSubjectId });
            const elementsOfModels = new Array<Array<Id64String>>();
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
              searchPaths.push([parentSubject, subject, model, category], [parentSubject, subject, model, category, elements[0]]);
              categoryIds.push(category.id);
              elementsOfModels.push(elements.map((el) => el.id));
            }

            return {
              parentSubject,
              subjectIds,
              modelIds,
              searchPaths,
              categoryIds,
              elementsOfModels,
            };
          });
        }

        it("showing model node changes visibility for related nodes in search paths", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, searchPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
          const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

          const node = createSubjectHierarchyNode({ ids: keys.parentSubject.id });
          await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

          await validateModelsTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithSearchPaths,
            viewport,
            expectations: "all-visible",
          });

          await validateModelsTreeHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            expectations: "all-visible",
          });
        });

        it("showing category node changes visibility for related nodes in search paths", async function () {
          await using buildIModelResult = await createIModel(this);
          const { imodel, searchPaths, ...keys } = buildIModelResult;
          using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
          const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

          const node = createCategoryHierarchyNode({
            modelId: keys.modelIds[0],
            categoryId: keys.categoryIds[0],
            parentKeys: [
              keys.parentSubject,
              { id: keys.subjectIds[0], className: CLASS_NAME_Subject },
              { id: keys.modelIds[0], className: CLASS_NAME_GeometricModel3d },
            ],
          });
          await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

          await validateModelsTreeHierarchyVisibility({
            provider: providerWithSearchPaths,
            handler: visibilityHandlerWithSearchPaths,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.parentSubject.id]: "partial",
                  [keys.subjectIds[0]]: "visible",
                    [keys.modelIds[0]]: "visible",
                      [`${keys.modelIds[0]}-${keys.categoryIds[0]}`]: "visible",
                        [keys.elementsOfModels[0][0]]: "visible",
                        [keys.elementsOfModels[0][1]]: "visible",

                [keys.subjectIds[1]]: "hidden",
                  [keys.modelIds[1]]: "hidden",
                    [`${keys.modelIds[1]}-${keys.categoryIds[1]}`]: "hidden",
                      [keys.elementsOfModels[1][0]]: "hidden",
                      [keys.elementsOfModels[1][1]]: "hidden",
            },
          });

          await validateModelsTreeHierarchyVisibility({
            provider: defaultProvider,
            handler: defaultVisibilityHandler,
            viewport,
            // prettier-ignore
            expectations: {
              [IModel.rootSubjectId]: "partial",
                [keys.parentSubject.id]: "partial",
                  [keys.subjectIds[0]]: "visible",
                    [keys.modelIds[0]]: "visible",
                      [`${keys.modelIds[0]}-${keys.categoryIds[0]}`]: "visible",
                        [keys.elementsOfModels[0][0]]: "visible",
                        [keys.elementsOfModels[0][1]]: "visible",

                [keys.subjectIds[1]]: "hidden",
                  [keys.modelIds[1]]: "hidden",
                    [`${keys.modelIds[1]}-${keys.categoryIds[1]}`]: "hidden",
                      [keys.elementsOfModels[1][0]]: "hidden",
                      [keys.elementsOfModels[1][1]]: "hidden",
            },
          });
        });
      });

      it("showing class grouping node changes visibility for related nodes in search paths", async function () {
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

          const paths = [[model, category, element1]];

          return {
            firstElement: element1.id,
            model: model.id,
            category: category.id,
            pathToFirstElement: paths[0],
            searchPaths: paths,
            element2: element2.id,
          };
        });

        const { imodel, searchPaths, ...keys } = buildIModelResult;
        using visibilityTestData = createFilteredVisibilityTestData({ imodel, searchPaths });
        const { defaultVisibilityHandler, visibilityHandlerWithSearchPaths, viewport, defaultProvider, providerWithSearchPaths } = visibilityTestData;

        const node = createClassGroupingHierarchyNode({
          elements: [keys.firstElement],
          categoryId: keys.category,
          modelId: keys.model,
          parentKeys: [
            { id: keys.model, className: CLASS_NAME_GeometricModel3d },
            { id: keys.category, className: CLASS_NAME_SpatialCategory },
          ],
          hasDirectNonSearchTargets: true,
          hasSearchTargetAncestor: false,
        });
        await visibilityHandlerWithSearchPaths.changeVisibility(node, true);

        await validateModelsTreeHierarchyVisibility({
          provider: providerWithSearchPaths,
          handler: visibilityHandlerWithSearchPaths,
          viewport,
          expectations: "all-visible",
        });

        await validateModelsTreeHierarchyVisibility({
          provider: defaultProvider,
          handler: defaultVisibilityHandler,
          viewport,
          // prettier-ignore
          expectations: {
            [IModel.rootSubjectId]: "partial",
              [keys.model]: "partial",
                [`${keys.model}-${keys.category}`]: "partial",
                  [keys.firstElement]: "visible",
                  [keys.element2]: "hidden",
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

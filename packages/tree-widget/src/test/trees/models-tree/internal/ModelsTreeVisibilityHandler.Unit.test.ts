/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CompressedId64Set, Id64 } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { BaseIdsCache } from "../../../../tree-widget-react/shared/internal/caches/BaseIdsCache.js";
import { createVisibilityStatus } from "../../../../tree-widget-react/shared/internal/Tooltip.js";
import { mergeWithDefaults } from "../../../../tree-widget-react/shared/internal/Utils.js";
import { ModelsTreeIdsCache } from "../../../../tree-widget-react/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { createModelsTreeVisibilityHandler } from "../../../../tree-widget-react/trees/models-tree/internal/visibility/ModelsTreeVisibilityHandler.js";
import { defaultHierarchyConfiguration } from "../../../../tree-widget-react/trees/models-tree/ModelsTreeDefinition.js";
import { TestUtils } from "../../../TestUtils.js";
import { createFakeViewport } from "../../Common.js";
import {
  createCategoryHierarchyNode,
  createClassGroupingHierarchyNode,
  createElementHierarchyNode,
  createFakeIdsCache,
  createModelHierarchyNode,
  createSubjectHierarchyNode,
} from "../Utils.js";

import type { Id64String } from "@itwin/core-bentley";
import type { QueryBinder } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { Visibility } from "../../../../tree-widget-react/shared/internal/Tooltip.js";
import type { TreeWidgetViewport } from "../../../../tree-widget-react/shared/TreeWidgetViewport.js";
import type { ModelsTreeVisibilityHandlerProps } from "../../../../tree-widget-react/trees/models-tree/internal/visibility/ModelsTreeVisibilityHandler.js";
import type { ModelsTreeHierarchyConfiguration } from "../../../../tree-widget-react/trees/models-tree/ModelsTreeDefinition.js";

interface VisibilityOverrides {
  models?: Map<Id64String, Visibility>;
  categories?: Map<Id64String, Visibility>;
  elements?: Map<Id64String, Visibility>;
}

describe("ModelsTreeVisibilityHandler", () => {
  function createIdsCache(iModel: IModelConnection, hierarchyConfig?: ModelsTreeHierarchyConfiguration) {
    const resolvedHierarchyConfig = mergeWithDefaults({ defaults: defaultHierarchyConfiguration, overrides: hierarchyConfig });
    const queryExecutor = createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(iModel), "unbounded");
    const baseIdsCache = new BaseIdsCache({
      queryExecutor,
      elementClassName: resolvedHierarchyConfig.elements.baseClass,
      type: "3d",
    });
    const idsCache = new ModelsTreeIdsCache({
      queryExecutor,
      hierarchyConfig: resolvedHierarchyConfig,
      baseIdsCache,
    });
    return idsCache;
  }

  beforeAll(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  afterAll(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  describe("#unit", () => {
    function createFakeIModelAccess(): ECClassHierarchyInspector {
      return {
        classDerivesFrom: vi.fn(() => false),
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
        changeCategoriesVisibilityStatus: vi.fn(async ({ originalImplementation }) => originalImplementation()),
        changeModelsVisibilityStatus: vi.fn(async ({ originalImplementation }) => originalImplementation()),
        changeElementsVisibilityStatus: vi.fn(async ({ originalImplementation }) => originalImplementation()),
      };
      const handler = createModelsTreeVisibilityHandler({
        viewport: props?.viewport ?? createFakeViewport(),
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
        using viewport = createFakeViewport();
        const idsCache = createIdsCache(viewport.iModel);
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
        await expect(handler.getVisibilityStatus(node)).resolves.toMatchObject({ state: "hidden" });

        useOriginalImplFlag = true;
        await expect(handler.getVisibilityStatus(node)).resolves.toMatchObject({ state: "visible" });
      });
    });

    describe("getVisibilityStatus", () => {
      describe("subject", () => {
        it("can be overridden", async () => {
          const overrides = {
            getSubjectsVisibilityStatus: vi.fn().mockResolvedValue(createVisibilityStatus("visible")),
          };
          using viewport = createFakeViewport();
          const idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          const status = await handler.getVisibilityStatus(createSubjectHierarchyNode());
          expect(status.state).toBe("visible");
          expect(overrides.getSubjectsVisibilityStatus).toHaveBeenCalled();
        });

        it("returns disabled when active view is not spatial", async () => {
          const node = createSubjectHierarchyNode();
          using viewport = createFakeViewport({ viewType: "2d" });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ isDisabled: true });
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
          expect(result).toMatchObject({ state: "visible" });
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
          expect(result).toMatchObject({ state: "visible" });
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
          expect(result).toMatchObject({ state: "hidden" });
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
          expect(result).toMatchObject({ state: "partial" });
        });
      });

      describe("model", () => {
        it("is disabled when active view is not spatial", async () => {
          const node = createModelHierarchyNode();

          using viewport = createFakeViewport({ viewType: "2d" });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ isDisabled: true });
        });

        describe("visible", () => {
          it("when enabled and has no categories", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            using handlerResult = createHandler();
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "visible" });
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
            expect(result).toMatchObject({ state: "visible" });
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
              viewport: createFakeViewport({
                isAlwaysDrawnExclusive: true,
                alwaysDrawn: new Set([...categoryElements.values()].flat()),
                queryHandler: () =>
                  [...categoryElements].flatMap(([categoryId, elements]) => {
                    return elements.map((elementId) => ({ categoryElementPath: `${categoryId};${elementId}`, modelId }));
                  }),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "visible" });
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
              viewport: createFakeViewport({
                alwaysDrawn: new Set(),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "visible" });
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
              viewport: createFakeViewport({
                alwaysDrawn: new Set(["0xfff"]),
                neverDrawn: new Set(["0xeee"]),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "visible" });
          });
        });

        describe("hidden", () => {
          it("when `viewport.view.viewsModel` returns false", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            using handlerResult = createHandler({
              viewport: createFakeViewport({
                viewsModel: vi.fn(() => false),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
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
              viewport: createFakeViewport({
                viewsCategory: vi.fn(() => false),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
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
              viewport: createFakeViewport({
                neverDrawn: new Set([...categoryElements.values()].flat()),
                queryHandler: () =>
                  [...categoryElements].flatMap(([categoryId, elements]) => {
                    return elements.map((elementId) => ({ categoryElementPath: `${categoryId};${elementId}`, modelId }));
                  }),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
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
              viewport: createFakeViewport({
                alwaysDrawn: new Set(["0xffff"]),
                isAlwaysDrawnExclusive: true,
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
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
              viewport: createFakeViewport({
                isAlwaysDrawnExclusive: true,
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
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
              viewport: createFakeViewport({
                viewsCategory: vi.fn(() => false),
                alwaysDrawn: new Set(["0xfff"]),
                neverDrawn: new Set(["0xeee"]),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
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
              viewport: createFakeViewport({
                viewsCategory: vi.fn((id) => id === categories[0]),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "partial" });
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
              viewport: createFakeViewport({
                neverDrawn: new Set(["0x100"]),
                queryHandler: () => [{ categoryElementPath: "0x10;0x100", modelId }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "partial" });
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
              viewport: createFakeViewport({
                isAlwaysDrawnExclusive: true,
                alwaysDrawn: new Set(["0x100"]),
                queryHandler: () => [{ categoryElementPath: "0x10;0x100", modelId }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "partial" });
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
              viewport: createFakeViewport({
                viewsCategory: vi.fn((id) => id === categories[0]),
                alwaysDrawn: new Set(["0xfff"]),
                neverDrawn: new Set(["0xeee"]),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "partial" });
          });
        });
      });

      describe("category", () => {
        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            getCategoriesVisibilityStatus: vi.fn().mockResolvedValue(createVisibilityStatus("visible")),
          };
          using viewport = createFakeViewport();
          const idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          const status = await handler.getVisibilityStatus(createCategoryHierarchyNode({ modelId: "0x1" }));
          expect(overrides?.getCategoriesVisibilityStatus).toHaveBeenCalled();
          expect(status.state).toBe("visible");
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
              viewport: createFakeViewport({
                viewsCategory: vi.fn(() => true),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "visible" });
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
              viewport: createFakeViewport({
                getPerModelCategoryOverride: vi.fn(() => "show" as const),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "visible" });
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
              viewport: createFakeViewport({
                viewsModel: vi.fn(() => false),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
          });

          it("`viewport.view.viewsCategory` returns FALSE and there ARE NO elements in the ALWAYS drawn list", async () => {
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId: "0x1", categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeViewport({
                viewsCategory: vi.fn(() => false),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
          });

          it("when `viewport.view.viewsCategory` returns TRUE and there ARE UNRELATED elements in the EXCLUSIVE ALWAYS drawn list", async () => {
            const categoryId = "0x2";
            const elements = ["0x2", "0x3"];
            const node = createCategoryHierarchyNode({ modelId: "0x1", categoryId });
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                categoryElements: new Map([[categoryId, elements]]),
              }),
              viewport: createFakeViewport({
                alwaysDrawn: new Set(["0x4"]),
                isAlwaysDrawnExclusive: true,
                viewsCategory: vi.fn(() => true),
                queryHandler: () => [{ categoryElementPath: "0xff;0x4", modelId: "0xff" }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
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
              viewport: createFakeViewport({
                neverDrawn: new Set(elements),
                viewsCategory: vi.fn(() => true),
                queryHandler: () => elements.map((elementId) => ({ categoryElementPath: `${categoryId};${elementId}`, modelId })),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
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
              viewport: createFakeViewport({
                getPerModelCategoryOverride: vi.fn(() => "hide" as const),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
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
              viewport: createFakeViewport({
                alwaysDrawn: new Set(["0x4"]),
                isAlwaysDrawnExclusive: true,
                getPerModelCategoryOverride: vi.fn(() => "show" as const),
                queryHandler: () => [{ categoryElementPath: "0xff;0x4", modelId: "0xff" }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "hidden" });
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
              viewport: createFakeViewport({
                neverDrawn: new Set([elements[0]]),
                viewsCategory: vi.fn(() => true),
                queryHandler: () => [{ categoryElementPath: `${categoryId};${elements[0]}`, modelId }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "partial" });
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
              viewport: createFakeViewport({
                alwaysDrawn: new Set([elements[0]]),
                viewsCategory: vi.fn(() => false),
                queryHandler: () => [{ categoryElementPath: `${categoryId};${elements[0]}`, modelId }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "partial" });
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
              viewport: createFakeViewport({
                neverDrawn: new Set([elements[0]]),
                getPerModelCategoryOverride: vi.fn(() => "show" as const),
                queryHandler: () => [{ categoryElementPath: `${categoryId};${elements[0]}`, modelId }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "partial" });
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
              viewport: createFakeViewport({
                alwaysDrawn: new Set([elements[0]]),
                getPerModelCategoryOverride: vi.fn(() => "hide" as const),
                queryHandler: () => [{ categoryElementPath: `${categoryId};${elements[0]}`, modelId }],
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: "partial" });
          });
        });
      });

      describe("element", () => {
        const modelId = "0x1";
        const categoryId = "0x2";
        const elementId = "0x3";

        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            getElementsVisibilityStatus: vi.fn().mockResolvedValue(createVisibilityStatus("visible")),
          };
          using viewport = createFakeViewport();
          const idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          const status = await handler.getVisibilityStatus(createElementHierarchyNode({ modelId: "0x1", categoryId: "0x2", elementId: "0x3" }));
          expect(overrides?.getElementsVisibilityStatus).toHaveBeenCalled();
          expect(status.state).toBe("visible");
        });

        it("is hidden when model is hidden", async () => {
          const node = createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId });
          using viewport = createFakeViewport({
            viewsModel: vi.fn(() => false),
          });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "hidden" });
        });

        it("is visible when model and category is displayed", async () => {
          const node = createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId });
          using viewport = createFakeViewport({
            viewsModel: vi.fn(() => true),
            viewsCategory: vi.fn(() => true),
          });
          using handlerResult = createHandler({ viewport });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "visible" });
        });

        it("is visible if present in the always drawn list", async () => {
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          using handlerResult = createHandler({
            viewport: createFakeViewport({
              alwaysDrawn: new Set([elementId]),
            }),
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "visible" });
        });

        it("is hidden if present in the never drawn list", async () => {
          using handlerResult = createHandler({
            viewport: createFakeViewport({
              neverDrawn: new Set([elementId]),
            }),
          });
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "hidden" });
        });

        it("is hidden if other elements are present in the always drawn list and exclusive mode is enabled", async () => {
          using handlerResult = createHandler({
            viewport: createFakeViewport({
              alwaysDrawn: new Set(["0x20"]),
              isAlwaysDrawnExclusive: true,
            }),
          });
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "hidden" });
        });

        it("is visible when not present in always/never drawn sets", async () => {
          using handlerResult = createHandler({
            viewport: createFakeViewport({
              alwaysDrawn: new Set(),
              neverDrawn: new Set(),
            }),
          });
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "visible" });
        });

        it("is visible when always/never drawn sets are undefined", async () => {
          using handlerResult = createHandler();
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "visible" });
        });

        it("is visible when always/never drawn sets doesn't contain it", async () => {
          using handlerResult = createHandler({
            viewport: createFakeViewport({
              alwaysDrawn: new Set(["0xff"]),
              neverDrawn: new Set(["0xffff"]),
            }),
          });
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "visible" });
        });

        it("is hidden if category has per model override to hide", async () => {
          using handlerResult = createHandler({
            viewport: createFakeViewport({
              getPerModelCategoryOverride: () => "hide",
            }),
          });
          const { handler } = handlerResult;
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "hidden" });
        });
      });

      describe("grouping node", () => {
        const modelId = "0x1";
        const categoryId = "0x2";

        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            getElementGroupingNodeVisibilityStatus: vi.fn().mockResolvedValue(createVisibilityStatus("visible")),
          };
          using viewport = createFakeViewport();
          const idsCache = createIdsCache(viewport.iModel);
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
          expect(status.state).toBe("visible");
          expect(overrides?.getElementGroupingNodeVisibilityStatus).toHaveBeenCalled();
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
          expect(result).toMatchObject({ state: "visible" });
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
            viewport: createFakeViewport({
              neverDrawn: new Set(elementIds),
            }),
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "hidden" });
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
            viewport: createFakeViewport({
              alwaysDrawn: new Set([elementIds[0]]),
              neverDrawn: new Set([elementIds[1]]),
            }),
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "partial" });
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
          expect(result).toMatchObject({ state: "visible" });
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
            viewport: createFakeViewport({
              alwaysDrawn: new Set(["0xfff"]),
            }),
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "visible" });
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
            viewport: createFakeViewport({
              neverDrawn: new Set(["0xfff"]),
            }),
          });
          const { handler } = handlerResult;
          const result = await handler.getVisibilityStatus(node);
          expect(result).toMatchObject({ state: "visible" });
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
              viewport: createFakeViewport({
                viewsCategory: vi.fn(() => categoryOn),
              }),
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, [categoryId]]]),
                categoryElements: new Map([[categoryId, elementIds]]),
              }),
            });
            const { handler } = handlerResult;
            const result = await handler.getVisibilityStatus(node);
            expect(result).toMatchObject({ state: categoryOn ? "visible" : "hidden" });
          }
        });
      });
    });

    describe("changeVisibilityStatus", () => {
      describe("subject", () => {
        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            changeSubjectsVisibilityStatus: vi.fn().mockResolvedValue(undefined),
          };
          using viewport = createFakeViewport();
          const idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          await handler.changeVisibility(createSubjectHierarchyNode(), true);
          expect(overrides?.changeSubjectsVisibilityStatus).toHaveBeenCalled();
        });

        describe("on", () => {
          it("marks all models as visible", async () => {
            const subjectIds = ["0x1", "0x2"];
            const modelIds = [
              ["0x3", "0x4"],
              ["0x5", "0x6"],
            ];
            const node = createSubjectHierarchyNode({ ids: subjectIds });
            using viewport = createFakeViewport();
            using handlerResult = createHandler({
              idsCache: createFakeIdsCache({
                subjectModels: new Map(subjectIds.map((id, idx) => [id, modelIds[idx]])),
              }),
              viewport,
            });
            const { handler, overrides } = handlerResult;

            await handler.changeVisibility(node, true);
            expect(overrides?.changeModelsVisibilityStatus).toHaveBeenCalledWith(
              expect.objectContaining({ modelIds: expect.arrayContaining(modelIds.flat()), on: true }),
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
            expect(overrides?.changeModelsVisibilityStatus).toHaveBeenCalledWith(
              expect.objectContaining({ modelIds: expect.arrayContaining(modelIds.flat()), on: false }),
            );
          });
        });
      });

      describe("model", () => {
        describe("on", () => {
          it("adds it to the viewport", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            using viewport = createFakeViewport();
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.changeModelDisplay).toHaveBeenCalledWith({ modelIds: [modelId], display: true });
          });

          it("doesn't change always/never drawn sets if they don't have any of the model's children", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            using viewport = createFakeViewport({
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
            expect(viewport.setAlwaysDrawn).not.toHaveBeenCalled();
            expect(viewport.clearAlwaysDrawn).not.toHaveBeenCalled();
            expect(viewport.setNeverDrawn).not.toHaveBeenCalled();
            expect(viewport.clearNeverDrawn).not.toHaveBeenCalled();
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
            using viewport = createFakeViewport({
              alwaysDrawn: new Set([...alwaysDrawnElements, otherAlwaysDrawnElement]),
              neverDrawn: new Set([...neverDrawnElements, otherNeverDrawnElement]),
              queryHandler: vi.fn(async (_query: string, binder?: QueryBinder) => {
                const ids = CompressedId64Set.decompressSet((binder?.serialize() as any)[1].value);
                if (ids.size === 2 && alwaysDrawnElements.every((id) => ids.has(id))) {
                  return [
                    ...alwaysDrawnElements.map((elementId) => ({ categoryElementPath: `${categoryId};${elementId}`, modelId })),
                    { categoryElementPath: `${otherCategoryId};${otherAlwaysDrawnElement}`, modelId: otherModelId },
                  ];
                }

                if (ids.size === 2 && neverDrawnElements.every((id) => ids.has(id))) {
                  return [
                    ...neverDrawnElements.map((elementId) => ({ categoryElementPath: `${categoryId};${elementId}`, modelId })),
                    { categoryElementPath: `${otherCategoryId};${otherNeverDrawnElement}`, modelId: otherModelId },
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
            expect(viewport.alwaysDrawn).toEqual(new Set([otherAlwaysDrawnElement]));
            expect(viewport.neverDrawn).toEqual(new Set([otherNeverDrawnElement]));
          });

          it(`removes per model category overrides`, async () => {
            const modelId = "0x1";
            const categoryIds = ["0x2", "0x3", "0x4"];
            const node = createModelHierarchyNode({ modelId });
            using viewport = createFakeViewport();
            using handlerResult = createHandler({
              viewport,
              idsCache: createFakeIdsCache({
                modelCategories: new Map([[modelId, categoryIds]]),
              }),
            });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);

            expect(viewport.clearPerModelCategoryOverrides).toHaveBeenCalledWith({ modelIds: [modelId] });
          });
        });

        describe("off", () => {
          it("removes it from the viewport", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode({ modelId });
            using viewport = createFakeViewport();
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, false);
            expect(viewport.changeModelDisplay).toHaveBeenCalledWith({ modelIds: [modelId], display: false });
          });
        });
      });

      describe("category", () => {
        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            changeCategoriesVisibilityStatus: vi.fn().mockResolvedValue(undefined),
          };
          using viewport = createFakeViewport();
          const idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          await handler.changeVisibility(createCategoryHierarchyNode({ modelId: "0x1" }), true);
          expect(overrides?.changeCategoriesVisibilityStatus).toHaveBeenCalled();
        });

        describe("on", () => {
          it("sets SHOW override if model is hidden", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            using viewport = createFakeViewport({
              viewsModel: vi.fn(() => false),
              getPerModelCategoryOverride: vi.fn(() => "hide" as const),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(node, true);
            expect(viewport.setPerModelCategoryOverride).toHaveBeenCalledWith({
              modelIds: modelId,
              categoryIds: [categoryId],
              override: "show",
            });
          });

          it("sets SHOW override if model is shown but category is hidden in selector", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode({ modelId, categoryId });
            using viewport = createFakeViewport({
              viewsModel: vi.fn(() => true),
              viewsCategory: vi.fn(() => false),
              getPerModelCategoryOverride: vi.fn(() => "none" as const),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(node, true);
            expect(viewport.setPerModelCategoryOverride).toHaveBeenCalledWith({
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
            using viewport = createFakeViewport({
              viewsModel: vi.fn(() => true),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(node, false);
            expect(viewport.setPerModelCategoryOverride).toHaveBeenCalledWith({
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
            changeElementsVisibilityStatus: vi.fn().mockResolvedValue(undefined),
          };
          using viewport = createFakeViewport();
          const idsCache = createIdsCache(viewport.iModel);
          using handler = createModelsTreeVisibilityHandler({
            viewport,
            idsCache,
            overrides,
            imodelAccess: createFakeIModelAccess(),
          });

          await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, elementId }), true);
          expect(overrides.changeElementsVisibilityStatus).toHaveBeenCalled();
        });

        describe("on", () => {
          it("removes it from the never drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            using viewport = createFakeViewport({
              neverDrawn: new Set([elementId]),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.neverDrawn?.size ?? 0).toBe(0);
          });

          it("if model is hidden, shows model and adds element to always drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            using viewport = createFakeViewport({
              viewsModel: vi.fn(() => false),
              viewsCategory: vi.fn(() => false),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.changeModelDisplay).toHaveBeenCalledWith({ modelIds: modelId, display: true });
            expect(viewport.alwaysDrawn).toEqual(new Set([elementId]));
          });

          it("adds element to the always drawn list if category is hidden", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            using viewport = createFakeViewport({
              viewsCategory: vi.fn(() => false),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, true);
            expect(viewport.alwaysDrawn).toEqual(new Set([elementId]));
          });

          it("adds element to the always drawn list if exclusive mode is enabled", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            using viewport = createFakeViewport({
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
            expect(viewport.alwaysDrawn).toEqual(new Set([elementId]));
          });

          it("removes element from never drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            using viewport = createFakeViewport({
              neverDrawn: new Set([elementId]),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId }), true);
            expect(viewport.neverDrawn?.size ?? 0).toBe(0);
          });
        });

        describe("off", () => {
          it("removes it from the always drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            using viewport = createFakeViewport({
              alwaysDrawn: new Set([elementId]),
            });
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, false);
            expect(viewport.alwaysDrawn?.size ?? 0).toBe(0);
          });

          it("adds element to the never drawn list if model is visible", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            using viewport = createFakeViewport();
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, false);
            expect(viewport.neverDrawn).toEqual(new Set([elementId]));
          });

          it("doesn't add to never drawn if exclusive draw mode is enabled", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            using viewport = createFakeViewport({
              alwaysDrawn: new Set([elementId]),
              isAlwaysDrawnExclusive: true,
              viewsModel: vi.fn(() => true),
            });
            using handlerResult = createHandler({ viewport, idsCache: createFakeIdsCache({ modelCategories: new Map([[modelId, [categoryId]]]) }) });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, false);
            expect(viewport.alwaysDrawn?.size ?? 0).toBe(0);
            expect(viewport.neverDrawn?.size ?? 0).toBe(0);
          });

          it("adds element to the never drawn list if category is visible", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            using viewport = createFakeViewport();
            using handlerResult = createHandler({ viewport });
            const { handler } = handlerResult;
            await handler.changeVisibility(node, false);
            expect(viewport.neverDrawn).toEqual(new Set([elementId]));
          });
        });
      });

      describe("grouping node", () => {
        it("can be overridden", async () => {
          const overrides: ModelsTreeVisibilityHandlerProps["overrides"] = {
            changeElementGroupingNodeVisibilityStatus: vi.fn().mockResolvedValue(undefined),
          };
          using viewport = createFakeViewport();
          const idsCache = createIdsCache(viewport.iModel);
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
            expect(overrides?.changeElementGroupingNodeVisibilityStatus).toHaveBeenCalledWith(
              expect.objectContaining({
                node,
                on,
              }),
            );
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
            using viewport = createFakeViewport({
              viewsModel: vi.fn(() => true),
              viewsCategory: vi.fn(() => !on),
            });
            using handlerResult = createHandler({ idsCache, viewport });
            const { handler } = handlerResult;

            await handler.changeVisibility(node, on);
            expect(on ? viewport.alwaysDrawn : viewport.neverDrawn).toEqual(new Set(elements));
          });
        }

        testChildElementsChange(true);
        testChildElementsChange(false);
      });
    });
  });
});

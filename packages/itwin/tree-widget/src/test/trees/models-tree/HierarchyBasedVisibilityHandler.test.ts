/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import path from "path";
import { filter, from, map, mergeMap, of } from "rxjs";
import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import { Code, ColorDef, IModel, RenderMode } from "@itwin/core-common";
import { IModelApp, NoRenderApp, OffScreenViewport, PerModelCategoryVisibility, SpatialViewState, ViewRect } from "@itwin/core-frontend";
import {
  buildTestIModel,
  HierarchyCacheMode,
  initialize as initializePresentationTesting,
  terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { toVoidPromise } from "../../../components/trees/common/Rxjs";
import { createHierarchyBasedVisibilityHandler } from "../../../components/trees/models-tree/HierarchyBasedVisibilityHandler";
import { createElementIdsCache } from "../../../components/trees/models-tree/internal/ElementIdsCache";
import { createQueryHandler } from "../../../components/trees/models-tree/internal/QueryHandler";
import { createVisibilityStatus } from "../../../components/trees/models-tree/internal/Tooltip";
import { createRuleset } from "../../../components/trees/models-tree/internal/Utils";
import { addModel, addPartition, addPhysicalObject, addSpatialCategory } from "../../IModelUtils";
import { TestUtils } from "../../TestUtils";
import {
  createCategoryNode,
  createElementClassGroupingNode,
  createElementNode,
  createFakeElementIdsCache,
  createFakeQueryHandler,
  createFakeSinonViewport,
  createModelNode,
  createSubjectNode,
} from "../Common";

import type { Id64String } from "@itwin/core-bentley";
import type { VisibilityHandlerOverrides } from "../../../components/trees/models-tree/HierarchyBasedVisibilityHandler";
import type { Visibility } from "../../../components/trees/models-tree/internal/Tooltip";
import type { IQueryHandler } from "../../../components/trees/models-tree/internal/QueryHandler";
import type { IElementIdsCache } from "../../../components/trees/models-tree/internal/ElementIdsCache";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { TreeNodeItem } from "@itwin/components-react";
import type { IFilteredPresentationTreeDataProvider, PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { IVisibilityHandler } from "../../../tree-widget-react";
interface VisibilityOverrides {
  models?: Map<Id64String, Visibility>;
  categories?: Map<Id64String, Visibility>;
  elements?: Map<Id64String, Visibility>;
}

function createVisibilityHandlerWrapper(props?: {
  overrides?: VisibilityOverrides;
  queryHandler?: IQueryHandler;
  elementIdsCache?: IElementIdsCache;
  viewport?: Viewport;
}) {
  const queryHandler = props?.queryHandler ?? createFakeQueryHandler();
  const overrides: VisibilityHandlerOverrides = {
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
      (async ({ id, originalImplementation }) => {
        const res = props.overrides!.elements!.get(id);
        return res ? createVisibilityStatus(res) : originalImplementation();
      }),
    changeCategoryState: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
    changeModelState: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
    changeElementState: sinon.fake(async ({ originalImplementation }) => originalImplementation()),
  };

  return {
    handler: createHierarchyBasedVisibilityHandler({
      queryHandler,
      elementIdsCache: props?.elementIdsCache ?? createFakeElementIdsCache(),
      viewport: props?.viewport ?? createFakeSinonViewport(),
      overrides,
    }),
    overrides,
  };
}

describe("VisibilityStateHandler", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  describe("getVisibilityStatus", () => {
    it("returns disabled when node is not an instance node", async () => {
      const node: PresentationTreeNodeItem = {
        key: {
          type: "custom",
          version: 0,
          pathFromRoot: [],
        },
        id: "custom",
        label: PropertyRecord.fromString("custom"),
      };

      const { handler } = createVisibilityHandlerWrapper();
      const result = await handler.getVisibilityStatus(node);
      expect(result).to.include({ state: "hidden", isDisabled: true });
    });

    it("returns disabled if node is not PresentationTreeNodeItem", async () => {
      const { handler } = createVisibilityHandlerWrapper();
      const result = await handler.getVisibilityStatus({} as TreeNodeItem);
      expect(result.state).to.be.eq("hidden");
      expect(result.isDisabled).to.be.true;
    });

    describe("subject", () => {
      it("can be overridden", async () => {
        const overrides = {
          getSubjectNodeVisibility: sinon.fake.resolves(createVisibilityStatus("visible")),
        };
        const handler = createHierarchyBasedVisibilityHandler({
          elementIdsCache: createFakeElementIdsCache(),
          queryHandler: createFakeQueryHandler(),
          viewport: createFakeSinonViewport(),
          overrides,
        });

        const status = await handler.getVisibilityStatus(createSubjectNode());
        expect(status.state).to.eq("visible");
        expect(overrides.getSubjectNodeVisibility).to.be.called;
      });

      it("returns disabled when active view is not spatial", async () => {
        const node = createSubjectNode();
        const viewport = createFakeSinonViewport({
          view: {
            isSpatialView: sinon.fake.returns(false),
          },
        });
        const { handler } = createVisibilityHandlerWrapper({ viewport });
        const result = await handler.getVisibilityStatus(node);
        expect(viewport.view.isSpatialView).to.be.called;
        expect(result).to.include({ state: "hidden", isDisabled: true });
      });

      it("is visible when subject contains no models", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        const queryHandler = createFakeQueryHandler({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
        });
        const { handler } = createVisibilityHandlerWrapper({ queryHandler });
        const result = await handler.getVisibilityStatus(node);
        expect(result).to.include({ state: "visible" });
      });

      it("is visible when all models are displayed", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        const queryHandler = createFakeQueryHandler({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
          subjectModels: new Map([
            [subjectIds[0], ["0x3"]],
            [subjectIds[1], ["0x4"]],
          ]),
        });
        const { handler } = createVisibilityHandlerWrapper({
          queryHandler,
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
        const node = createSubjectNode(subjectIds);
        const queryHandler = createFakeQueryHandler({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
          subjectModels: new Map([
            [subjectIds[0], ["0x3"]],
            [subjectIds[1], ["0x4"]],
          ]),
        });
        const { handler } = createVisibilityHandlerWrapper({
          queryHandler,
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
        const node = createSubjectNode(subjectIds);
        const queryHandler = createFakeQueryHandler({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
          subjectModels: new Map([
            [subjectIds[0], ["0x3"]],
            [subjectIds[1], ["0x4"]],
          ]),
        });
        const { handler } = createVisibilityHandlerWrapper({
          queryHandler,
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

      describe("filtered", () => {
        it("uses filtered data provider", async () => {
          const { handler } = createVisibilityHandlerWrapper({
            overrides: {
              elements: new Map([
                ["0x10", "visible"],
                ["0x20", "visible"],
              ]),
            },
          });
          const filteredDataProvider = {
            nodeMatchesFilter: sinon.fake.returns(false),
            getNodes: sinon.fake.resolves([createElementNode(undefined, undefined, false, "0x10"), createElementNode(undefined, undefined, false, "0x20")]),
          } as unknown as IFilteredPresentationTreeDataProvider;
          handler.filteredDataProvider = filteredDataProvider;

          const node = createSubjectNode(["0x1", "0x2"]);
          const visibility = await handler.getVisibilityStatus(node);
          expect(visibility.state).to.eq("visible");
          expect(filteredDataProvider.nodeMatchesFilter).to.be.called;
          expect(filteredDataProvider.getNodes).to.be.called;
        });
      });
    });

    describe("model", () => {
      it("is disabled when active view is not spatial", async () => {
        const node = createModelNode();
        const viewport = createFakeSinonViewport({
          view: {
            isSpatialView: sinon.fake.returns(false),
          },
        });
        const { handler } = createVisibilityHandlerWrapper({ viewport });
        const result = await handler.getVisibilityStatus(node);
        expect(viewport.view.isSpatialView).to.be.called;
        expect(result).to.include({ state: "hidden", isDisabled: true });
      });

      describe("visible", () => {
        it("when `viewport.view.viewsModel` returns true and all categories are displayed", async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryHandler = createFakeQueryHandler({
            modelCategories: new Map([[modelId, categories]]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("when `viewport.view.viewsModel` returns true and all elements are in the exclusive always drawn list", async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryHandler = createFakeQueryHandler({
            modelCategories: new Map([[modelId, categories]]),
            categoryElements: new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              isAlwaysDrawnExclusive: true,
              alwaysDrawn: new Set(["0x100", "0x200", "0x300", "0x400"]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("when `viewport.view.viewsModel` returns true when always drawn list is empty", async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryHandler = createFakeQueryHandler({
            modelCategories: new Map([[modelId, categories]]),
            categoryElements: new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("when `viewport.view.viewsModel` returns false but all child elements are in the always drawn list", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const modelCategories = new Map([[modelId, ["0x10", "0x20"]]]);
          const categoryElements = new Map([
            ["0x10", ["0x100", "0x200"]],
            ["0x20", ["0x300", "0x400"]],
          ]);
          const queryHandler = createFakeQueryHandler({
            modelCategories,
            categoryElements,
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set([...categoryElements.values()].flat()),
              view: {
                viewsModel: sinon.fake.returns(false),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });
      });

      describe("hidden", () => {
        it("when `viewport.view.viewsModel` returns false and all categories are hidden", async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryHandler = createFakeQueryHandler({
            modelCategories: new Map([[modelId, categories]]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(false),
                viewsCategory: sinon.fake.returns(false),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("when `viewport.view.viewsModel` returns false and all categories visible but no elements are in always drawn list", async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryHandler = createFakeQueryHandler({
            modelCategories: new Map([[modelId, categories]]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0xfff"]),
              view: {
                viewsModel: sinon.fake.returns(false),
                viewsCategory: sinon.fake.returns(true),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("when `viewport.view.viewsModel` returns true but all categories are hidden", async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryHandler = createFakeQueryHandler({
            modelCategories: new Map([[modelId, categories]]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(true),
                viewsCategory: sinon.fake.returns(false),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("when `viewport.view.viewsModel` returns true but all nested child elements are in never drawn list", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const modelCategories = new Map([[modelId, ["0x10", "0x20"]]]);
          const categoryElements = new Map([
            ["0x10", ["0x100", "0x200"]],
            ["0x20", ["0x300", "0x400"]],
          ]);
          const queryHandler = createFakeQueryHandler({
            modelCategories,
            categoryElements,
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              neverDrawn: new Set([...categoryElements.values()].flat()),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("when `viewport.view.viewsModel` returns true but none of the nested child elements are in exclusive drawn list", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const modelCategories = new Map([[modelId, ["0x10", "0x20"]]]);
          const categoryElements = new Map([
            ["0x10", ["0x100", "0x200"]],
            ["0x20", ["0x300", "0x400"]],
          ]);
          const queryHandler = createFakeQueryHandler({
            modelCategories,
            categoryElements,
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0xffff"]),
              isAlwaysDrawnExclusive: true,
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });
      });

      describe("partially visible", () => {
        it(`when 'viewport.view.viewsModel' returns true and at least one category is hidden`, async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryHandler = createFakeQueryHandler({
            modelCategories: new Map([[modelId, categories]]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(true),
                viewsCategory: sinon.fake((id) => id === categories[0]),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });

        it(`when 'viewport.view.viewsModel' returns FALSE and at least one category is VISIBLE`, async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryHandler = createFakeQueryHandler({
            modelCategories: new Map([[modelId, categories]]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(false),
                viewsCategory: sinon.fake((id) => id === categories[0]),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });

        it("when `viewport.view.viewsModel` returns true but some of the nested child elements are in never drawn list", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const queryHandler = createFakeQueryHandler({
            modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
            categoryElements: new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(["0x100"]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });

        it("when `viewport.view.viewsModel` returns true but some of the nested child elements are not in the exclusive always drawn list", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const queryHandler = createFakeQueryHandler({
            modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
            categoryElements: new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              isAlwaysDrawnExclusive: true,
              alwaysDrawn: new Set(["0x100"]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });

        it("when `viewport.view.viewsModel` returns false but some of the nested child elements are in the always drawn list", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const queryHandler = createFakeQueryHandler({
            modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
            categoryElements: new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x100"]),
              view: {
                viewsModel: () => false,
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });
      });
    });

    describe("category", () => {
      it("can be overridden", async () => {
        const overrides: VisibilityHandlerOverrides = {
          getCategoryDisplayStatus: sinon.fake.resolves(createVisibilityStatus("visible")),
        };
        const handler = createHierarchyBasedVisibilityHandler({
          elementIdsCache: createFakeElementIdsCache(),
          queryHandler: createFakeQueryHandler(),
          viewport: createFakeSinonViewport(),
          overrides,
        });

        const status = await handler.getVisibilityStatus(createCategoryNode());
        expect(status.state).to.eq("visible");
        expect(overrides.getCategoryDisplayStatus).to.be.called;
      });

      describe("is visible", () => {
        it("when `viewport.view.viewsCategory` returns TRUE and there are NO CHILD elements in the NEVER drawn list", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
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

        it("when there's a per model category override to SHOW and there are NO CHILD elements in the NEVER drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryNode({ id: modelId, className: "" }, categoryId);
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
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
        it("when `viewport.view.viewsCategory` returns FALSE and there ARE NO CHILD elements in the ALWAYS drawn list", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
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
          const node = createCategoryNode(undefined, categoryId);
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x4"]),
              isAlwaysDrawnExclusive: true,
              view: {
                viewsCategory: sinon.fake.returns(true),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("when `viewport.view.viewsCategory` returns TRUE and ALL CHILD elements are in the NEVER drawn list", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(["0x2", "0x3"]),
              view: {
                viewsCategory: sinon.fake.returns(true),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("when there's a per model category override to HIDE and there ARE NO CHILD elements in the ALWAYS drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryNode({ id: modelId, className: "" }, categoryId);
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
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
          const node = createCategoryNode({ id: modelId, className: "" }, categoryId);
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x4"]),
              isAlwaysDrawnExclusive: true,
              perModelCategoryVisibility: {
                getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Show),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });
      });

      describe("is partially visible", () => {
        it("when `viewport.view.viewsCategory` returns TRUE and there ARE SOME CHILD elements in the NEVER drawn list", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(["0x2"]),
              view: {
                viewsCategory: sinon.fake.returns(true),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });

        it("when `viewport.view.viewsCategory` returns FALSE and there ARE SOME CHILD elements in the ALWAYS drawn list", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x2"]),
              view: {
                viewsCategory: sinon.fake.returns(false),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });

        it("when there's a per model category override to SHOW and there ARE SOME CHILD elements in the NEVER drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryNode({ id: modelId, className: "" }, categoryId);
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(["0x2"]),
              perModelCategoryVisibility: {
                getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Show),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });

        it("when there's a per model category override to HIDE and there ARE SOME CHILD elements in the ALWAYS drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryNode({ id: modelId, className: "" }, categoryId);
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x2"]),
              perModelCategoryVisibility: {
                getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Hide),
              },
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });
      });
    });

    describe("element", async () => {
      it("is disabled when has no category or model", async () => {
        const { handler } = createVisibilityHandlerWrapper();
        let result = await handler.getVisibilityStatus(createElementNode());
        expect(result.isDisabled).to.be.true;
        result = await handler.getVisibilityStatus(createElementNode("0x1"));
        expect(result.isDisabled).to.be.true;
      });

      it("is visible when its category and all child elements are displayed", async () => {
        const modelId = "0x1";
        const categoryId = "0x2";
        const elementId = "0x3";
        const childElements = ["0x10", "0x20"];
        const node = createElementNode(modelId, categoryId, true, elementId);
        const { handler } = createVisibilityHandlerWrapper({
          elementIdsCache: createFakeElementIdsCache({
            getAssemblyElementIds: sinon.stub().withArgs(elementId).returns(from(childElements)),
          }),
          overrides: {
            elements: new Map(childElements.map((x) => [x, "visible"])),
          },
        });
        const result = await handler.getVisibilityStatus(node);
        expect(result).to.include({ state: "visible" });
      });

      it("is hidden when all child elements are hidden", async () => {
        const elementId = "0x1";
        const childElements = ["0x10", "0x20"];
        const node = createElementNode(undefined, undefined, true, elementId);
        const { handler } = createVisibilityHandlerWrapper({
          elementIdsCache: createFakeElementIdsCache({
            getAssemblyElementIds: sinon.stub().withArgs(elementId).returns(from(childElements)),
          }),
          viewport: createFakeSinonViewport({
            neverDrawn: new Set(childElements),
          }),
        });
        const result = await handler.getVisibilityStatus(node);
        expect(result).to.include({ state: "hidden" });
      });

      it("is partially visible when at least one element is displayed and at least one element is hidden", async () => {
        const elementId = "0x1";
        const childElements = ["0x10", "0x20"];
        const node = createElementNode(undefined, undefined, true, elementId);
        const { handler } = createVisibilityHandlerWrapper({
          elementIdsCache: createFakeElementIdsCache({
            getAssemblyElementIds: sinon.stub().withArgs(elementId).returns(from(childElements)),
          }),
          viewport: createFakeSinonViewport({
            alwaysDrawn: new Set([childElements[0]]),
            neverDrawn: new Set([childElements[1]]),
          }),
        });
        const result = await handler.getVisibilityStatus(node);
        expect(result).to.include({ state: "partial" });
      });

      describe("no children", () => {
        it("doesn't query children if known to have none", async () => {
          const obs = from(new Array<string>());
          // eslint-disable-next-line deprecation/deprecation
          const subscribeSpy = sinon.spy(obs.subscribe);
          const elementIdsCache = createFakeElementIdsCache({
            getAssemblyElementIds: () => obs,
          });
          const { handler } = createVisibilityHandlerWrapper({
            elementIdsCache,
          });
          const result = await handler.getVisibilityStatus(createElementNode("0x1", "0x2", false, "0x3"));
          expect(result).to.include({ state: "visible" });
          expect(subscribeSpy).not.to.be.called;
        });

        it("is visible if present in the always drawn list", async () => {
          const elementId = "0x1";
          const node = createElementNode(undefined, undefined, false, elementId);
          const { handler } = createVisibilityHandlerWrapper({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set([elementId]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden if present in the never drawn list", async () => {
          const elementId = "0x1";
          const node = createElementNode(undefined, undefined, false, elementId);
          const { handler } = createVisibilityHandlerWrapper({
            viewport: createFakeSinonViewport({
              neverDrawn: new Set([elementId]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is hidden if other elements are present in the always drawn list and exclusive mode is enabled", async () => {
          const elementId = "0x1";
          const node = createElementNode(undefined, undefined, false, elementId);
          const { handler } = createVisibilityHandlerWrapper({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x2"]),
              isAlwaysDrawnExclusive: true,
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is visible when not present in always/never drawn sets", async () => {
          const node = createElementNode("0x1", "0x2", false, "0x3");
          const { handler } = createVisibilityHandlerWrapper({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(),
              neverDrawn: new Set(),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible when always/never drawn sets are undefined", async () => {
          const node = createElementNode("0x1", "0x2", false, "0x3");
          const { handler } = createVisibilityHandlerWrapper();
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });
      });
    });

    describe("grouping node", () => {
      it("can be overridden", async () => {
        const overrides: VisibilityHandlerOverrides = {
          getElementGroupingNodeDisplayStatus: sinon.fake.resolves(createVisibilityStatus("visible")),
        };
        const handler = createHierarchyBasedVisibilityHandler({
          elementIdsCache: createFakeElementIdsCache(),
          queryHandler: createFakeQueryHandler(),
          viewport: createFakeSinonViewport(),
          overrides,
        });

        const status = await handler.getVisibilityStatus(createElementClassGroupingNode([]));
        expect(status.state).to.eq("visible");
        expect(overrides.getElementGroupingNodeDisplayStatus).to.be.called;
      });

      it("is visible if all node elements are visible", async () => {
        const elementIds = ["0x1", "0x2"];
        const node = createElementClassGroupingNode(elementIds);
        const spy = sinon.fake.returns(of({ elementIds: from(elementIds) }));
        const { handler } = createVisibilityHandlerWrapper({
          elementIdsCache: createFakeElementIdsCache({ getGroupedElementIds: spy }),
          overrides: {
            elements: new Map(elementIds.map((x) => [x, "visible"])),
          },
        });
        const result = await handler.getVisibilityStatus(node);
        expect(result).to.include({ state: "visible" });
        expect(spy).to.be.called.calledOnceWith(node.key);
      });

      it("is hidden if all node elements are hidden", async () => {
        const elementIds = ["0x1", "0x2"];
        const node = createElementClassGroupingNode(elementIds);
        const spy = sinon.fake.returns(of({ elementIds: from(elementIds) }));
        const { handler } = createVisibilityHandlerWrapper({
          elementIdsCache: createFakeElementIdsCache({ getGroupedElementIds: spy }),
          overrides: {
            elements: new Map(elementIds.map((x) => [x, "hidden"])),
          },
        });
        const result = await handler.getVisibilityStatus(node);
        expect(result).to.include({ state: "hidden" });
        expect(spy).to.be.called.calledOnceWith(node.key);
      });

      it("is partially visible if some node elements are hidden", async () => {
        const elementIds = ["0x1", "0x2"];
        const node = createElementClassGroupingNode(elementIds);
        const spy = sinon.fake.returns(of({ elementIds: from(elementIds) }));
        const { handler } = createVisibilityHandlerWrapper({
          elementIdsCache: createFakeElementIdsCache({ getGroupedElementIds: spy }),
          overrides: {
            elements: new Map([
              [elementIds[0], "visible"],
              [elementIds[1], "hidden"],
            ]),
          },
        });
        const result = await handler.getVisibilityStatus(node);
        expect(result).to.include({ state: "partial" });
        expect(spy).to.be.called.calledOnceWith(node.key);
      });
    });
  });

  describe("changeVisibilityStatus", () => {
    describe("subject", () => {
      it("can be overridden", async () => {
        const overrides: VisibilityHandlerOverrides = {
          changeSubjectNodeState: sinon.fake.resolves(undefined),
        };
        const handler = createHierarchyBasedVisibilityHandler({
          elementIdsCache: createFakeElementIdsCache(),
          queryHandler: createFakeQueryHandler(),
          viewport: createFakeSinonViewport(),
          overrides,
        });

        await handler.changeVisibility(createSubjectNode(["0x1"]), true);
        expect(overrides.changeSubjectNodeState).to.be.called;
      });

      describe("on", () => {
        it("marks all models as visible", async () => {
          const subjectIds = ["0x1", "0x2"];
          const modelIds = [
            ["0x3", "0x4"],
            ["0x5", "0x6"],
          ];
          const node = createSubjectNode(subjectIds);
          const viewport = createFakeSinonViewport();
          const { handler, overrides } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              subjectModels: new Map(subjectIds.map((id, idx) => [id, modelIds[idx]])),
            }),
            viewport,
          });

          await handler.changeVisibility(node, true);
          expect(overrides.changeModelState).to.be.calledOnceWith(sinon.match({ ids: sinon.match.set.deepEquals(new Set(modelIds.flat())), on: true }));
        });
      });

      describe("off", () => {
        it("marks all models hidden", async () => {
          const subjectIds = ["0x1", "0x2"];
          const modelIds = [
            ["0x3", "0x4"],
            ["0x5", "0x6"],
          ];
          const node = createSubjectNode(subjectIds);
          const { handler, overrides } = createVisibilityHandlerWrapper({
            queryHandler: createFakeQueryHandler({
              subjectModels: new Map(subjectIds.map((id, idx) => [id, modelIds[idx]])),
            }),
          });

          await handler.changeVisibility(node, false);
          expect(overrides.changeModelState).to.be.calledOnceWith(sinon.match({ ids: sinon.match.set.deepEquals(new Set(modelIds.flat())), on: false }));
        });
      });

      describe("filtered", () => {
        it("uses filtered data provider", async () => {
          const { handler } = createVisibilityHandlerWrapper();
          const filteredDataProvider = {
            nodeMatchesFilter: sinon.fake.returns(false),
            getNodes: sinon.fake.resolves([createElementNode(undefined, undefined, false, "0x10"), createElementNode(undefined, undefined, false, "0x20")]),
          } as unknown as IFilteredPresentationTreeDataProvider;
          handler.filteredDataProvider = filteredDataProvider;

          const node = createSubjectNode(["0x1", "0x2"]);
          await handler.changeVisibility(node, false);

          expect(filteredDataProvider.nodeMatchesFilter).to.be.called;
          expect(filteredDataProvider.getNodes).to.be.called;
        });
      });
    });

    describe("model", () => {
      function testCategoryStateChange(state: "visible" | "hidden") {
        it(`marks all categories ${state}`, async () => {
          const modelId = "0x1";
          const categoryIds = ["0x2", "0x3", "0x4"];
          const node = createModelNode(modelId);
          const viewport = createFakeSinonViewport();
          const { handler } = createVisibilityHandlerWrapper({
            viewport,
            queryHandler: createFakeQueryHandler({
              modelCategories: new Map([[modelId, categoryIds]]),
            }),
          });
          const visible = state === "visible";
          await handler.changeVisibility(node, visible);

          expect(viewport.changeCategoryDisplay).to.be.calledOnceWith(sinon.match.set.deepEquals(new Set(categoryIds)), state === "visible", true);
        });
      }

      function testAlwaysAndNeverDrawnChildrenAccess(visibility: boolean) {
        it("doesn't change always/never drawn sets if they don't have any of the model's children", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const viewport = createFakeSinonViewport({
            alwaysDrawn: new Set(["abcd", "efgh"]),
            neverDrawn: new Set(["1234", "3456"]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            viewport,
            queryHandler: createFakeQueryHandler({
              modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            }),
          });
          await handler.changeVisibility(node, visibility);
          expect(viewport.setAlwaysDrawn).not.to.be.called;
          expect(viewport.clearAlwaysDrawn).not.to.be.called;
          expect(viewport.setNeverDrawn).not.to.be.called;
          expect(viewport.clearNeverDrawn).not.to.be.called;
        });

        it("clears always and never drawn children", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const viewport = createFakeSinonViewport({
            alwaysDrawn: new Set(["0x100", "0x200", "abcd"]),
            neverDrawn: new Set(["0x300", "0x400", "1234"]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            viewport,
            queryHandler: createFakeQueryHandler({
              modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            }),
          });
          await handler.changeVisibility(node, visibility);
          expect(viewport.alwaysDrawn).to.deep.eq(new Set(["abcd"]));
          expect(viewport.neverDrawn).to.deep.eq(new Set(["1234"]));
        });
      }

      describe("on", () => {
        it("marks itself visible", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const viewport = createFakeSinonViewport();
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          await handler.changeVisibility(node, true);
          expect(viewport.addViewedModels).to.be.calledOnceWith(modelId);
        });

        testAlwaysAndNeverDrawnChildrenAccess(true);
        testCategoryStateChange("visible");
      });

      describe("off", () => {
        it("marks itself hidden", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const viewport = createFakeSinonViewport();
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          await handler.changeVisibility(node, false);
          expect(viewport.changeModelDisplay).to.be.calledOnceWith(modelId, false);
        });

        testAlwaysAndNeverDrawnChildrenAccess(false);
        testCategoryStateChange("hidden");
      });
    });

    describe("category", () => {
      it("can be overridden", async () => {
        const overrides: VisibilityHandlerOverrides = {
          changeCategoryState: sinon.fake.resolves(undefined),
        };
        const handler = createHierarchyBasedVisibilityHandler({
          elementIdsCache: createFakeElementIdsCache(),
          queryHandler: createFakeQueryHandler(),
          viewport: createFakeSinonViewport(),
          overrides,
        });

        await handler.changeVisibility(createCategoryNode(), true);
        expect(overrides.changeCategoryState).to.be.called;
      });

      describe("on", () => {
        it("calls change category display if has no model", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const viewport = createFakeSinonViewport();
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          await handler.changeVisibility(node, true);
          expect(viewport.changeCategoryDisplay).to.be.calledWith(categoryId, true, true);
        });

        it("removes HIDE override if model is shown", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryNode(modelId, categoryId);
          const viewport = createFakeSinonViewport({
            viewsModel: sinon.fake.returns(false),
            perModelCategoryVisibility: {
              getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Hide),
            },
          });
          const { handler } = createVisibilityHandlerWrapper({ viewport });

          await handler.changeVisibility(node, true);
          expect(viewport.perModelCategoryVisibility.setOverride).to.be.calledWith(modelId, categoryId, PerModelCategoryVisibility.Override.None);
        });
      });

      describe("off", () => {
        it("calls change category display if has no model", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const viewport = createFakeSinonViewport();
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          await handler.changeVisibility(node, false);
          expect(viewport.changeCategoryDisplay).to.be.calledWith(categoryId, false, sinon.match.any);
        });

        it("sets HIDE override if model is visible", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryNode(modelId, categoryId);
          const viewport = createFakeSinonViewport({
            viewsModel: sinon.fake.returns(true),
          });
          const { handler } = createVisibilityHandlerWrapper({ viewport });

          await handler.changeVisibility(node, false);
          expect(viewport.perModelCategoryVisibility.setOverride).to.be.calledWith(modelId, categoryId, PerModelCategoryVisibility.Override.Hide);
        });
      });
    });

    describe("element", () => {
      it("can be overridden", async () => {
        const overrides: VisibilityHandlerOverrides = {
          changeElementState: sinon.fake.resolves(undefined),
        };
        const handler = createHierarchyBasedVisibilityHandler({
          elementIdsCache: createFakeElementIdsCache(),
          queryHandler: createFakeQueryHandler(),
          viewport: createFakeSinonViewport(),
          overrides,
        });

        await handler.changeVisibility(createElementNode(), true);
        expect(overrides.changeElementState).to.be.called;
      });

      describe("on", () => {
        it("removes it from the never drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const node = createElementNode(modelId, categoryId, false, elementId);
          const viewport = createFakeSinonViewport({
            neverDrawn: new Set([elementId]),
          });
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          await handler.changeVisibility(node, true);
          expect(viewport.neverDrawn?.size ?? 0).to.eq(0);
        });

        it("adds element to the always drawn list if model is hidden", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const node = createElementNode(modelId, categoryId, false, elementId);
          const viewport = createFakeSinonViewport({
            view: {
              viewsModel: sinon.fake.returns(false),
            },
          });
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          await handler.changeVisibility(node, true);
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId]));
        });

        it("adds element to the always drawn list if category is hidden", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const node = createElementNode(modelId, categoryId, false, elementId);
          const viewport = createFakeSinonViewport({
            view: {
              viewsCategory: sinon.fake.returns(false),
            },
          });
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          await handler.changeVisibility(node, true);
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId]));
        });

        it("adds element to the always drawn list if exclusive mode is enabled", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const node = createElementNode(modelId, categoryId, false, elementId);
          const viewport = createFakeSinonViewport({
            isAlwaysDrawnExclusive: true,
          });
          const { handler } = createVisibilityHandlerWrapper({
            viewport,
            overrides: {
              models: new Map([[modelId, "hidden"]]),
            },
          });
          await handler.changeVisibility(node, true);
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId]));
        });

        it("applies same change to all child elements", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const childElements = ["0x4", "0x5", "0x6"];
          const elementIdsCache = createFakeElementIdsCache({
            getAssemblyElementIds: sinon.fake.returns(from(childElements)),
          });
          const viewport = createFakeSinonViewport({
            view: {
              viewsModel: () => false,
            },
          });
          const { handler } = createVisibilityHandlerWrapper({
            elementIdsCache,
            viewport,
          });

          await handler.changeVisibility(createElementNode(modelId, categoryId, undefined, elementId), true);
          expect(elementIdsCache.getAssemblyElementIds).to.be.called;
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId, ...childElements]));
        });
      });

      describe("off", () => {
        it("removes it from the always drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const node = createElementNode(modelId, categoryId, false, elementId);
          const viewport = createFakeSinonViewport({
            alwaysDrawn: new Set([elementId]),
          });
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          await handler.changeVisibility(node, false);
          expect(viewport.alwaysDrawn?.size ?? 0).to.eq(0);
        });

        it("adds element to the never drawn list if model is visible", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const node = createElementNode(modelId, categoryId, false, elementId);
          const viewport = createFakeSinonViewport();
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          await handler.changeVisibility(node, false);
          expect(viewport.neverDrawn).to.deep.eq(new Set([elementId]));
        });

        it("doesn't add to never drawn if exclusive draw mode is enabled", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const node = createElementNode(modelId, categoryId, false, elementId);
          const viewport = createFakeSinonViewport({
            alwaysDrawn: new Set([elementId]),
            isAlwaysDrawnExclusive: true,
            view: {
              viewsModel: sinon.fake.returns(true),
            },
          });
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          await handler.changeVisibility(node, false);
          expect(viewport.alwaysDrawn?.size ?? 0).to.eq(0);
          expect(viewport.neverDrawn?.size ?? 0).to.eq(0);
        });

        it("adds element to the never drawn list if category is visible", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const node = createElementNode(modelId, categoryId, false, elementId);
          const viewport = createFakeSinonViewport();
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          await handler.changeVisibility(node, false);
          expect(viewport.neverDrawn).to.deep.eq(new Set([elementId]));
        });

        it("applies same change to all child elements", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const childElements = ["0x4", "0x5", "0x6"];
          const elementIdsCache = createFakeElementIdsCache({
            getAssemblyElementIds: sinon.fake.returns(from(childElements)),
          });
          const viewport = createFakeSinonViewport();
          const { handler } = createVisibilityHandlerWrapper({
            elementIdsCache,
            viewport,
          });

          await handler.changeVisibility(createElementNode(modelId, categoryId, undefined, elementId), false);
          expect(elementIdsCache.getAssemblyElementIds).to.be.called;
          expect(viewport.neverDrawn).to.deep.eq(new Set([elementId, ...childElements]));
        });
      });
    });
  });

  describe("#integration", () => {
    let iModel: IModelConnection;
    let firstModelId: Id64String;
    let otherModelId: Id64String;
    const models = new Map<Id64String, Set<Id64String>>();
    const categories = new Map<Id64String, Set<Id64String>>();

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

      // eslint-disable-next-line deprecation/deprecation
      iModel = await buildTestIModel("CategoriesTree3d", async (builder) => {
        const partitions = [
          addPartition(builder, "BisCore:PhysicalPartition", "TestPhysicalModel 1"),
          addPartition(builder, "BisCore:PhysicalPartition", "TestPhysicalModel 2"),
        ];
        for (let modelIdx = 0; modelIdx < 2; ++modelIdx) {
          const partitionId = partitions[modelIdx];
          const modelId = addModel(builder, "BisCore:PhysicalModel", partitionId);
          const modelCategories = new Set<string>();

          for (let categoryIdx = 0; categoryIdx < 2; ++categoryIdx) {
            const categoryId = addSpatialCategory(builder, IModel.dictionaryId, `Test SpatialCategory ${modelIdx}_${categoryIdx}`);
            modelCategories.add(categoryId);

            const elements = new Set<string>();
            for (let elementIdx = 0; elementIdx < 10; ++elementIdx) {
              const code = new Code({ scope: partitionId, spec: "", value: `${categoryIdx}_${elementIdx}` });
              const element = addPhysicalObject(builder, modelId, categoryId, code);
              elements.add(element);
            }

            categories.set(categoryId, elements);
          }

          models.set(modelId, modelCategories);
        }

        [firstModelId, otherModelId] = [...models.keys()];
      });
    });

    after(async () => {
      await iModel?.close();
      await terminatePresentationTesting();
    });

    let viewport: Viewport;
    let handler: IVisibilityHandler;
    let queryProvider: IQueryHandler;

    beforeEach(() => {
      queryProvider = createQueryHandler(iModel);
      viewport = OffScreenViewport.create({
        view: createBlankViewState(iModel),
        viewRect: new ViewRect(),
      });
      handler = createHierarchyBasedVisibilityHandler({
        elementIdsCache: createElementIdsCache(iModel, createRuleset({}).id),
        queryHandler: queryProvider,
        viewport,
      });
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
          expect(viewport.view.viewsModel(id)).to.eq(props.viewportVisibility, "Model has unexpected viewport visibility");
          const status = await handler.getVisibilityStatus(createModelNode(id));
          expect(status.state).to.eq(props.handlerVisibility, "Model has unexpected visibility in the handler");
        }),
      );
    }

    async function assertCategoryVisibility(props: {
      viewportVisibility: boolean;
      perModelVisibilityOverride?: boolean;
      handlerVisibility: Visibility;
      modelIdFilter?: string | ((id: string) => boolean);
      categoryIdFilter?: string | ((id: string) => boolean);
    }) {
      const expectedOverride =
        props.perModelVisibilityOverride === undefined
          ? PerModelCategoryVisibility.Override.None
          : props.perModelVisibilityOverride
            ? PerModelCategoryVisibility.Override.Show
            : PerModelCategoryVisibility.Override.Hide;
      const overrideToString = (ovr: PerModelCategoryVisibility.Override) => {
        switch (ovr) {
          case PerModelCategoryVisibility.Override.None:
            return "None";
          case PerModelCategoryVisibility.Override.Show:
            return "Show";
          case PerModelCategoryVisibility.Override.Hide:
            return "Hide";
        }
      };

      const obs = from(models).pipe(
        filter(([id]) => filterMatches(id, props.modelIdFilter)),
        mergeMap(([modelId, categoryIds]) => {
          return from(categoryIds).pipe(
            filter((id) => filterMatches(id, props.categoryIdFilter)),
            mergeMap(async (categoryId) => {
              expect(viewport.view.viewsCategory(categoryId)).to.eq(props.viewportVisibility, `Category has unexpected viewport visibility`);
              const actualOverride = viewport.perModelCategoryVisibility.getOverride(firstModelId, categoryId);
              expect(actualOverride).to.eq(
                expectedOverride,
                `
                Category has unexpected per model visibility override.
                Expected ${overrideToString(expectedOverride)}, actual: ${overrideToString(actualOverride)}
              `,
              );

              const status = await handler.getVisibilityStatus(createCategoryNode({ id: modelId, className: "BisCore.PhysicalModel" }, categoryId));
              expect(status.state).to.eq(props.handlerVisibility, `Category has unexpected visibility in the handler`);
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
              return from(categories.get(categoryId)!).pipe(
                filter((id) => filterMatches(id, props.elementIdFilter)),
                mergeMap(async (elementId) => handler.getVisibilityStatus(createElementNode(modelId, categoryId, undefined, elementId))),
                map((x) => expect(x.state).to.eq(props.visibility, "Element has unexpected visibility")),
              );
            }),
          );
        }),
      );
      return toVoidPromise(obs);
    }

    describe("subject", () => {
      let node: PresentationTreeNodeItem;

      before(() => (node = createSubjectNode(iModel.elements.rootSubjectId)));

      it("showing it makes it, all its models, categories and elements visible", async () => {
        await handler.changeVisibility(node, true);
        await Promise.all([
          expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "visible" }),
          assertModelVisibility({ viewportVisibility: true, handlerVisibility: "visible" }),
          assertCategoryVisibility({ viewportVisibility: true, handlerVisibility: "visible" }),
          assertElementsVisibility({ visibility: "visible" }),
        ]);
      });

      it("hiding it makes it, all its models, categories and elements hidden", async () => {
        await handler.changeVisibility(node, false);
        await Promise.all([
          expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "hidden" }),
          assertModelVisibility({ viewportVisibility: false, handlerVisibility: "hidden" }),
          assertCategoryVisibility({ viewportVisibility: false, handlerVisibility: "hidden" }),
          assertElementsVisibility({ visibility: "hidden" }),
        ]);
      });
    });

    describe("model", () => {
      it("showing it makes it, all its categories and elements visible", async () => {
        await handler.changeVisibility(createModelNode(firstModelId), true);
        const modelIdFilter = (id: string) => id === firstModelId;
        await Promise.all([
          assertModelVisibility({ viewportVisibility: true, handlerVisibility: "visible", modelId: firstModelId }),
          assertCategoryVisibility({ viewportVisibility: true, handlerVisibility: "visible", modelIdFilter }),
          assertElementsVisibility({ visibility: "visible", modelIdFilter }),
        ]);
      });

      it("hiding it makes it, all its categories and elements hidden", async () => {
        await handler.changeVisibility(createModelNode(firstModelId), false);
        const modelIdFilter = (id: string) => id === firstModelId;
        await Promise.all([
          assertModelVisibility({ viewportVisibility: false, handlerVisibility: "hidden" }),
          assertCategoryVisibility({ viewportVisibility: false, handlerVisibility: "hidden", modelIdFilter }),
          assertElementsVisibility({ visibility: "hidden", modelIdFilter }),
        ]);
      });

      it("gets hidden when elements from other model are added to the exclusive always drawn list", async () => {
        await handler.changeVisibility(createModelNode(firstModelId), true);
        await handler.changeVisibility(createModelNode(otherModelId), true);

        const categoryId = getFirstValue(models.get(otherModelId)!.values());
        const element = getFirstValue(categories.get(categoryId)!.values());
        viewport.setAlwaysDrawn(new Set([element]), true);

        await Promise.all([
          assertModelVisibility({ modelId: firstModelId, viewportVisibility: true, handlerVisibility: "hidden" }),
          assertModelVisibility({ modelId: otherModelId, viewportVisibility: true, handlerVisibility: "partial" }),
          assertCategoryVisibility({ categoryIdFilter: (id) => id === categoryId, viewportVisibility: true, handlerVisibility: "partial" }),
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

      it("if model is hidden, showing category makes its model visible in the viewport and only that category visible", async () => {
        await handler.changeVisibility(createModelNode(modelId), false);
        await handler.changeVisibility(createCategoryNode(modelId, categoryId), true);
        const categoryIdFilter = (id: string) => id === categoryId;
        await Promise.all([
          assertModelVisibility({
            modelId,
            viewportVisibility: true,
            handlerVisibility: "partial",
          }),
          assertCategoryVisibility({
            categoryIdFilter,
            viewportVisibility: true,
            handlerVisibility: "visible",
          }),
          assertCategoryVisibility({
            modelIdFilter: (id) => id === modelId,
            categoryIdFilter: (id) => id !== categoryId,
            viewportVisibility: false,
            handlerVisibility: "hidden",
          }),
          assertElementsVisibility({ visibility: "visible", categoryIdFilter }),
        ]);
      });

      it("if model is visible, hiding category makes only that category hidden and model partially visible", async () => {
        await handler.changeVisibility(createModelNode(modelId), true);
        await handler.changeVisibility(createCategoryNode(modelId, categoryId), false);
        await Promise.all([
          assertModelVisibility({
            modelId,
            viewportVisibility: true,
            handlerVisibility: "partial",
          }),
          assertCategoryVisibility({
            categoryIdFilter: categoryId,
            viewportVisibility: true,
            perModelVisibilityOverride: false,
            handlerVisibility: "hidden",
          }),
          assertCategoryVisibility({
            modelIdFilter: modelId,
            categoryIdFilter: (id) => id !== categoryId,
            viewportVisibility: true,
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
    });

    describe("element", () => {
      let modelId: string;
      let categoryId: string;
      let elementId: string;

      before(() => {
        modelId = firstModelId;
        categoryId = getFirstValue(models.get(modelId)!.values());
        elementId = getFirstValue(categories.get(categoryId)!.values());
      });

      it("if model is hidden, showing element makes model and category visible in the viewport", async () => {
        await handler.changeVisibility(createModelNode(firstModelId), false);
        const elementNode = createElementNode(firstModelId, categoryId, false, elementId);
        await handler.changeVisibility(elementNode, true);
        await Promise.all([
          expect(handler.getVisibilityStatus(elementNode)).to.eventually.include({ state: "visible" }),
          assertModelVisibility({
            modelId,
            viewportVisibility: true,
            handlerVisibility: "partial",
          }),
          assertCategoryVisibility({
            categoryIdFilter: categoryId,
            viewportVisibility: false,
            handlerVisibility: "partial",
          }),
          assertCategoryVisibility({
            modelIdFilter: modelId,
            categoryIdFilter: (id) => id !== categoryId,
            viewportVisibility: false,
            handlerVisibility: "hidden",
          }),
          assertElementsVisibility({
            modelIdFilter: modelId,
            categoryIdFilter: categoryId,
            visibility: "hidden",
          }),
        ]);
      });

      it("if model is visible, hiding element makes model and category partially visible", async () => {
        await handler.changeVisibility(createModelNode(firstModelId), true);
        await handler.changeVisibility(createElementNode(firstModelId, categoryId, false, elementId), false);
        await Promise.all([
          assertModelVisibility({ modelId, viewportVisibility: true, handlerVisibility: "partial" }),
          assertCategoryVisibility({
            categoryIdFilter: categoryId,
            viewportVisibility: true,
            handlerVisibility: "partial",
          }),
        ]);
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

function getFirstValue<T>(iterator: Iterator<T>): T {
  const iterResult = iterator.next();
  if (iterResult.done) {
    throw new Error("Iterator is empty");
  }
  return iterResult.value;
}

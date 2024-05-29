/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import fs from "fs";
import path from "path";
import { filter, from, mergeMap } from "rxjs";
import sinon from "sinon";
import { assert, BeEvent } from "@itwin/core-bentley";
import { Code, ColorDef, IModel, RenderMode } from "@itwin/core-common";
import {
  IModelApp, NoRenderApp, OffScreenViewport, PerModelCategoryVisibility, SnapshotConnection, SpatialViewState, ViewRect,
} from "@itwin/core-frontend";
import { SchemaContext, SchemaJsonLocater } from "@itwin/ecschema-metadata";
import { createECSchemaProvider, createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { Presentation } from "@itwin/presentation-frontend";
import {
  createHierarchyProvider, createLimitingECSqlQueryExecutor, createNodesQueryClauseFactory, HierarchyNode,
} from "@itwin/presentation-hierarchies";
import { createCachingECClassHierarchyInspector } from "@itwin/presentation-shared";
import {
  HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { toVoidPromise } from "../../../components/trees/common/Rxjs";
import { createHierarchyVisibilityHandler } from "../../../components/trees/stateless/models-tree/HierarchyVisibilityHandler";
import { createVisibilityStatus } from "../../../components/trees/stateless/models-tree/internal/Tooltip";
import { addModel, addPartition, addSpatialCategory, createLocalIModel } from "../../IModelUtils";
import { TestUtils } from "../../TestUtils";
import {
  createCategoryHierarchyNode, createClassGroupingHierarchyNode, createElementHierarchyNode, createFakeModelsTreeQueryHandler,
  createFakeSinonViewport, createModelHierarchyNode, createSubjectHierarchyNode, stubFactoryFunction,
} from "../Common";

import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { ModelsTreeQueryHandler } from "../../../components/trees/stateless/models-tree/internal/ModelsTreeQueryHandler";
import type { PresentationManager } from "@itwin/presentation-frontend";
import type { Id64String } from "@itwin/core-bentley";
import type { GeometricElement3dProps } from "@itwin/core-common";
import type { StubbedFactoryFunction } from "../Common";
import type { HierarchyVisibilityHandler, HierarchyVisibilityHandlerProps } from "../../../components/trees/stateless/models-tree/HierarchyVisibilityHandler";
import type { Visibility } from "../../../components/trees/stateless/models-tree/internal/Tooltip";
import type { ClassGroupingNodeKey } from "@itwin/presentation-hierarchies/lib/cjs/hierarchies/HierarchyNodeKey";
import type { IModelDb } from "@itwin/core-backend";
interface VisibilityOverrides {
  models?: Map<Id64String, Visibility>;
  categories?: Map<Id64String, Visibility>;
  elements?: Map<Id64String, Visibility>;
}

describe("HierarchyBasedVisibilityHandler", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  after(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  describe("#unit", () => {
    before(() => {
      const mockPresentationManager = {
        onIModelHierarchyChanged: new BeEvent<() => void>(),
      } as unknown as PresentationManager;
      sinon.stub(Presentation, "presentation").get(() => mockPresentationManager);
    });

    after(() => {
      sinon.restore();
    });

    let queryHandlerStub: StubbedFactoryFunction<ModelsTreeQueryHandler>;
    let createdHandlers = new Array<HierarchyVisibilityHandler>();

    afterEach(() => {
      createdHandlers.forEach((x) => x.dispose());
      createdHandlers = [];
    });

    function createVisibilityHandlerWrapper(props?: { overrides?: VisibilityOverrides; queryHandler?: ModelsTreeQueryHandler; viewport?: Viewport }) {
      const queryHandler = props?.queryHandler ?? createFakeModelsTreeQueryHandler();
      const overrides: HierarchyVisibilityHandlerProps["overrides"] = {
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

      props?.queryHandler && queryHandlerStub.stub(() => queryHandler);
      const handler = createHierarchyVisibilityHandler({
        viewport: props?.viewport ?? createFakeSinonViewport(),
        overrides,
      });
      return {
        handler,
        overrides,
      };
    }

    before(async () => {
      queryHandlerStub = stubFactoryFunction(
        `${__dirname}/../../../components/trees/stateless/models-tree/internal/ModelsTreeQueryHandler`,
        "createModelsTreeQueryHandler",
        () => createFakeModelsTreeQueryHandler(),
      );
    });

    beforeEach(() => queryHandlerStub.stub());
    afterEach(() => queryHandlerStub.reset());

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

        const { handler } = createVisibilityHandlerWrapper();
        const result = await handler.getVisibilityStatus(node);
        expect(result).to.include({ state: "hidden", isDisabled: true });
      });

      describe("subject", () => {
        it("can be overridden", async () => {
          const overrides = {
            getSubjectNodeVisibility: sinon.fake.resolves(createVisibilityStatus("visible")),
          };
          const handler = createHierarchyVisibilityHandler({
            viewport: createFakeSinonViewport(),
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
          const { handler } = createVisibilityHandlerWrapper({ viewport });
          const result = await handler.getVisibilityStatus(node);
          expect(viewport.view.isSpatialView).to.be.called;
          expect(result).to.include({ state: "hidden", isDisabled: true });
        });

        it("is visible when subject contains no models", async () => {
          const subjectIds = ["0x1", "0x2"];
          const node = createSubjectHierarchyNode(...subjectIds);
          const queryHandler = createFakeModelsTreeQueryHandler({
            subjectsHierarchy: new Map([["0x0", subjectIds]]),
          });
          const { handler } = createVisibilityHandlerWrapper({ queryHandler });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible when all models are displayed", async () => {
          const subjectIds = ["0x1", "0x2"];
          const node = createSubjectHierarchyNode(...subjectIds);
          const queryHandler = createFakeModelsTreeQueryHandler({
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
          const node = createSubjectHierarchyNode(...subjectIds);
          const queryHandler = createFakeModelsTreeQueryHandler({
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
          const node = createSubjectHierarchyNode(...subjectIds);
          const queryHandler = createFakeModelsTreeQueryHandler({
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

        // describe("filtered", () => {
        //   it("uses filtered data provider", async () => {
        //     const { handler } = createVisibilityHandlerWrapper({
        //       overrides: {
        //         models: new Map([
        //           ["0x10", "visible"],
        //           ["0x20", "visible"],
        //         ]),
        //       },
        //     });
        //     const filteredDataProvider = {
        //       nodeMatchesFilter: sinon.fake.returns(false),
        //       getNodes: sinon.fake.resolves([createModelHierarchyNode("0x10"), createModelHierarchyNode("0x20")]),
        //     } as unknown as IFilteredPresentationTreeDataProvider;
        //     handler.filteredDataProvider = filteredDataProvider;

        //     const node = createSubjectHierarchyNode(["0x1", "0x2"]);
        //     const visibility = await handler.getVisibilityStatus(node);
        //     expect(filteredDataProvider.nodeMatchesFilter).to.be.calledWith(node);
        //     expect(filteredDataProvider.getNodes).to.be.calledWith(node);
        //     expect(visibility.state).to.eq("visible");
        //   });
        // });
      });

      describe("model", () => {
        it("is disabled when active view is not spatial", async () => {
          const node = createModelHierarchyNode();
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

        it("doesn't query model element count if always/never drawn sets are empty and exclusive mode is off", async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelHierarchyNode(modelId);
          const queryHandler = createFakeModelsTreeQueryHandler({
            modelCategories: new Map([[modelId, categories]]),
            categoryElements: new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
          });

          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
          expect(queryHandler.queryElementsCount).not.to.be.called;
        });

        describe("visible", () => {
          it("when all categories are displayed", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const queryHandler = createFakeModelsTreeQueryHandler({
              modelCategories: new Map([[modelId, categories]]),
            });
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
            });
            const result = await handler.getVisibilityStatus(node);
            expect(result).to.include({ state: "visible" });
          });

          it("when all elements are in the exclusive always drawn list", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const queryHandler = createFakeModelsTreeQueryHandler({
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

          it("when always drawn list is empty", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const queryHandler = createFakeModelsTreeQueryHandler({
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

          it("when all categories are displayed and always/never drawn lists contain no children", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const queryHandler = createFakeModelsTreeQueryHandler({
              modelCategories: new Map([[modelId, categories]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
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
            const { handler } = createVisibilityHandlerWrapper({
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
            const queryHandler = createFakeModelsTreeQueryHandler({
              modelCategories: new Map([[modelId, categories]]),
            });
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
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
            const queryHandler = createFakeModelsTreeQueryHandler({
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

          it("when none of the elements are in exclusive always drawn list", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const modelCategories = new Map([[modelId, ["0x10", "0x20"]]]);
            const categoryElements = new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]);
            const queryHandler = createFakeModelsTreeQueryHandler({
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

          it("when in exclusive always drawn list is empty", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const modelCategories = new Map([[modelId, ["0x10", "0x20"]]]);
            const categoryElements = new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]);
            const queryHandler = createFakeModelsTreeQueryHandler({
              modelCategories,
              categoryElements,
            });
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
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
            const queryHandler = createFakeModelsTreeQueryHandler({
              modelCategories: new Map([[modelId, categories]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
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
            const queryHandler = createFakeModelsTreeQueryHandler({
              modelCategories: new Map([[modelId, categories]]),
            });
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
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
            const queryHandler = createFakeModelsTreeQueryHandler({
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

          it("when some of the elements are not in the exclusive always drawn list", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const queryHandler = createFakeModelsTreeQueryHandler({
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

          it("when some categories are visible, some hidden and always/never drawn lists contain no children", async () => {
            const modelId = "0x1";
            const categories = ["0x10", "0x20"];
            const node = createModelHierarchyNode(modelId);
            const queryHandler = createFakeModelsTreeQueryHandler({
              modelCategories: new Map([[modelId, categories]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            });
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
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
          const overrides: HierarchyVisibilityHandlerProps["overrides"] = {
            getCategoryDisplayStatus: sinon.fake.resolves(createVisibilityStatus("visible")),
          };
          const handler = createHierarchyVisibilityHandler({
            viewport: createFakeSinonViewport(),
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
          const queryHandler = createFakeModelsTreeQueryHandler({
            modelCategories: new Map([[modelId, [categoryId]]]),
            categoryElements: new Map([[categoryId, ["0x100", "0x200"]]]),
          });
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler,
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x400"]),
              view: {
                viewsModel: sinon.fake.returns(false),
              },
            }),
          });

          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
          expect(queryHandler.queryElementsCount).not.to.be.called;
        });

        describe("is visible", () => {
          it("when `viewport.view.viewsCategory` returns TRUE and there are NO CHILD elements in the NEVER drawn list", async () => {
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode("0x1", categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
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
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
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
          it("when model is hidden", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
                categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
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

          it("`viewport.view.viewsCategory` returns FALSE and there ARE NO CHILD elements in the ALWAYS drawn list", async () => {
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode("0x1", categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
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
            const node = createCategoryHierarchyNode("0x1", categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
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
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
                modelCategories: new Map([[modelId, [categoryId]]]),
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
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
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
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
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
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
                modelCategories: new Map([[modelId, [categoryId]]]),
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
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
                modelCategories: new Map([[modelId, [categoryId]]]),
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
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
                modelCategories: new Map([[modelId, [categoryId]]]),
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
            const node = createCategoryHierarchyNode(modelId, categoryId);
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
                modelCategories: new Map([[modelId, [categoryId]]]),
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
        const modelId = "0x1";
        const categoryId = "0x2";
        const elementId = "0x3";

        it("is disabled when has no category or model", async () => {
          const { handler } = createVisibilityHandlerWrapper();
          let result = await handler.getVisibilityStatus(createElementHierarchyNode({ modelId: undefined, categoryId: undefined }));
          expect(result.isDisabled).to.be.true;
          result = await handler.getVisibilityStatus(createElementHierarchyNode({ modelId: "0x1", categoryId: undefined }));
          expect(result.isDisabled).to.be.true;
        });

        describe("is hidden when model is hidden", async () => {
          const node = createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId });
          const viewport = createFakeSinonViewport({
            view: {
              viewsModel: sinon.fake.returns(false),
            },
          });
          const { handler } = createVisibilityHandlerWrapper({ viewport });
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
          const { handler } = createVisibilityHandlerWrapper({
            viewport,
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is visible if present in the always drawn list", async () => {
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const { handler } = createVisibilityHandlerWrapper({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set([elementId]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden if present in the never drawn list", async () => {
          const { handler } = createVisibilityHandlerWrapper({
            viewport: createFakeSinonViewport({
              neverDrawn: new Set([elementId]),
            }),
          });
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "hidden" });
        });

        it("is hidden if other elements are present in the always drawn list and exclusive mode is enabled", async () => {
          const { handler } = createVisibilityHandlerWrapper({
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
          const { handler } = createVisibilityHandlerWrapper({
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
          const { handler } = createVisibilityHandlerWrapper();
          const node = createElementHierarchyNode({ modelId, categoryId, elementId });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden if category has per model override to hide", async () => {
          const { handler } = createVisibilityHandlerWrapper({
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
          const overrides: HierarchyVisibilityHandlerProps["overrides"] = {
            getElementGroupingNodeDisplayStatus: sinon.fake.resolves(createVisibilityStatus("visible")),
          };
          const handler = createHierarchyVisibilityHandler({
            viewport: createFakeSinonViewport(),
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
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeModelsTreeQueryHandler({
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
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeModelsTreeQueryHandler({
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
          const { handler } = createVisibilityHandlerWrapper({
            queryHandler: createFakeModelsTreeQueryHandler({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elementIds]]),
            }),
            viewport: createFakeSinonViewport({
              neverDrawn: new Set([elementIds[0]]),
            }),
          });
          const result = await handler.getVisibilityStatus(node);
          expect(result).to.include({ state: "partial" });
        });

        it("uses category visibility when always/never drawn lists are empty", async () => {
          const elementIds = ["0x10", "0x20"];
          const node = createClassGroupingHierarchyNode({
            modelId,
            categoryId,
            elements: elementIds,
          });

          for (const categoryOn of [true, false]) {
            const { handler } = createVisibilityHandlerWrapper({
              viewport: createFakeSinonViewport({
                view: { viewsCategory: sinon.fake.returns(categoryOn) },
              }),
              queryHandler: createFakeModelsTreeQueryHandler({
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
          const overrides: HierarchyVisibilityHandlerProps["overrides"] = {
            changeSubjectNodeState: sinon.fake.resolves(undefined),
          };
          const handler = createHierarchyVisibilityHandler({
            viewport: createFakeSinonViewport(),
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
            const { handler, overrides } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
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
            const node = createSubjectHierarchyNode(...subjectIds);
            const { handler, overrides } = createVisibilityHandlerWrapper({
              queryHandler: createFakeModelsTreeQueryHandler({
                subjectModels: new Map(subjectIds.map((id, idx) => [id, modelIds[idx]])),
              }),
            });

            await handler.changeVisibility(node, false);
            expect(overrides.changeModelState).to.be.calledOnceWith(sinon.match({ ids: sinon.match.set.deepEquals(new Set(modelIds.flat())), on: false }));
          });
        });

        // describe("filtered", () => {
        //   it("uses filtered data provider", async () => {
        //     const { handler } = createVisibilityHandlerWrapper();
        //     const filteredDataProvider = {
        //       nodeMatchesFilter: sinon.fake.returns(false),
        //       getNodes: sinon.fake.resolves([createElementHierarchyNode(undefined, undefined, false, "0x10"), createElementHierarchyNode(undefined, undefined, false, "0x20")]),
        //     } as unknown as IFilteredPresentationTreeDataProvider;
        //     handler.filteredDataProvider = filteredDataProvider;

        //     const node = createSubjectHierarchyNode(["0x1", "0x2"]);
        //     await handler.changeVisibility(node, false);

        //     expect(filteredDataProvider.nodeMatchesFilter).to.be.called;
        //     expect(filteredDataProvider.getNodes).to.be.called;
        //   });
        // });
      });

      describe("model", () => {
        function testAlwaysAndNeverDrawnChildrenAccess(visibility: boolean) {
          it("doesn't change always/never drawn sets if they don't have any of the model's children", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const viewport = createFakeSinonViewport({
              alwaysDrawn: new Set(["abcd", "efgh"]),
              neverDrawn: new Set(["1234", "3456"]),
            });
            const { handler } = createVisibilityHandlerWrapper({
              viewport,
              queryHandler: createFakeModelsTreeQueryHandler({
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
            const node = createModelHierarchyNode(modelId);
            const viewport = createFakeSinonViewport({
              alwaysDrawn: new Set(["0x100", "0x200", "abcd"]),
              neverDrawn: new Set(["0x300", "0x400", "1234"]),
            });
            const { handler } = createVisibilityHandlerWrapper({
              viewport,
              queryHandler: createFakeModelsTreeQueryHandler({
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
            const node = createModelHierarchyNode(modelId);
            const viewport = createFakeSinonViewport();
            const { handler } = createVisibilityHandlerWrapper({ viewport });
            await handler.changeVisibility(node, true);
            expect(viewport.addViewedModels).to.be.calledOnceWith(modelId);
          });

          testAlwaysAndNeverDrawnChildrenAccess(true);

          it(`removes per model category overrides`, async () => {
            const modelId = "0x1";
            const categoryIds = ["0x2", "0x3", "0x4"];
            const node = createModelHierarchyNode(modelId);
            const viewport = createFakeSinonViewport();
            const { handler } = createVisibilityHandlerWrapper({
              viewport,
              queryHandler: createFakeModelsTreeQueryHandler({
                modelCategories: new Map([[modelId, categoryIds]]),
              }),
            });
            await handler.changeVisibility(node, true);

            expect(viewport.perModelCategoryVisibility.clearOverrides).to.be.calledWith(modelId);
          });
        });

        describe("off", () => {
          it("marks itself hidden", async () => {
            const modelId = "0x1";
            const node = createModelHierarchyNode(modelId);
            const viewport = createFakeSinonViewport();
            const { handler } = createVisibilityHandlerWrapper({ viewport });
            await handler.changeVisibility(node, false);
            expect(viewport.changeModelDisplay).to.be.calledOnceWith(modelId, false);
          });

          testAlwaysAndNeverDrawnChildrenAccess(false);

          it(`removes per model category overrides`, async () => {
            const modelId = "0x1";
            const categoryIds = ["0x2", "0x3", "0x4"];
            const node = createModelHierarchyNode(modelId);
            const viewport = createFakeSinonViewport();
            const { handler } = createVisibilityHandlerWrapper({
              viewport,
              queryHandler: createFakeModelsTreeQueryHandler({
                modelCategories: new Map([[modelId, categoryIds]]),
              }),
            });
            await handler.changeVisibility(node, false);

            expect(viewport.perModelCategoryVisibility.clearOverrides).to.be.calledWith(modelId);
          });
        });
      });

      describe("category", () => {
        it("can be overridden", async () => {
          const overrides: HierarchyVisibilityHandlerProps["overrides"] = {
            changeCategoryState: sinon.fake.resolves(undefined),
          };
          const handler = createHierarchyVisibilityHandler({
            viewport: createFakeSinonViewport(),
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
          it("sets HIDE override if model is visible", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const node = createCategoryHierarchyNode(modelId, categoryId);
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
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x10";
          const overrides: HierarchyVisibilityHandlerProps["overrides"] = {
            changeElementState: sinon.fake.resolves(undefined),
          };
          const handler = createHierarchyVisibilityHandler({
            viewport: createFakeSinonViewport(),
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
            const { handler } = createVisibilityHandlerWrapper({ viewport });
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
            const { handler } = createVisibilityHandlerWrapper({ viewport });
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
            const { handler } = createVisibilityHandlerWrapper({ viewport });
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
            const { handler } = createVisibilityHandlerWrapper({
              viewport,
              overrides: {
                models: new Map([[modelId, "hidden"]]),
              },
            });
            await handler.changeVisibility(node, true);
            expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId]));
          });

          it("removes all children from never drawn list", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const childElements = ["0x4", "0x5", "0x6"];
            const queryHandler = createFakeModelsTreeQueryHandler({
              elementChildren: new Map([[elementId, childElements]]),
            });
            const viewport = createFakeSinonViewport({
              neverDrawn: new Set(childElements),
            });
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
              viewport,
            });

            await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId }), true);
            expect(viewport.neverDrawn?.size ?? 0).to.eq(0);
          });

          it("adds all children to always drawn if category is hidden", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const childElements = ["0x4", "0x5", "0x6"];
            const queryHandler = createFakeModelsTreeQueryHandler({
              elementChildren: new Map([[elementId, childElements]]),
            });
            const viewport = createFakeSinonViewport({
              view: {
                viewsCategory: sinon.fake.returns(false),
              },
            });
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
              viewport,
            });

            await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId }), true);
            expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId, ...childElements]));
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
            const { handler } = createVisibilityHandlerWrapper({ viewport });
            await handler.changeVisibility(node, false);
            expect(viewport.alwaysDrawn?.size ?? 0).to.eq(0);
          });

          it("adds element to the never drawn list if model is visible", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const node = createElementHierarchyNode({ modelId, categoryId, elementId });
            const viewport = createFakeSinonViewport();
            const { handler } = createVisibilityHandlerWrapper({ viewport });
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
            const { handler } = createVisibilityHandlerWrapper({ viewport });
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
            const { handler } = createVisibilityHandlerWrapper({ viewport });
            await handler.changeVisibility(node, false);
            expect(viewport.neverDrawn).to.deep.eq(new Set([elementId]));
          });

          it("removes all children from always drawn drawn", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const childElements = ["0x4", "0x5", "0x6"];
            const queryHandler = createFakeModelsTreeQueryHandler({
              elementChildren: new Map([[elementId, childElements]]),
            });
            const viewport = createFakeSinonViewport({
              alwaysDrawn: new Set([elementId, ...childElements]),
            });
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
              viewport,
            });

            await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId }), false);
            expect(queryHandler.queryElements).to.be.called;
            expect(viewport.alwaysDrawn?.size ?? 0).to.eq(0);
          });

          it("adds all children to never drawn list if category is visible", async () => {
            const modelId = "0x1";
            const categoryId = "0x2";
            const elementId = "0x3";
            const childElements = ["0x4", "0x5", "0x6"];
            const queryHandler = createFakeModelsTreeQueryHandler({
              elementChildren: new Map([[elementId, childElements]]),
            });
            const viewport = createFakeSinonViewport();
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
              viewport,
            });

            await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId }), false);
            expect(queryHandler.queryElements).to.be.called;
            expect(viewport.neverDrawn).to.deep.eq(new Set([elementId, ...childElements]));
          });
        });
      });

      describe("grouping node", () => {
        it("can be overridden", async () => {
          const overrides: HierarchyVisibilityHandlerProps["overrides"] = {
            changeElementGroupingNodeState: sinon.fake.resolves(undefined),
          };
          const handler = createHierarchyVisibilityHandler({
            viewport: createFakeSinonViewport(),
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
            const queryHandler = createFakeModelsTreeQueryHandler({
              modelCategories: new Map([[modelId, [categoryId]]]),
              categoryElements: new Map([[categoryId, elements]]),
            });
            const viewport = createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(true),
                viewsCategory: sinon.fake.returns(!on),
              },
            });
            const { handler } = createVisibilityHandlerWrapper({
              queryHandler,
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
    const models = new Map<Id64String, Id64String[]>();
    const categoryParentElements = new Map<Id64String, Id64String[]>();
    const elementHierarchy = new Map<Id64String, Set<Id64String>>();

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

      if (!fs.existsSync("temp")) {
        fs.mkdirSync("temp");
      }
      iModelPath = `temp/${new Date().toISOString()}.bim`;

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
          addPartition(builder, "BisCore:PhysicalPartition", "TestPhysicalModel 1"),
          addPartition(builder, "BisCore:PhysicalPartition", "TestPhysicalModel 2"),
        ];
        for (let modelIdx = 0; modelIdx < 2; ++modelIdx) {
          const partitionId = partitions[modelIdx];
          const modelId = addModel(builder, "BisCore:PhysicalModel", partitionId);
          const modelCategories = new Array<string>();

          for (let categoryIdx = 0; categoryIdx < 2; ++categoryIdx) {
            const categoryId = addSpatialCategory(builder, IModel.dictionaryId, `Test SpatialCategory ${modelIdx}_${categoryIdx}`);
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

        [firstModelId, otherModelId] = [...models.keys()];
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
    let handler: HierarchyVisibilityHandler;

    beforeEach(async () => {
      viewport = OffScreenViewport.create({
        view: createBlankViewState(iModelConnection),
        viewRect: new ViewRect(),
      });
      handler = createHierarchyVisibilityHandler({
        viewport,
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
              expect(viewport.view.viewsCategory(categoryId)).to.eq(!!props.viewportVisibility, `Category has unexpected viewport visibility`);
              const actualOverride = viewport.perModelCategoryVisibility.getOverride(modelId, categoryId);
              expect(actualOverride).to.eq(
                expectedOverride,
                `
                Category ${categoryId} has unexpected per model visibility override.
                Expected ${overrideToString(expectedOverride)}, actual: ${overrideToString(actualOverride)}
                `,
              );

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
                filter(([id]) => filterMatches(id, props.elementIdFilter)),
                mergeMap(([_, elementIds]) => elementIds),
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

    describe("subject", () => {
      let node: HierarchyNode;

      before(() => (node = createSubjectHierarchyNode(iModelConnection.elements.rootSubjectId)));

      it("by default all subject models, categories and elements are hidden", async () => {
        await Promise.all([
          expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "hidden" }),
          assertModelVisibility({ viewportVisibility: false, handlerVisibility: "hidden" }),
          assertCategoryVisibility({ handlerVisibility: "hidden" }),
          assertElementsVisibility({ visibility: "hidden" }),
        ]);
      });

      it("showing it makes it, all its models, categories and elements visible", async () => {
        await handler.changeVisibility(node, true);
        await Promise.all([
          expect(handler.getVisibilityStatus(node)).to.eventually.include({ state: "visible" }),
          assertModelVisibility({ viewportVisibility: true, handlerVisibility: "visible" }),
          assertCategoryVisibility({ perModelVisibilityOverride: true, handlerVisibility: "visible" }),
          assertElementsVisibility({ visibility: "visible" }),
        ]);
      });
    });

    describe("model", () => {
      it("by default it, all its categories and elements are hidden", async () => {
        await Promise.all([
          assertModelVisibility({ viewportVisibility: false, handlerVisibility: "hidden", modelId: firstModelId }),
          assertCategoryVisibility({ handlerVisibility: "hidden", modelIdFilter: firstModelId }),
          assertElementsVisibility({ visibility: "hidden", modelIdFilter: firstModelId }),
        ]);
      });

      it("showing it makes it, all its categories and elements visible", async () => {
        await handler.changeVisibility(createModelHierarchyNode(firstModelId), true);
        await Promise.all([
          assertModelVisibility({ viewportVisibility: true, handlerVisibility: "visible", modelId: firstModelId }),
          assertCategoryVisibility({ perModelVisibilityOverride: true, handlerVisibility: "visible", modelIdFilter: firstModelId }),
          assertElementsVisibility({ visibility: "visible", modelIdFilter: firstModelId }),
        ]);
      });

      it("gets partial when it's visible and elements are added to never drawn list", async () => {
        await handler.changeVisibility(createModelHierarchyNode(firstModelId), true);

        const categoryId = getFirstValue(models.get(firstModelId)!);
        const element = getFirstValue(categoryParentElements.get(categoryId)!);
        viewport.setNeverDrawn(new Set([element]));
        viewport.renderFrame();
        await new Promise((r) => setTimeout(r, 30));
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

      it("showing category makes its model visible in the viewport and per model override for that category hast to be set", async () => {
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
            perModelVisibilityOverride: true,
            handlerVisibility: "visible",
          }),
          assertCategoryVisibility({
            modelIdFilter: modelId,
            categoryIdFilter: (id) => id !== categoryId,
            handlerVisibility: "hidden",
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
            perModelVisibilityOverride: false,
            handlerVisibility: "hidden",
          }),
          assertCategoryVisibility({
            modelIdFilter: modelId,
            categoryIdFilter: (id) => id !== categoryId,
            perModelVisibilityOverride: true,
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
        await assertCategoryVisibility({ categoryIdFilter: categoryId, perModelVisibilityOverride: true, handlerVisibility: "partial" });
      });
    });

    describe("element", () => {
      let modelId: string;
      let categoryId: string;
      let elementId: string;
      let childElementId: string;

      before(() => {
        modelId = firstModelId;
        categoryId = getFirstValue(models.get(modelId)!.values());
        elementId = getFirstValue(categoryParentElements.get(categoryId)!.values());
        childElementId = getFirstValue(elementHierarchy.get(elementId)!.values());
      });

      it("if model is hidden, showing element makes model and category partially visible", async () => {
        const elementNode = createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId });
        await handler.changeVisibility(elementNode, true);
        expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId, ...elementHierarchy.get(elementId)!]));
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
          }),
          assertCategoryVisibility({
            modelIdFilter: modelId,
            categoryIdFilter: (id) => id !== categoryId,
            handlerVisibility: "hidden",
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

        expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId, ...elementHierarchy.get(elementId)!]));
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
          }),
          assertCategoryVisibility({
            modelIdFilter: modelId,
            categoryIdFilter: (id) => id !== categoryId,
            handlerVisibility: "hidden",
          }),
          assertElementsVisibility({
            elementIdFilter: elementId,
            visibility: "visible",
          }),
        ]);
      });

      it("hiding parent element makes all children hidden", async () => {
        await handler.changeVisibility(createModelHierarchyNode(modelId), true);
        await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, hasChildren: true, elementId }), false);
        await Promise.all([
          assertElementsVisibility({
            elementIdFilter: elementId,
            visibility: "hidden",
          }),
          assertElementsVisibility({
            elementIdFilter: (id) => elementHierarchy.get(elementId)!.has(id),
            visibility: "hidden",
          }),
        ]);
      });

      it("hiding element makes all parent hierarchy partially visible", async () => {
        await handler.changeVisibility(createModelHierarchyNode(modelId), true);
        await handler.changeVisibility(createElementHierarchyNode({ modelId, categoryId, elementId: childElementId }), false);
        expect(viewport.neverDrawn).to.contain(childElementId);
        viewport.renderFrame();
        await Promise.all([
          assertModelVisibility({
            modelId,
            viewportVisibility: true,
            handlerVisibility: "partial",
          }),
          assertCategoryVisibility({
            categoryIdFilter: categoryId,
            perModelVisibilityOverride: true,
            handlerVisibility: "partial",
          }),
          assertElementsVisibility({
            categoryIdFilter: categoryId,
            elementIdFilter: elementId,
            visibility: "partial",
          }),
          assertElementsVisibility({
            categoryIdFilter: categoryId,
            elementIdFilter: childElementId,
            visibility: "hidden",
          }),
          assertElementsVisibility({
            categoryIdFilter: categoryId,
            elementIdFilter: (id) => elementHierarchy.get(elementId)!.has(id) && id !== childElementId,
            visibility: "visible",
          }),
        ]);
      });
    });

    describe("grouping nodes", () => {
      const classGroups = new Array<{
        parent: HierarchyNode & { key: ClassGroupingNodeKey };
        children: HierarchyNode[];
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

        const provider = createHierarchyProvider({
          imodelAccess,
          hierarchyDefinition: {
            defineHierarchyLevel: async (props) => {
              if (props.parentNode) {
                return [];
              }

              const query = createNodesQueryClauseFactory({ imodelAccess });
              return [
                {
                  fullClassName: "bis.GeometricElement3d",
                  query: {
                    ecsql: `
                      SELECT ${await query.createSelectClause({
                        ecClassId: { selector: `e.ECClassId` },
                        ecInstanceId: { selector: `e.ECInstanceId` },
                        nodeLabel: { selector: `e.UserLabel` },
                        grouping: {
                          byClass: true,
                        },
                      })}
                      FROM bis.GeometricElement3d e
                    `,
                  },
                },
              ];
            },
          },
        });

        for await (const parentNode of provider.getNodes({ parentNode: undefined })) {
          assert(HierarchyNode.isClassGroupingNode(parentNode));
          const children = new Array<HierarchyNode>();
          for await (const node of provider.getNodes({ parentNode })) {
            children.push(node);
          }
          classGroups.push({ parent: parentNode, children });
        }
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
          await Promise.all(
            children.map(async (node) => {
              assert(HierarchyNode.isInstancesNode(node));
              await expect(handler.getVisibilityStatus(node)).to.eventually.include(
                { state: "visible" },
                `element node ${JSON.stringify(node.key.instanceKeys[0])}, grouping by ${parentClassName}`,
              );
            }),
          );
          await handler.changeVisibility(parent, false);
          await Promise.all(
            children.map(async (node) => {
              assert(HierarchyNode.isInstancesNode(node));
              await expect(handler.getVisibilityStatus(node)).to.eventually.include(
                { state: "hidden" },
                `element node ${JSON.stringify(node.key.instanceKeys[0])}, grouping by ${parentClassName}`,
              );
            }),
          );
        });
      });

      it("hiding child node makes grouping node partial", async () => {
        classGroups.forEach(async ({ parent, children }) => {
          await handler.changeVisibility(children[0], false);
          await expect(handler.getVisibilityStatus(parent)).to.eventually.include({ state: "partial" });
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

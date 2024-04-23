/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import path from "path";
import { concat, defer, EMPTY, filter, firstValueFrom, from, map, merge, mergeMap, of } from "rxjs";
import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import { ColorDef, IModel, RenderMode } from "@itwin/core-common";
import { IModelApp, NoRenderApp, OffScreenViewport, PerModelCategoryVisibility, SpatialViewState, ViewRect } from "@itwin/core-frontend";
import {
  buildTestIModel, HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { toVoidPromise } from "../../../../components/trees/common/Rxjs";
import { createElementIdsCache } from "../../../../components/trees/models-tree/internal/ElementIdsCache";
import { createQueryProvider } from "../../../../components/trees/models-tree/internal/QueryProvider";
import { createSubjectModelIdsCache } from "../../../../components/trees/models-tree/internal/SubjectModelIdsCache";
import { createRuleset } from "../../../../components/trees/models-tree/internal/Utils";
import { VisibilityStateHandler } from "../../../../components/trees/models-tree/internal/VisibilityStateHandler";
import { addModel, addPartition, addPhysicalObject, addSpatialCategory } from "../../../IModelUtils";
import { TestUtils } from "../../../TestUtils";
import {
  createCategoryNode, createElementClassGroupingNode, createElementNode, createFakeQueryProvider, createFakeSinonViewport, createModelNode,
  createSubjectNode,
} from "../../Common";

import type { IQueryProvider } from "../../../../components/trees/models-tree/internal/QueryProvider";
import type { ElementIdsCache } from "../../../../components/trees/models-tree/internal/ElementIdsCache";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { Id64String } from "@itwin/core-bentley";
import type { Observable } from "rxjs";
import type { TreeNodeItem } from "@itwin/components-react";
import type { PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { VisibilityStatusRetrieverProps } from "../../../../components/trees/models-tree/internal/VisibilityStateHandler";
import type { VisibilityStatus } from "../../../../tree-widget-react";
import type { Visibility } from "../../../../components/trees/models-tree/internal/Tooltip";
function createFakeElementIdsCache(overrides?: Partial<ElementIdsCache>): ElementIdsCache {
  return {
    clear: sinon.fake(),
    getAssemblyElementIds: sinon.fake.returns(EMPTY),
    getGroupedElementIds: sinon.fake.returns(EMPTY),
    ...overrides,
  };
}

interface VisibilityOverrides {
  models?: Map<Id64String, Visibility>;
  categories?: Map<Id64String, Visibility>;
  elements?: Map<Id64String, Visibility>;
}

/**
 * Helper class which overrides children visibility checks.
 * This helps to avoid defining visibility for the entire hierarchy.
 */
class OverridableVisibilityStateHandler extends VisibilityStateHandler {
  private readonly _overrides?: VisibilityOverrides;

  constructor(props?: Partial<VisibilityStatusRetrieverProps> & { overrides?: VisibilityOverrides }) {
    const queryProvider = props?.queryProvider ?? createFakeQueryProvider();
    const subjectModelIdsCache = props?.subjectModelIdsCache ?? createSubjectModelIdsCache(queryProvider);
    super({
      queryProvider,
      subjectModelIdsCache,
      elementIdsCache: props?.elementIdsCache ?? createFakeElementIdsCache(),
      viewport: props?.viewport ?? createFakeSinonViewport(),
    });
    this._overrides = props?.overrides;
  }

  public override getModelVisibilityStatus(modelId: string): Observable<VisibilityStatus> {
    const override = this._overrides?.models?.get(modelId);
    if (override !== undefined) {
      return of({ state: override });
    }
    return super.getModelVisibilityStatus(modelId);
  }

  public override getCategoryDisplayStatus(categoryId: string, modelId: Id64String | undefined, hasChildren?: boolean): Observable<VisibilityStatus> {
    const override = this._overrides?.categories?.get(categoryId);
    if (override !== undefined) {
      return of({ state: override });
    }
    return super.getCategoryDisplayStatus(categoryId, modelId, hasChildren);
  }

  public override getElementDisplayStatus(id: string, hasChildren?: boolean): Observable<VisibilityStatus | undefined> {
    const override = this._overrides?.elements?.get(id);
    if (override !== undefined) {
      return of({ state: override });
    }
    return super.getElementDisplayStatus(id, hasChildren);
  }

  public override changeCategoryState = sinon.fake(super.changeCategoryState.bind(this));

  public override changeModelState = sinon.fake(super.changeModelState.bind(this));
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

      const handler = new OverridableVisibilityStateHandler();
      const result = await firstValueFrom(from(handler.getVisibilityStatus(node)));
      expect(result).to.include({ state: "hidden", isDisabled: true });
    });

    it("returns disabled if node is not PresentationTreeNodeItem", async () => {
      const handler = new OverridableVisibilityStateHandler();
      const result = await firstValueFrom(handler.getVisibilityStatus({} as TreeNodeItem));
      expect(result.state).to.be.eq("hidden");
      expect(result.isDisabled).to.be.true;
    });

    describe("subject", () => {
      it("returns disabled when active view is not spatial", async () => {
        const node = createSubjectNode();
        const viewport = createFakeSinonViewport({
          view: {
            isSpatialView: sinon.fake.returns(false),
          },
        });
        const handler = new OverridableVisibilityStateHandler({ viewport });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(viewport.view.isSpatialView).to.be.called;
        expect(result).to.include({ state: "hidden", isDisabled: true });
      });

      it("is visible when subject contains no models", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        const queryProvider = createFakeQueryProvider({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
        });
        const handler = new OverridableVisibilityStateHandler({ queryProvider });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "visible" });
      });

      it("is visible when all models are displayed", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        const queryProvider = createFakeQueryProvider({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
          subjectModels: new Map([
            [subjectIds[0], ["0x3"]],
            [subjectIds[1], ["0x4"]],
          ]),
        });
        const handler = new OverridableVisibilityStateHandler({
          queryProvider,
          overrides: {
            models: new Map([
              ["0x3", "visible"],
              ["0x4", "visible"],
            ]),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "visible" });
      });

      it("is hidden when all models are hidden", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        const queryProvider = createFakeQueryProvider({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
          subjectModels: new Map([
            [subjectIds[0], ["0x3"]],
            [subjectIds[1], ["0x4"]],
          ]),
        });
        const handler = new OverridableVisibilityStateHandler({
          queryProvider,
          overrides: {
            models: new Map([
              ["0x3", "hidden"],
              ["0x4", "hidden"],
            ]),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "hidden" });
      });

      it("is partially visible when at least one model is displayed and at least one model is hidden", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        const queryProvider = createFakeQueryProvider({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
          subjectModels: new Map([
            [subjectIds[0], ["0x3"]],
            [subjectIds[1], ["0x4"]],
          ]),
        });
        const handler = new OverridableVisibilityStateHandler({
          queryProvider,
          overrides: {
            models: new Map([
              ["0x3", "visible"],
              ["0x4", "hidden"],
            ]),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "partial" });
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
        const handler = new OverridableVisibilityStateHandler({ viewport });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(viewport.view.isSpatialView).to.be.called;
        expect(result).to.include({ state: "hidden", isDisabled: true });
      });

      describe("visible", () => {
        it("when `viewport.view.viewsModel` returns true and all categories are displayed", async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryProvider = createFakeQueryProvider({
            modelCategories: new Map([[modelId, categories]]),
          });
          const handler = new OverridableVisibilityStateHandler({
            queryProvider,
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
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
          const queryProvider = createFakeQueryProvider({
            modelCategories,
            categoryElements,
          });
          const handler = new OverridableVisibilityStateHandler({
            queryProvider,
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set([...categoryElements.values()].flat()),
              view: {
                viewsModel: sinon.fake.returns(false),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "visible" });
        });
      });

      describe("hidden", () => {
        it("when `viewport.view.viewsModel` returns false and all categories are hidden", async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryProvider = createFakeQueryProvider({
            modelCategories: new Map([[modelId, categories]]),
          });
          const handler = new OverridableVisibilityStateHandler({
            queryProvider,
            viewport: createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(false),
                viewsCategory: sinon.fake.returns(false),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "hidden" });
        });

        it("when `viewport.view.viewsModel` returns true but all categories are hidden", async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryProvider = createFakeQueryProvider({
            modelCategories: new Map([[modelId, categories]]),
          });
          const handler = new OverridableVisibilityStateHandler({
            queryProvider,
            viewport: createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(true),
                viewsCategory: sinon.fake.returns(false),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
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
          const queryProvider = createFakeQueryProvider({
            modelCategories,
            categoryElements,
          });
          const handler = new OverridableVisibilityStateHandler({
            queryProvider,
            viewport: createFakeSinonViewport({
              neverDrawn: new Set([...categoryElements.values()].flat()),
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
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
          const queryProvider = createFakeQueryProvider({
            modelCategories,
            categoryElements,
          });
          const handler = new OverridableVisibilityStateHandler({
            queryProvider,
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0xffff"]),
              isAlwaysDrawnExclusive: true,
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "hidden" });
        });
      });

      describe("partially visible", () => {
        it(`when 'viewport.view.viewsModel' returns true and at least one category is hidden`, async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryProvider = createFakeQueryProvider({
            modelCategories: new Map([[modelId, categories]]),
          });
          const handler = new OverridableVisibilityStateHandler({
            queryProvider,
            viewport: createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(true),
                viewsCategory: sinon.fake((id) => id === categories[0]),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "partial" });
        });

        it(`when 'viewport.view.viewsModel' returns FALSE and at least one category is VISIBLE`, async () => {
          const modelId = "0x1";
          const categories = ["0x10", "0x20"];
          const node = createModelNode(modelId);
          const queryProvider = createFakeQueryProvider({
            modelCategories: new Map([[modelId, categories]]),
          });
          const handler = new OverridableVisibilityStateHandler({
            queryProvider,
            viewport: createFakeSinonViewport({
              view: {
                viewsModel: sinon.fake.returns(false),
                viewsCategory: sinon.fake((id) => id === categories[0]),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "partial" });
        });

        it("when `viewport.view.viewsModel` returns true but some of the nested child elements are in never drawn list", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const queryProvider = createFakeQueryProvider({
            modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
            categoryElements: new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]),
          });
          const handler = new OverridableVisibilityStateHandler({
            queryProvider,
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(["0x100"]),
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "partial" });
        });

        it("when `viewport.view.viewsModel` returns false but some of the nested child elements are in the always drawn list", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const queryProvider = createFakeQueryProvider({
            modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
            categoryElements: new Map([
              ["0x10", ["0x100", "0x200"]],
              ["0x20", ["0x300", "0x400"]],
            ]),
          });
          const handler = new OverridableVisibilityStateHandler({
            queryProvider,
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x100"]),
              view: {
                viewsModel: () => false,
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "partial" });
        });
      });
    });

    describe("category", () => {
      describe("is visible", () => {
        it("when `viewport.view.viewsCategory` returns TRUE and there are NO CHILD elements in the NEVER drawn list", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const handler = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              view: {
                viewsCategory: sinon.fake.returns(true),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "visible" });
        });

        it("when there's a per model category override to SHOW and there are NO CHILD elements in the NEVER drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryNode({ id: modelId, className: "" }, categoryId);
          const handler = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              perModelCategoryVisibility: {
                getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Show),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "visible" });
        });
      });

      describe("is hidden", () => {
        it("when `viewport.view.viewsCategory` returns FALSE and there ARE NO CHILD elements in the ALWAYS drawn list", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const handler = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              view: {
                viewsCategory: sinon.fake.returns(false),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "hidden" });
        });

        it("when `viewport.view.viewsCategory` returns TRUE and there ARE UNRELATED elements in the EXCLUSIVE ALWAYS drawn list", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const handler = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
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
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "hidden" });
        });

        it("when `viewport.view.viewsCategory` returns TRUE and ALL CHILD elements are in the NEVER drawn list", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const handler = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(["0x2", "0x3"]),
              view: {
                viewsCategory: sinon.fake.returns(true),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "hidden" });
        });

        it("when there's a per model category override to HIDE and there ARE NO CHILD elements in the ALWAYS drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryNode({ id: modelId, className: "" }, categoryId);
          const handler = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              perModelCategoryVisibility: {
                getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Hide),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "hidden" });
        });

        it("when there's a per model category override to SHOW and there ARE UNRELATED elements in the EXCLUSIVE ALWAYS drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryNode({ id: modelId, className: "" }, categoryId);
          const handler = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
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
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "hidden" });
        });
      });

      describe("is partially visible", () => {
        it("when `viewport.view.viewsCategory` returns TRUE and there ARE SOME CHILD elements in the NEVER drawn list", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const handler = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(["0x2"]),
              view: {
                viewsCategory: sinon.fake.returns(true),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "partial" });
        });

        it("when `viewport.view.viewsCategory` returns FALSE and there ARE SOME CHILD elements in the ALWAYS drawn list", async () => {
          const categoryId = "0x2";
          const node = createCategoryNode(undefined, categoryId);
          const handler = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x2"]),
              view: {
                viewsCategory: sinon.fake.returns(false),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "partial" });
        });

        it("when there's a per model category override to SHOW and there ARE SOME CHILD elements in the NEVER drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryNode({ id: modelId, className: "" }, categoryId);
          const handler = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              neverDrawn: new Set(["0x2"]),
              perModelCategoryVisibility: {
                getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Show),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "partial" });
        });

        it("when there's a per model category override to HIDE and there ARE SOME CHILD elements in the ALWAYS drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const node = createCategoryNode({ id: modelId, className: "" }, categoryId);
          const handler = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              categoryElements: new Map([[categoryId, ["0x2", "0x3"]]]),
            }),
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x2"]),
              perModelCategoryVisibility: {
                getOverride: sinon.fake.returns(PerModelCategoryVisibility.Override.Hide),
              },
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "partial" });
        });
      });
    });

    describe("element", () => {
      it("is visible when all child elements are displayed", async () => {
        const elementId = "0x1";
        const childElements = ["0x10", "0x20"];
        const node = createElementNode(undefined, undefined, true, elementId);
        const handler = new OverridableVisibilityStateHandler({
          queryProvider: createFakeQueryProvider({
            elementHierarchy: new Map([[elementId, childElements]]),
          }),
          overrides: {
            elements: new Map(childElements.map((x) => [x, "visible"])),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "visible" });
      });

      it("is hidden when all child elements are hidden", async () => {
        const elementId = "0x1";
        const childElements = ["0x10", "0x20"];
        const node = createElementNode(undefined, undefined, true, elementId);
        const handler = new OverridableVisibilityStateHandler({
          queryProvider: createFakeQueryProvider({
            elementHierarchy: new Map([[elementId, childElements]]),
          }),
          viewport: createFakeSinonViewport({
            neverDrawn: new Set(childElements),
          }),
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "hidden" });
      });

      it("is partially visible when at least one element is displayed and at least one element is hidden", async () => {
        const elementId = "0x1";
        const childElements = ["0x10", "0x20"];
        const node = createElementNode(undefined, undefined, true, elementId);
        const handler = new OverridableVisibilityStateHandler({
          queryProvider: createFakeQueryProvider({
            elementHierarchy: new Map([[elementId, childElements]]),
          }),
          viewport: createFakeSinonViewport({
            alwaysDrawn: new Set([childElements[0]]),
            neverDrawn: new Set([childElements[1]]),
          }),
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "partial" });
      });

      describe("no children", () => {
        it("doesn't query children if known to have none", async () => {
          const queryProvider = createFakeQueryProvider();
          const handler = new OverridableVisibilityStateHandler({
            queryProvider,
          });
          const result = await firstValueFrom(handler.getElementDisplayStatus("0x1", false));
          expect(result).to.be.undefined;
          expect(queryProvider.queryElementChildren).not.to.be.called;
        });

        it("is visible if present in the always drawn list", async () => {
          const elementId = "0x1";
          const node = createElementNode(undefined, undefined, false, elementId);
          const handler = new OverridableVisibilityStateHandler({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set([elementId]),
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "visible" });
        });

        it("is hidden if present in the never drawn list", async () => {
          const elementId = "0x1";
          const node = createElementNode(undefined, undefined, false, elementId);
          const handler = new OverridableVisibilityStateHandler({
            viewport: createFakeSinonViewport({
              neverDrawn: new Set([elementId]),
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "hidden" });
        });

        it("is hidden if other elements are present in the always drawn list and exclusive mode is enabled", async () => {
          const elementId = "0x1";
          const node = createElementNode(undefined, undefined, false, elementId);
          const handler = new OverridableVisibilityStateHandler({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(["0x2"]),
              isAlwaysDrawnExclusive: true,
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "hidden" });
        });

        it("is visible when not present in always/never drawn sets", async () => {
          const elementId = "0x1";
          const node = createElementNode(undefined, undefined, false, elementId);
          const handler = new OverridableVisibilityStateHandler({
            viewport: createFakeSinonViewport({
              alwaysDrawn: new Set(),
              neverDrawn: new Set(),
            }),
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "visible" });
        });

        it("is visible when always/never drawn sets are undefined", async () => {
          const elementId = "0x1";
          const node = createElementNode(undefined, undefined, false, elementId);
          const handler = new OverridableVisibilityStateHandler();
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "visible" });
        });
      });
    });

    describe("grouping node", () => {
      it("is visible if all node elements are visible", async () => {
        const elementIds = ["0x1", "0x2"];
        const node = createElementClassGroupingNode(elementIds);
        const spy = sinon.fake.returns(of({ elementIds: from(elementIds) }));
        const handler = new OverridableVisibilityStateHandler({
          elementIdsCache: createFakeElementIdsCache({ getGroupedElementIds: spy }),
          overrides: {
            elements: new Map(elementIds.map((x) => [x, "visible"])),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "visible" });
        expect(spy).to.be.called.calledOnceWith(node.key);
      });

      it("is hidden if all node elements are hidden", async () => {
        const elementIds = ["0x1", "0x2"];
        const node = createElementClassGroupingNode(elementIds);
        const spy = sinon.fake.returns(of({ elementIds: from(elementIds) }));
        const handler = new OverridableVisibilityStateHandler({
          elementIdsCache: createFakeElementIdsCache({ getGroupedElementIds: spy }),
          overrides: {
            elements: new Map(elementIds.map((x) => [x, "hidden"])),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "hidden" });
        expect(spy).to.be.called.calledOnceWith(node.key);
      });

      it("is partially visible if some node elements are hidden", async () => {
        const elementIds = ["0x1", "0x2"];
        const node = createElementClassGroupingNode(elementIds);
        const spy = sinon.fake.returns(of({ elementIds: from(elementIds) }));
        const handler = new OverridableVisibilityStateHandler({
          elementIdsCache: createFakeElementIdsCache({ getGroupedElementIds: spy }),
          overrides: {
            elements: new Map([
              [elementIds[0], "visible"],
              [elementIds[1], "hidden"],
            ]),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "partial" });
        expect(spy).to.be.called.calledOnceWith(node.key);
      });
    });
  });

  describe("changeVisibilityStatus", () => {
    it("does nothing if node is invalid", () => {
      const node: TreeNodeItem = {
        id: "",
        label: PropertyRecord.fromString(""),
      };

      const provider = new OverridableVisibilityStateHandler();
      expect(provider.changeVisibility(node, true)).to.eq(EMPTY);
    });

    describe("subject", () => {
      describe("on", () => {
        it("marks all models as visible", async () => {
          const subjectIds = ["0x1", "0x2"];
          const modelIds = [
            ["0x3", "0x4"],
            ["0x5", "0x6"],
          ];
          const node = createSubjectNode(subjectIds);
          const viewport = createFakeSinonViewport();
          const provider = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              subjectModels: new Map(subjectIds.map((id, idx) => [id, modelIds[idx]])),
            }),
            viewport,
          });

          await toVoidPromise(provider.changeVisibility(node, true));
          expect(provider.changeModelState).to.be.calledOnceWith(sinon.match.set.deepEquals(new Set(modelIds.flat())), true);
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
          const provider = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              subjectModels: new Map(subjectIds.map((id, idx) => [id, modelIds[idx]])),
            }),
          });

          await toVoidPromise(provider.changeVisibility(node, false));
          expect(provider.changeModelState).to.be.calledOnceWith(sinon.match.set.deepEquals(new Set(modelIds.flat())), false);
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
          const provider = new OverridableVisibilityStateHandler({
            viewport,
            queryProvider: createFakeQueryProvider({
              modelCategories: new Map([[modelId, categoryIds]]),
            }),
          });
          const visible = state === "visible";
          await toVoidPromise(provider.changeVisibility(node, visible));

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
          const provider = new OverridableVisibilityStateHandler({
            viewport,
            queryProvider: createFakeQueryProvider({
              modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            }),
          });
          await toVoidPromise(provider.changeVisibility(node, visibility));
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
          const provider = new OverridableVisibilityStateHandler({
            viewport,
            queryProvider: createFakeQueryProvider({
              modelCategories: new Map([[modelId, ["0x10", "0x20"]]]),
              categoryElements: new Map([
                ["0x10", ["0x100", "0x200"]],
                ["0x20", ["0x300", "0x400"]],
              ]),
            }),
          });
          await toVoidPromise(provider.changeVisibility(node, visibility));
          expect(viewport.alwaysDrawn).to.deep.eq(new Set(["abcd"]));
          expect(viewport.neverDrawn).to.deep.eq(new Set(["1234"]));
        });
      }

      describe("on", () => {
        it("marks itself visible", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const viewport = createFakeSinonViewport();
          const provider = new OverridableVisibilityStateHandler({ viewport });
          await toVoidPromise(provider.changeVisibility(node, true));
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
          const provider = new OverridableVisibilityStateHandler({ viewport });
          await toVoidPromise(provider.changeVisibility(node, false));
          expect(viewport.changeModelDisplay).to.be.calledOnceWith(modelId, false);
        });

        testAlwaysAndNeverDrawnChildrenAccess(false);
        testCategoryStateChange("hidden");
      });
    });

    describe("element", () => {
      describe("on", () => {
        it("removes it from the never drawn list", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const node = createElementNode(modelId, categoryId, false, elementId);
          const viewport = createFakeSinonViewport({
            neverDrawn: new Set([elementId]),
          });
          const provider = new OverridableVisibilityStateHandler({ viewport });
          await toVoidPromise(provider.changeVisibility(node, true));
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
          const provider = new OverridableVisibilityStateHandler({ viewport });
          await toVoidPromise(provider.changeVisibility(node, true));
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
          const provider = new OverridableVisibilityStateHandler({ viewport });
          await toVoidPromise(provider.changeVisibility(node, true));
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
          const provider = new OverridableVisibilityStateHandler({
            viewport,
            overrides: {
              models: new Map([[modelId, "hidden"]]),
            },
          });
          await toVoidPromise(provider.changeVisibility(node, true));
          expect(viewport.alwaysDrawn).to.deep.eq(new Set([elementId]));
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
          const provider = new OverridableVisibilityStateHandler({ viewport });
          await toVoidPromise(provider.changeVisibility(node, false));
          expect(viewport.alwaysDrawn?.size ?? 0).to.eq(0);
        });

        it("adds element to the never drawn list if model is visible", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const node = createElementNode(modelId, categoryId, false, elementId);
          const viewport = createFakeSinonViewport({
            view: {
              viewsModel: sinon.fake.returns(true),
            },
          });
          const provider = new OverridableVisibilityStateHandler({ viewport });
          await toVoidPromise(provider.changeVisibility(node, false));
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
          const provider = new OverridableVisibilityStateHandler({ viewport });
          await toVoidPromise(provider.changeVisibility(node, false));
          expect(viewport.alwaysDrawn?.size ?? 0).to.eq(0);
          expect(viewport.neverDrawn?.size ?? 0).to.eq(0);
        });

        it("adds element to the never drawn list if category is visible", async () => {
          const modelId = "0x1";
          const categoryId = "0x2";
          const elementId = "0x3";
          const node = createElementNode(modelId, categoryId, false, elementId);
          const viewport = createFakeSinonViewport({
            view: {
              viewsCategory: sinon.fake.returns(true),
            },
          });
          const provider = new OverridableVisibilityStateHandler({ viewport });
          await toVoidPromise(provider.changeVisibility(node, false));
          expect(viewport.neverDrawn).to.deep.eq(new Set([elementId]));
        });
      });
    });
  });

  describe("#integration", () => {
    let iModel: IModelConnection;
    let modelId: Id64String;
    const categories = new Map<Id64String, Id64String[]>();

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
        const partitionId = addPartition(builder, "BisCore:PhysicalPartition", "TestPhysicalModel");
        modelId = addModel(builder, "BisCore:PhysicalModel", partitionId);
        for (let i = 0; i < 2; ++i) {
          const category = addSpatialCategory(builder, IModel.dictionaryId, `Test SpatialCategory ${i}`);
          const elements = new Array<string>();
          for (let j = 0; j < 10; ++j) {
            const element = addPhysicalObject(builder, modelId, category);
            elements.push(element);
          }
          categories.set(category, elements);
        }
      });
    });

    after(async () => {
      await iModel.close();
      await terminatePresentationTesting();
    });

    let viewport: Viewport;
    let handler: VisibilityStateHandler;
    let queryProvider: IQueryProvider;

    beforeEach(() => {
      queryProvider = createQueryProvider(iModel);
      viewport = OffScreenViewport.create({
        view: createBlankViewState(iModel),
        viewRect: new ViewRect(),
      });
      handler = new VisibilityStateHandler({
        elementIdsCache: createElementIdsCache(iModel, createRuleset({}).id),
        queryProvider,
        subjectModelIdsCache: createSubjectModelIdsCache(queryProvider),
        viewport,
      });
    });

    function assertModelVisibility(viewportVisibility: boolean, handlerVisibility: Visibility): Observable<void> {
      return concat(
        defer(() => {
          expect(viewport.view.viewsModel(modelId)).to.eq(viewportVisibility, "Model has unexpected viewport visibility");
          return EMPTY;
        }),
        handler.getModelVisibilityStatus(modelId).pipe(
          map((x) => {
            expect(x.state).to.eq(handlerVisibility, "Model has unexpected visibility in the handler");
          }),
        ),
      );
    }

    function assertCategoryVisibility(props: {
      viewportVisibility: boolean;
      perModelVisibilityOverride?: boolean;
      handlerVisibility: Visibility;
      categoryIdFilter?: (id: Id64String) => boolean;
    }): Observable<void> {
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
      return from(categories.keys()).pipe(
        filter((id) => !props.categoryIdFilter || props.categoryIdFilter(id)),
        mergeMap((id) => {
          expect(viewport.view.viewsCategory(id)).to.eq(props.viewportVisibility, `Category has unexpected viewport visibility`);
          const actualOverride = viewport.perModelCategoryVisibility.getOverride(modelId, id);
          expect(actualOverride).to.eq(
            expectedOverride,
            `
              Category has unexpected per model visibility override.
              Expected ${overrideToString(expectedOverride)}, actual: ${overrideToString(actualOverride)}
            `,
          );

          return handler.getCategoryDisplayStatus(id, modelId).pipe(
            map((status) => {
              expect(status.state).to.eq(props.handlerVisibility, `Category has unexpected visibility in the handler`);
            }),
          );
        }),
      );
    }

    function assertElementsVisibility(visibility: Visibility, categoryId?: Id64String): Observable<void> {
      return from(categories.keys()).pipe(
        filter((id) => !categoryId || id === categoryId),
        mergeMap((id) => {
          return from(categories.get(id)!).pipe(mergeMap((elementId) => handler.getElementDisplayStatus(elementId)));
        }),
        map((status) => {
          // If visibility status of element is undefined, then it corresponds to parent's visibility status.
          // If it's defined, then it contradicts parent's status, and can make it partially visible or of opposite visibility.
          if (status) {
            expect(status?.state).to.eq(visibility, "Element has unexpected visibility");
          }
        }),
      );
    }

    describe("subject", () => {
      let node: PresentationTreeNodeItem;

      before(() => (node = createSubjectNode(iModel.elements.rootSubjectId)));

      it("showing it makes it, all its models, categories and elements visible", async () => {
        await toVoidPromise(
          concat(
            handler.changeVisibility(node, true),
            merge(
              handler.getVisibilityStatus(node).pipe(map((status) => void expect(status.state).to.eq("visible"))),
              assertModelVisibility(true, "visible"),
              assertCategoryVisibility({ viewportVisibility: true, handlerVisibility: "visible" }),
              assertElementsVisibility("visible"),
            ),
          ),
        );
      });

      it("hiding it makes it, all its models, categories and elements hidden", async () => {
        await toVoidPromise(
          concat(
            handler.changeVisibility(node, false),
            merge(
              handler.getVisibilityStatus(node).pipe(map((status) => void expect(status.state).to.eq("hidden"))),
              assertModelVisibility(false, "hidden"),
              assertCategoryVisibility({ viewportVisibility: false, handlerVisibility: "hidden" }),
              assertElementsVisibility("hidden"),
            ),
          ),
        );
      });
    });

    describe("model", () => {
      it("showing it makes it, all its categories and elements visible", async () => {
        await toVoidPromise(
          concat(
            handler.changeModelState(modelId, true),
            merge(
              assertModelVisibility(true, "visible"),
              assertCategoryVisibility({ viewportVisibility: true, handlerVisibility: "visible" }),
              assertElementsVisibility("visible"),
            ),
          ),
        );
      });

      it("hiding it makes it, all its categories and elements hidden", async () => {
        await toVoidPromise(
          concat(
            handler.changeModelState(modelId, false),
            merge(
              assertModelVisibility(false, "hidden"),
              assertCategoryVisibility({ viewportVisibility: false, handlerVisibility: "hidden" }),
              assertElementsVisibility("hidden"),
            ),
          ),
        );
      });
    });

    describe("category", () => {
      let categoryId: Id64String;

      before(() => {
        [categoryId] = [...categories.keys()];
      });

      it("showing it makes it and its elements visible, and model partially visible", async () => {
        await toVoidPromise(
          concat(
            handler.changeModelState(modelId, false),
            defer(async () => handler.changeCategoryState(categoryId, modelId, true)),
            merge(
              // Model stays "hidden" in the viewport but should have a category visibility override
              assertModelVisibility(false, "partial"),
              assertCategoryVisibility({
                categoryIdFilter: (id) => id === categoryId,
                viewportVisibility: false,
                perModelVisibilityOverride: true,
                handlerVisibility: "visible",
              }),
              assertElementsVisibility("visible", categoryId),
            ),
          ),
        );
      });

      it("hiding it makes it and its elements hidden, and model partially visible", async () => {
        await toVoidPromise(
          concat(
            handler.changeModelState(modelId, true),
            defer(async () => handler.changeCategoryState(categoryId, modelId, false)),
            merge(
              // Model stays "visible" in the viewport but should have a category visibility override
              assertModelVisibility(true, "partial"),
              assertCategoryVisibility({
                categoryIdFilter: (id) => id === categoryId,
                viewportVisibility: true,
                perModelVisibilityOverride: false,
                handlerVisibility: "hidden",
              }),
              assertElementsVisibility("hidden", categoryId),
            ),
          ),
        );
      });
    });

    describe("element", () => {
      let categoryId: string;
      let elementId: string;

      before(() => {
        const firstEntry = [...categories.entries()][0];
        categoryId = firstEntry[0];
        elementId = firstEntry[1][0];
      });

      it("showing it makes model and category partial", async () => {
        await toVoidPromise(
          concat(
            handler.changeModelState(modelId, false),
            handler.changeElementState({ id: elementId, categoryId, modelId, on: true, hasChildren: false }),
            merge(
              assertModelVisibility(false, "partial"),
              assertCategoryVisibility({
                categoryIdFilter: (id) => id === categoryId,
                viewportVisibility: false,
                handlerVisibility: "partial",
              }),
            ),
          ),
        );
      });

      it("hiding it makes model and category partial", async () => {
        await toVoidPromise(
          concat(
            handler.changeModelState(modelId, true),
            handler.changeElementState({ id: elementId, categoryId, modelId, on: false, hasChildren: false }),
            merge(
              assertModelVisibility(true, "partial"),
              assertCategoryVisibility({
                categoryIdFilter: (id) => id === categoryId,
                viewportVisibility: true,
                handlerVisibility: "partial",
              }),
            ),
          ),
        );
      });
    });
  });
});

/** Copied from https://github.com/iTwin/appui/blob/master/test-apps/appui-test-app/appui-test-providers/src/createBlankConnection.ts#L26 */
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

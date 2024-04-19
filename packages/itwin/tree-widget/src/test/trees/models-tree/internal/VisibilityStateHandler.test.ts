/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, firstValueFrom, from, of } from "rxjs";
import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import { IModelApp, NoRenderApp, PerModelCategoryVisibility } from "@itwin/core-frontend";
import { createSubjectModelIdsCache } from "../../../../components/trees/models-tree/internal/SubjectModelIdsCache";
import { VisibilityStateHandler } from "../../../../components/trees/models-tree/internal/VisibilityStateHandler";
import { TestUtils } from "../../../TestUtils";
import {
  createCategoryNode, createElementClassGroupingNode, createElementNode, createFakeQueryProvider, createFakeSinonViewport, createModelNode,
  createSubjectNode,
} from "../../Common";

import type { ElementIdsCache } from "../../../../components/trees/models-tree/internal/ElementIdsCache";
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

  public override getElementDisplayStatus(elementId: string, hasChildren?: boolean | undefined): Observable<VisibilityStatus | undefined> {
    const override = this._overrides?.elements?.get(elementId);
    if (override !== undefined) {
      return of({ state: override });
    }
    return super.getElementDisplayStatus(elementId, hasChildren);
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

      it("is visible when `viewport.view.viewsModel` returns true and all categories are displayed", async () => {
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
            },
          }),
          overrides: {
            categories: new Map(categories.map((x) => [x, "visible"])),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "visible" });
      });

      it("is hidden when `viewport.view.viewsModel` returns false and all categories are hidden", async () => {
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
            },
          }),
          overrides: {
            categories: new Map(categories.map((x) => [x, "hidden"])),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "hidden" });
      });

      function modelVisibilityPartialTest(modelVisible: boolean, differingCategoryVisibility: Visibility) {
        it(`is partially visible when 'viewport.view.viewsModel' returns ${modelVisible} and at least one category is ${differingCategoryVisibility}`, async () => {
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
                viewsModel: sinon.fake.returns(modelVisible),
              },
            }),
            overrides: {
              categories: new Map([
                [categories[0], modelVisible ? "visible" : "hidden"],
                [categories[1], differingCategoryVisibility],
              ]),
            },
          });
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "partial" });
        });
      }

      modelVisibilityPartialTest(true, "hidden");
      modelVisibilityPartialTest(true, "partial");
      modelVisibilityPartialTest(false, "visible");
      modelVisibilityPartialTest(false, "partial");
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
          overrides: {
            elements: new Map(childElements.map((x) => [x, "hidden"])),
          },
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
          overrides: {
            elements: new Map([
              [childElements[0], "visible"],
              [childElements[1], "hidden"],
            ]),
          },
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
          const spy = sinon.fake.resolves(undefined);
          const provider = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              subjectModels: new Map(subjectIds.map((id, idx) => [id, modelIds[idx]])),
            }),
            viewport: createFakeSinonViewport({
              addViewedModels: spy,
            }),
          });

          await toPromise(provider.changeVisibility(node, true));
          expect(spy).to.be.calledOnceWith(modelIds.flat());
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

          await toPromise(provider.changeVisibility(node, false));
          expect(provider.changeModelState).to.be.calledOnceWith(modelIds.flat(), false);
        });
      });
    });

    describe("model", () => {
      function testCategoryStateChange(state: "visible" | "hidden") {
        it(`marks all categories ${state}`, async () => {
          const modelId = "0x1";
          const categoryIds = ["0x2", "0x3", "0x4"];
          const node = createModelNode(modelId);
          const provider = new OverridableVisibilityStateHandler({
            queryProvider: createFakeQueryProvider({
              modelCategories: new Map([[modelId, categoryIds]]),
            }),
          });
          const visible = state === "visible";
          await toPromise(provider.changeVisibility(node, visible));

          expect(provider.changeCategoryState).to.have.callCount(categoryIds.length);
          for (const categoryId of categoryIds) {
            expect(provider.changeCategoryState).to.be.calledWith(categoryId, modelId, visible);
          }
        });
      }

      describe("on", () => {
        it("marks itself visible", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const viewport = createFakeSinonViewport();
          const provider = new OverridableVisibilityStateHandler({ viewport });
          await toPromise(provider.changeVisibility(node, true));
          expect(viewport.addViewedModels).to.be.calledOnceWith(modelId);
        });

        testCategoryStateChange("visible");
      });

      describe("off", () => {
        it("marks itself hidden", async () => {
          const modelId = "0x1";
          const node = createModelNode(modelId);
          const viewport = createFakeSinonViewport();
          const provider = new OverridableVisibilityStateHandler({ viewport });
          await toPromise(provider.changeVisibility(node, false));
          expect(viewport.changeModelDisplay).to.be.calledOnceWith(modelId, false);
        });

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
          await toPromise(provider.changeVisibility(node, true));
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
          await toPromise(provider.changeVisibility(node, true));
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
          await toPromise(provider.changeVisibility(node, true));
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
          await toPromise(provider.changeVisibility(node, true));
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
          await toPromise(provider.changeVisibility(node, false));
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
          await toPromise(provider.changeVisibility(node, false));
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
          await toPromise(provider.changeVisibility(node, false));
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
          await toPromise(provider.changeVisibility(node, false));
          expect(viewport.neverDrawn).to.deep.eq(new Set([elementId]));
        });
      });
    });
  });
});

async function toPromise(obs: Observable<void>) {
  return new Promise<void>((resolve, reject) => {
    obs.subscribe({
      next: resolve,
      complete: resolve,
      error: reject,
    });
  });
}

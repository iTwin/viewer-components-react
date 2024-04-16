/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EMPTY, firstValueFrom, from, map, of } from "rxjs";
import sinon from "sinon";
import { PropertyRecord } from "@itwin/appui-abstract";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ElementIdsCacheImplementation } from "../../../components/trees/models-tree/internal/ElementIdsCache";
import { createSubjectModelIdsCache } from "../../../components/trees/models-tree/internal/SubjectModelIdsCache";
import { VisibilityStateHandler } from "../../../components/trees/models-tree/internal/VisibilityStateHandler";
import { createFakeSinonViewport, TestUtils } from "../../TestUtils";
import { createCategoryNode, createElementNode, createModelNode, createSubjectNode } from "../Common";

import type { Id64String } from "@itwin/core-bentley";
import type { Observable } from "rxjs";
import type { TreeNodeItem } from "@itwin/components-react";
import type { QueryProvider } from "../../../components/trees/models-tree/internal/QueryProvider";
import type { PresentationTreeNodeItem } from "@itwin/presentation-components";
import type { VisibilityStatusRetrieverProps } from "../../../components/trees/models-tree/internal/VisibilityStateHandler";
import type { VisibilityStatus } from "../../../tree-widget-react";
import type { Visibility } from "../../../components/trees/models-tree/internal/Tooltip";
interface SubjectModelIdsMockProps {
  subjectsHierarchy?: Map<Id64String, Id64String[]>;
  subjectModels?: Map<Id64String, Array<{ id: Id64String; content?: string }>>;
  modelCategories?: Map<Id64String, Id64String[]>;
  categoryElements?: Map<Id64String, Id64String[]>;
  elementHierarchy?: Map<Id64String, Id64String[]>;
}

interface SubjectsRow {
  id: Id64String;
  parentId?: Id64String;
  targetPartitionId?: Id64String;
}

interface ElementRow {
  id: Id64String;
  parentId: Id64String;
}

function createFakeQueryProvider(props?: SubjectModelIdsMockProps): QueryProvider {
  const subjectQueryRows: SubjectsRow[] = [];
  props?.subjectsHierarchy?.forEach((ids, parentId) => ids.forEach((id) => subjectQueryRows.push({ id, parentId })));

  const modelRows: ElementRow[] = [];
  props?.subjectModels?.forEach((modelInfos, subjectId) => modelInfos.forEach((modelInfo) => modelRows.push({ id: modelInfo.id, parentId: subjectId })));

  const res: QueryProvider = {
    queryAllSubjects: sinon.fake.returns(from(subjectQueryRows)),
    queryAllModels: sinon.fake.returns(from(modelRows)),
    queryModelCategories: sinon.fake((x) => {
      return from(props?.modelCategories?.get(x) ?? []);
    }),
    queryCategoryElements: sinon.fake((x) => {
      return from(props?.categoryElements?.get(x) ?? []).pipe(map((id) => ({ id, hasChildren: !!props?.elementHierarchy?.get(id)?.length })));
    }),
    queryElementChildren: sinon.fake((x) => {
      const children = props?.elementHierarchy?.get(x);
      if (!children) {
        return EMPTY;
      }

      return from(children).pipe(map((id) => ({ id, hasChildren: !!props?.elementHierarchy?.get(id)?.length })));
    }),
  };
  return res;
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

  constructor(
    props?: Partial<VisibilityStatusRetrieverProps> & {
      overrides?: VisibilityOverrides;
    },
  ) {
    const queryProvider = props?.queryProvider ?? createFakeQueryProvider();
    const subjectModelIdsCache = props?.subjectModelIdsCache ?? createSubjectModelIdsCache(queryProvider);
    super({
      queryProvider,
      subjectModelIdsCache,
      elementIdsCache: props?.elementIdsCache ?? sinon.createStubInstance(ElementIdsCacheImplementation),
      viewport: props?.viewport ?? createFakeSinonViewport(),
    });
    this._overrides = props?.overrides;
  }

  public override getModelDisplayStatus(modelId: string): Observable<VisibilityStatus> {
    const override = this._overrides?.models?.get(modelId);
    if (override !== undefined) {
      return of({ state: override });
    }
    return super.getModelDisplayStatus(modelId);
  }

  public override getCategoryDisplayStatus(categoryId: string, modelId: Id64String | undefined, hasChildren?: boolean): Observable<VisibilityStatus> {
    const override = this._overrides?.categories?.get(categoryId);
    if (override !== undefined) {
      return of({ state: override });
    }
    return super.getCategoryDisplayStatus(categoryId, modelId, hasChildren);
  }

  public override getElementDisplayStatus(elementId: string, hasChildren?: boolean | undefined): Observable<VisibilityStatus> {
    const override = this._overrides?.elements?.get(elementId);
    if (override !== undefined) {
      return of({ state: override });
    }
    return super.getElementDisplayStatus(elementId, hasChildren);
  }
}

describe.only("VisibilityStateHandler", () => {
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
            viewsCategory: sinon.fake.returns(true),
          },
        });
        const handler = new OverridableVisibilityStateHandler({ viewport });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(viewport.view.isSpatialView).to.be.called;
        expect(result).to.include({ state: "hidden", isDisabled: true });
      });

      it("returns 'visible' when subject contains no models", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        const queryProvider = createFakeQueryProvider({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
        });
        const handler = new OverridableVisibilityStateHandler({ queryProvider });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "visible" });
      });

      it("returns 'visible' when all models are displayed", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        const queryProvider = createFakeQueryProvider({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
          subjectModels: new Map([
            [subjectIds[0], [{ id: "0x3" }]],
            [subjectIds[1], [{ id: "0x4" }]],
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

      it("returns 'hidden' when all models are hidden", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        const queryProvider = createFakeQueryProvider({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
          subjectModels: new Map([
            [subjectIds[0], [{ id: "0x3" }]],
            [subjectIds[1], [{ id: "0x4" }]],
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

      it("returns 'partial' when at least one model is displayed and at least one model is hidden", async () => {
        const subjectIds = ["0x1", "0x2"];
        const node = createSubjectNode(subjectIds);
        const queryProvider = createFakeQueryProvider({
          subjectsHierarchy: new Map([["0x0", subjectIds]]),
          subjectModels: new Map([
            [subjectIds[0], [{ id: "0x3" }]],
            [subjectIds[1], [{ id: "0x4" }]],
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
      it("returns disabled when active view is not spatial", async () => {
        const node = createModelNode();
        const viewport = createFakeSinonViewport({
          view: {
            isSpatialView: sinon.fake.returns(false),
            viewsCategory: sinon.fake.returns(true),
          },
        });
        const handler = new OverridableVisibilityStateHandler({ viewport });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(viewport.view.isSpatialView).to.be.called;
        expect(result).to.include({ state: "hidden", isDisabled: true });
      });

      it("returns 'visible' when all categories are displayed", async () => {
        const modelId = "0x1";
        const categories = ["0x10", "0x20"];
        const node = createModelNode(modelId);
        const queryProvider = createFakeQueryProvider({
          modelCategories: new Map([[modelId, categories]]),
        });
        const handler = new OverridableVisibilityStateHandler({
          queryProvider,
          overrides: {
            categories: new Map(categories.map((x) => [x, "visible"])),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "visible" });
      });

      it("returns 'hidden' when all categories are hidden", async () => {
        const modelId = "0x1";
        const categories = ["0x10", "0x20"];
        const node = createModelNode(modelId);
        const queryProvider = createFakeQueryProvider({
          modelCategories: new Map([[modelId, categories]]),
        });
        const handler = new OverridableVisibilityStateHandler({
          queryProvider,
          overrides: {
            categories: new Map(categories.map((x) => [x, "hidden"])),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "hidden" });
      });

      it("returns 'partial' when at least one category is displayed and at least one category is hidden", async () => {
        const modelId = "0x1";
        const categories = ["0x10", "0x20"];
        const node = createModelNode(modelId);
        const queryProvider = createFakeQueryProvider({
          modelCategories: new Map([[modelId, categories]]),
        });
        const handler = new OverridableVisibilityStateHandler({
          queryProvider,
          overrides: {
            categories: new Map([
              [categories[0], "visible"],
              [categories[1], "hidden"],
            ]),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "partial" });
      });
    });

    describe("category", () => {
      it("returns 'visible' when all elements are displayed", async () => {
        const categoryId = "0x2";
        const elements = ["0x10", "0x20"];
        const node = createCategoryNode(undefined, categoryId);
        const queryProvider = createFakeQueryProvider({
          categoryElements: new Map([[categoryId, elements]]),
        });
        const handler = new OverridableVisibilityStateHandler({
          queryProvider,
          overrides: {
            elements: new Map(elements.map((x) => [x, "visible"])),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "visible" });
      });

      it("returns 'hidden' when all elements are hidden", async () => {
        const categoryId = "0x2";
        const elements = ["0x10", "0x20"];
        const node = createCategoryNode(undefined, categoryId);
        const queryProvider = createFakeQueryProvider({
          categoryElements: new Map([[categoryId, elements]]),
        });
        const handler = new OverridableVisibilityStateHandler({
          queryProvider,
          overrides: {
            elements: new Map(elements.map((x) => [x, "hidden"])),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "hidden" });
      });

      it("returns 'partial' when at least one element is displayed and at least one element is hidden", async () => {
        const categoryId = "0x2";
        const elements = ["0x10", "0x20"];
        const node = createCategoryNode(undefined, categoryId);
        const queryProvider = createFakeQueryProvider({
          categoryElements: new Map([[categoryId, elements]]),
        });
        const handler = new OverridableVisibilityStateHandler({
          queryProvider,
          overrides: {
            elements: new Map([
              [elements[0], "visible"],
              [elements[1], "hidden"],
            ]),
          },
        });
        const result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "partial" });
      });

      it("if has no elements, returns category viewport visibility status", async () => {
        const categoryId = "0x2";
        const node = createCategoryNode(undefined, categoryId);
        const viewport = createFakeSinonViewport({
          view: {
            isSpatialView: sinon.fake.returns(true),
            viewsCategory: sinon.fake.returns(true),
          },
        });
        const handler = new OverridableVisibilityStateHandler({ viewport });

        let result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "visible" });
        expect(viewport.view.viewsCategory).to.be.calledOnce;

        viewport.view.viewsCategory = sinon.fake.returns(false);
        result = await firstValueFrom(handler.getVisibilityStatus(node));
        expect(result).to.include({ state: "hidden" });
        expect(viewport.view.viewsCategory).to.be.calledOnce;
      });
    });

    describe("element", () => {
      it("returns 'visible' when all child elements are displayed", async () => {
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

      it("returns 'hidden' when all child elements are hidden", async () => {
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

      it("returns 'partial' when at least one element is displayed and at least one element is hidden", async () => {
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
        it("returns 'visible' if present in the always drawn list", async () => {
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

        it("returns 'hidden' if present in the never drawn list", async () => {
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

        it("returns 'hidden' if other elements are present in the always drawn list and exclusive mode is enabled", async () => {
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

        it("returns 'visible' when not present in always/never drawn sets", async () => {
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

        it("returns 'visible' when always/never drawn sets are undefined", async () => {
          const elementId = "0x1";
          const node = createElementNode(undefined, undefined, false, elementId);
          const handler = new OverridableVisibilityStateHandler();
          const result = await firstValueFrom(handler.getVisibilityStatus(node));
          expect(result).to.include({ state: "visible" });
        });
      });
    });
  });
});

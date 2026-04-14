/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { BeEvent, Id64 } from "@itwin/core-bentley";
import { type IModelConnection } from "@itwin/core-frontend";
import { BufferingViewport } from "../../../../tree-widget-react/components/trees/common/internal/BufferingViewport.js";

import type { Id64String } from "@itwin/core-bentley";
import type { PerModelCategoryOverride, TreeWidgetViewport } from "../../../../tree-widget-react/components/trees/common/TreeWidgetViewport.js";

function createMockViewport(props?: {
  models?: Map<Id64String, boolean>;
  categories?: Map<Id64String, boolean>;
  subCategories?: Map<Id64String, boolean>;
  alwaysDrawn?: Set<Id64String>;
  neverDrawn?: Set<Id64String>;
  isAlwaysDrawnExclusive?: boolean;
  perModelCategoryOverrides?: Map<Id64String, Map<Id64String, PerModelCategoryOverride>>;
}): TreeWidgetViewport {
  const models = props?.models ?? new Map<Id64String, boolean>();
  const categories = props?.categories ?? new Map<Id64String, boolean>();
  const subCategories = props?.subCategories ?? new Map<Id64String, boolean>();
  let alwaysDrawn: Set<Id64String> | undefined = props?.alwaysDrawn;
  let neverDrawn: Set<Id64String> | undefined = props?.neverDrawn;
  let isExclusive = props?.isAlwaysDrawnExclusive ?? false;
  const overrides = props?.perModelCategoryOverrides ?? new Map<Id64String, Map<Id64String, PerModelCategoryOverride>>();

  return {
    viewType: "3d",
    iModel: {} as IModelConnection,
    viewsModel: (modelId) => models.get(modelId) ?? false,
    changeModelDisplay: ({ modelIds, display }) => {
      for (const id of Id64.iterable(modelIds)) {
        models.set(id, display);
      }
    },
    viewsCategory: (categoryId) => categories.get(categoryId) ?? false,
    changeCategoryDisplay: ({ categoryIds, display }) => {
      for (const id of Id64.iterable(categoryIds)) {
        categories.set(id, display);
      }
    },
    viewsSubCategory: (subCategoryId) => subCategories.get(subCategoryId) ?? false,
    changeSubCategoryDisplay: ({ subCategoryId, display }) => {
      subCategories.set(subCategoryId, display);
    },
    get alwaysDrawn() {
      return alwaysDrawn;
    },
    setAlwaysDrawn: ({ elementIds, exclusive }) => {
      alwaysDrawn = elementIds;
      isExclusive = !!exclusive;
    },
    clearAlwaysDrawn: () => {
      alwaysDrawn = undefined;
      isExclusive = false;
    },
    get neverDrawn() {
      return neverDrawn;
    },
    setNeverDrawn: ({ elementIds }) => {
      neverDrawn = elementIds;
    },
    clearNeverDrawn: () => {
      neverDrawn = undefined;
    },
    get isAlwaysDrawnExclusive() {
      return isExclusive;
    },
    get perModelCategoryOverrides(): Iterable<{ modelId: Id64String; categoryId: Id64String; visible: boolean }> {
      const result: Array<{ modelId: Id64String; categoryId: Id64String; visible: boolean }> = [];
      for (const [modelId, categoryMap] of overrides) {
        for (const [categoryId, override] of categoryMap) {
          if (override !== "none") {
            result.push({ modelId, categoryId, visible: override === "show" });
          }
        }
      }
      return result;
    },
    setPerModelCategoryOverride: ({ modelIds, categoryIds, override }) => {
      for (const modelId of Id64.iterable(modelIds)) {
        for (const categoryId of Id64.iterable(categoryIds)) {
          if (!overrides.has(modelId)) {
            overrides.set(modelId, new Map<Id64String, PerModelCategoryOverride>());
          }
          overrides.get(modelId)!.set(categoryId, override);
        }
      }
    },
    getPerModelCategoryOverride: ({ modelId, categoryId }) => {
      return overrides.get(modelId)?.get(categoryId) ?? "none";
    },
    clearPerModelCategoryOverrides: (clearProps) => {
      if (clearProps?.modelIds !== undefined) {
        for (const modelId of Id64.iterable(clearProps.modelIds)) {
          overrides.delete(modelId);
        }
      } else {
        overrides.clear();
      }
    },
    onAlwaysDrawnChanged: new BeEvent<() => void>(),
    onNeverDrawnChanged: new BeEvent<() => void>(),
    onDisplayStyleChanged: new BeEvent<() => void>(),
    onDisplayedModelsChanged: new BeEvent<() => void>(),
    onDisplayedCategoriesChanged: new BeEvent<() => void>(),
    onPerModelCategoriesOverridesChanged: new BeEvent<() => void>(),
  };
}

describe("BufferingViewport", () => {
  describe("models", () => {
    [
      {
        describeName: "models",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.viewsModel(id ?? "0x1"),
        changeDisplay: (vp: BufferingViewport) => vp.changeModelDisplay({ modelIds: "0x1", display: false }),
        getViewport: () => createMockViewport({ models: new Map([["0x1", true]]) }),
      },
      {
        describeName: "categories",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.viewsCategory(id ?? "0x1"),
        changeDisplay: (vp: BufferingViewport) => vp.changeCategoryDisplay({ categoryIds: "0x1", display: false }),
        getViewport: () => createMockViewport({ categories: new Map([["0x1", true]]) }),
      },
      {
        describeName: "sub-categories",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.viewsSubCategory(id ?? "0x1"),
        changeDisplay: (vp: BufferingViewport) => vp.changeSubCategoryDisplay({ subCategoryId: "0x1", display: false }),
        getViewport: () => createMockViewport({ subCategories: new Map([["0x1", true]]) }),
      },
      {
        describeName: "always drawn",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.alwaysDrawn?.has(id ?? "0x1") ?? false,
        changeDisplay: (vp: BufferingViewport) => vp.setAlwaysDrawn({ elementIds: new Set(["0x2"]) }),
        getViewport: () => createMockViewport({ alwaysDrawn: new Set(["0x1"]) }),
      },
      {
        describeName: "always drawn exclusive",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.alwaysDrawn?.has(id ?? "0x1") && vp.isAlwaysDrawnExclusive,
        changeDisplay: (vp: BufferingViewport) => vp.setAlwaysDrawn({ elementIds: new Set(["0x1"]), exclusive: false }),
        getViewport: () => createMockViewport({ alwaysDrawn: new Set(["0x1"]), isAlwaysDrawnExclusive: true }),
      },
      {
        describeName: "never drawn",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.neverDrawn?.has(id ?? "0x1") ?? false,
        changeDisplay: (vp: BufferingViewport) => vp.setNeverDrawn({ elementIds: new Set(["0x2"]) }),
        getViewport: () => createMockViewport({ neverDrawn: new Set(["0x1"]) }),
      },
    ].forEach(({ describeName, getDisplay, changeDisplay, getViewport }) => {
      describe(describeName, () => {
        it("returns real viewports result when change function has not been called", () => {
          const viewport = getViewport();
          const bufferingViewport = new BufferingViewport(viewport);
          expect(getDisplay(bufferingViewport)).toBe(true);
          expect(getDisplay(viewport)).toBe(true);
          expect(getDisplay(bufferingViewport, "0x2")).toBe(false);
          expect(getDisplay(viewport, "0x2")).toBe(false);
        });

        it("returns adjusted values when change function has been called", () => {
          const viewport = getViewport();
          const bufferingViewport = new BufferingViewport(viewport);
          changeDisplay(bufferingViewport);
          expect(getDisplay(viewport)).toBe(true);
          expect(getDisplay(bufferingViewport)).toBe(false);
        });

        it("adjusts real viewport when commit is called", () => {
          const viewport = getViewport();
          const bufferingViewport = new BufferingViewport(viewport);
          changeDisplay(bufferingViewport);
          bufferingViewport.commit();
          expect(getDisplay(viewport)).toBe(false);
          expect(getDisplay(bufferingViewport)).toBe(false);
        });

        it("discards changes when discard is called", () => {
          const viewport = getViewport();
          const bufferingViewport = new BufferingViewport(viewport);
          changeDisplay(bufferingViewport);
          bufferingViewport.discard();
          expect(getDisplay(viewport)).toBe(true);
          expect(getDisplay(bufferingViewport)).toBe(true);
        });
      });
    });
  });

  describe("per-model category overrides", () => {
    it("returns real viewports result when change function has not been called", () => {
      const viewport = createMockViewport({ perModelCategoryOverrides: new Map([["0x1", new Map([["0x2", "show"]])]]) });
      const bufferingViewport = new BufferingViewport(viewport);

      for (const { modelId, categoryId, visible } of viewport.perModelCategoryOverrides) {
        expect(modelId).toBe("0x1");
        expect(categoryId).toBe("0x2");
        expect(visible).toBe(true);
      }
      for (const { modelId, categoryId, visible } of bufferingViewport.perModelCategoryOverrides) {
        expect(modelId).toBe("0x1");
        expect(categoryId).toBe("0x2");
        expect(visible).toBe(true);
      }
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("show");
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("show");
    });

    it("returns adjusted values when setPerModelCategoryOverride has been called", () => {
      const viewport = createMockViewport({ perModelCategoryOverrides: new Map([["0x1", new Map([["0x2", "show"]])]]) });
      const bufferingViewport = new BufferingViewport(viewport);
      bufferingViewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x2", override: "hide" });
      for (const { modelId, categoryId, visible } of viewport.perModelCategoryOverrides) {
        expect(modelId).toBe("0x1");
        expect(categoryId).toBe("0x2");
        expect(visible).toBe(true);
      }
      for (const { modelId, categoryId, visible } of bufferingViewport.perModelCategoryOverrides) {
        expect(modelId).toBe("0x1");
        expect(categoryId).toBe("0x2");
        expect(visible).toBe(false);
      }
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("hide");
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("show");
    });

    it("clears overrides when clearPerModelCategoryOverrides is called", () => {
      const viewport = createMockViewport({
        perModelCategoryOverrides: new Map([
          ["0x1", new Map([["0x2", "show" as PerModelCategoryOverride]])],
          ["0x3", new Map([["0x4", "hide" as PerModelCategoryOverride]])],
        ]),
      });
      const bufferingViewport = new BufferingViewport(viewport);
      bufferingViewport.clearPerModelCategoryOverrides();
      bufferingViewport.setPerModelCategoryOverride({ modelIds: "0x5", categoryIds: "0x6", override: "show" });
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("none");
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x3", categoryId: "0x4" })).toBe("none");
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x5", categoryId: "0x6" })).toBe("show");
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("show");
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x3", categoryId: "0x4" })).toBe("hide");
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x5", categoryId: "0x6" })).toBe("none");
    });
    it("clears overrides for specified models when clearPerModelCategoryOverrides is called", () => {
      const viewport = createMockViewport({
        perModelCategoryOverrides: new Map([
          ["0x1", new Map([["0x2", "show" as PerModelCategoryOverride]])],
          ["0x3", new Map([["0x4", "hide" as PerModelCategoryOverride]])],
        ]),
      });
      const bufferingViewport = new BufferingViewport(viewport);
      bufferingViewport.clearPerModelCategoryOverrides({ modelIds: "0x1" });
      bufferingViewport.setPerModelCategoryOverride({ modelIds: "0x5", categoryIds: "0x6", override: "show" });
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("none");
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x3", categoryId: "0x4" })).toBe("hide");
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x5", categoryId: "0x6" })).toBe("show");
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("show");
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x3", categoryId: "0x4" })).toBe("hide");
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x5", categoryId: "0x6" })).toBe("none");
    });

    it("adjusts state correctly when multiple changes are made in sequence", () => {
      const viewport = createMockViewport({
        perModelCategoryOverrides: new Map([
          [
            "0x1",
            new Map([
              ["0x2", "show" as PerModelCategoryOverride],
              ["0x3", "hide" as PerModelCategoryOverride],
            ]),
          ],
          ["0x4", new Map([["0x5", "show" as PerModelCategoryOverride]])],
        ]),
      });
      const bufferingViewport = new BufferingViewport(viewport);

      // 1. Clear all overrides
      bufferingViewport.clearPerModelCategoryOverrides();
      // 2. Set a new override for the same model but only one category
      bufferingViewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x2", override: "hide" });
      // 3. Clear overrides for a different model
      bufferingViewport.clearPerModelCategoryOverrides({ modelIds: "0x4" });

      // changed override in step 2 should be preserved
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("hide");
      // 0x1/0x3 was cleared in step 1 and never re-set — must be "none", not the real viewport's "hide"
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x3" })).toBe("none");
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x4", categoryId: "0x5" })).toBe("none");

      // Also verify the iterator doesn't yield the leaked override
      const iteratedOverrides = [...bufferingViewport.perModelCategoryOverrides];
      expect(iteratedOverrides).toEqual([{ modelId: "0x1", categoryId: "0x2", visible: false }]);
    });

    it("adjusts real viewport when commit is called", () => {
      const viewport = createMockViewport({
        perModelCategoryOverrides: new Map([
          ["0x1", new Map([["0x2", "show" as PerModelCategoryOverride]])],
          ["0x3", new Map([["0x4", "hide" as PerModelCategoryOverride]])],
        ]),
      });
      const bufferingViewport = new BufferingViewport(viewport);
      bufferingViewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x2", override: "hide" });
      bufferingViewport.clearPerModelCategoryOverrides({ modelIds: "0x3" });
      bufferingViewport.commit();
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("hide");
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x3", categoryId: "0x4" })).toBe("none");
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("hide");
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x3", categoryId: "0x4" })).toBe("none");
    });
    it("discards changes when discard is called", () => {
      const viewport = createMockViewport({
        perModelCategoryOverrides: new Map([
          ["0x1", new Map([["0x2", "show" as PerModelCategoryOverride]])],
          ["0x3", new Map([["0x4", "hide" as PerModelCategoryOverride]])],
        ]),
      });
      const bufferingViewport = new BufferingViewport(viewport);
      bufferingViewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x2", override: "hide" });
      bufferingViewport.clearPerModelCategoryOverrides({ modelIds: "0x3" });
      bufferingViewport.discard();
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("show");
      expect(viewport.getPerModelCategoryOverride({ modelId: "0x3", categoryId: "0x4" })).toBe("hide");
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x1", categoryId: "0x2" })).toBe("show");
      expect(bufferingViewport.getPerModelCategoryOverride({ modelId: "0x3", categoryId: "0x4" })).toBe("hide");
    });
  });
});

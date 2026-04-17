/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { BufferingViewport } from "../../../../tree-widget-react/components/trees/common/internal/BufferingViewport.js";
import { createTreeWidgetTestingViewport } from "../../TreeUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "../../../../tree-widget-react/components/trees/common/TreeWidgetViewport.js";

describe("BufferingViewport", () => {
  describe("models", () => {
    [
      {
        describeName: "models",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.viewsModel(id ?? "0x1"),
        changeDisplay: (vp: BufferingViewport) => vp.changeModelDisplay({ modelIds: "0x1", display: false }),
        getViewport: () => {
          const vp = createTreeWidgetTestingViewport({ iModel: {} as IModelConnection, viewType: "3d", visibleByDefault: false });
          vp.changeModelDisplay({ modelIds: "0x1", display: true });
          return vp;
        },
      },
      {
        describeName: "categories",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.viewsCategory(id ?? "0x1"),
        changeDisplay: (vp: BufferingViewport) => vp.changeCategoryDisplay({ categoryIds: "0x1", display: false }),
        getViewport: () => {
          const vp = createTreeWidgetTestingViewport({ iModel: {} as IModelConnection, viewType: "3d", visibleByDefault: false });
          vp.changeCategoryDisplay({ categoryIds: "0x1", display: true });
          return vp;
        },
      },
      {
        describeName: "sub-categories",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.viewsSubCategory(id ?? "0x1"),
        changeDisplay: (vp: BufferingViewport) => vp.changeSubCategoryDisplay({ subCategoryId: "0x1", display: false }),
        getViewport: () => {
          const vp = createTreeWidgetTestingViewport({
            iModel: {} as IModelConnection,
            viewType: "3d",
            visibleByDefault: false,
            subCategoriesOfCategories: [{ categoryId: "0x100", subCategories: "0x1" }],
          });
          vp.changeSubCategoryDisplay({ subCategoryId: "0x1", display: true });
          return vp;
        },
      },
      {
        describeName: "always drawn",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.alwaysDrawn?.has(id ?? "0x1") ?? false,
        changeDisplay: (vp: BufferingViewport) => vp.setAlwaysDrawn({ elementIds: new Set(["0x2"]) }),
        getViewport: () => {
          const vp = createTreeWidgetTestingViewport({
            iModel: {} as IModelConnection,
            viewType: "3d",
            visibleByDefault: false,
            subCategoriesOfCategories: [{ categoryId: "0x100", subCategories: "0x1" }],
          });
          vp.setAlwaysDrawn({ elementIds: new Set(["0x1"]) });
          return vp;
        },
      },
      {
        describeName: "always drawn exclusive",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.alwaysDrawn?.has(id ?? "0x1") && vp.isAlwaysDrawnExclusive,
        changeDisplay: (vp: BufferingViewport) => vp.setAlwaysDrawn({ elementIds: new Set(["0x1"]), exclusive: false }),
        getViewport: () => {
          const vp = createTreeWidgetTestingViewport({
            iModel: {} as IModelConnection,
            viewType: "3d",
            visibleByDefault: false,
            subCategoriesOfCategories: [{ categoryId: "0x100", subCategories: "0x1" }],
          });
          vp.setAlwaysDrawn({ elementIds: new Set(["0x1"]), exclusive: true });
          return vp;
        },
      },
      {
        describeName: "never drawn",
        getDisplay: (vp: TreeWidgetViewport, id?: string) => vp.neverDrawn?.has(id ?? "0x1") ?? false,
        changeDisplay: (vp: BufferingViewport) => vp.setNeverDrawn({ elementIds: new Set(["0x2"]) }),
        getViewport: () => {
          const vp = createTreeWidgetTestingViewport({
            iModel: {} as IModelConnection,
            viewType: "3d",
            visibleByDefault: false,
            subCategoriesOfCategories: [{ categoryId: "0x100", subCategories: "0x1" }],
          });
          vp.setNeverDrawn({ elementIds: new Set(["0x1"]) });
          return vp;
        },
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
      const viewport = createTreeWidgetTestingViewport({ iModel: {} as IModelConnection, viewType: "3d", visibleByDefault: false });
      viewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x2", override: "show" });
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
      const viewport = createTreeWidgetTestingViewport({ iModel: {} as IModelConnection, viewType: "3d", visibleByDefault: false });
      viewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x2", override: "show" });
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
      const viewport = createTreeWidgetTestingViewport({ iModel: {} as IModelConnection, viewType: "3d", visibleByDefault: false });
      viewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x2", override: "show" });
      viewport.setPerModelCategoryOverride({ modelIds: "0x3", categoryIds: "0x4", override: "hide" });
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
      const viewport = createTreeWidgetTestingViewport({ iModel: {} as IModelConnection, viewType: "3d", visibleByDefault: false });
      viewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x2", override: "show" });
      viewport.setPerModelCategoryOverride({ modelIds: "0x3", categoryIds: "0x4", override: "hide" });
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
      const viewport = createTreeWidgetTestingViewport({ iModel: {} as IModelConnection, viewType: "3d", visibleByDefault: false });
      viewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x2", override: "show" });
      viewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x3", override: "hide" });
      viewport.setPerModelCategoryOverride({ modelIds: "0x4", categoryIds: "0x5", override: "show" });
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
      const viewport = createTreeWidgetTestingViewport({ iModel: {} as IModelConnection, viewType: "3d", visibleByDefault: false });
      viewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x2", override: "show" });
      viewport.setPerModelCategoryOverride({ modelIds: "0x3", categoryIds: "0x4", override: "hide" });
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
      const viewport = createTreeWidgetTestingViewport({ iModel: {} as IModelConnection, viewType: "3d", visibleByDefault: false });
      viewport.setPerModelCategoryOverride({ modelIds: "0x1", categoryIds: "0x2", override: "show" });
      viewport.setPerModelCategoryOverride({ modelIds: "0x3", categoryIds: "0x4", override: "hide" });
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

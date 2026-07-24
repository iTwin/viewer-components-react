/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SubCategoryAppearance } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { enableCategoryDisplay } from "../../../../tree-widget-react/components/trees/common/internal/VisibilityUtils.js";
import { TestUtils } from "../../../TestUtils.js";
import { createFakeViewport } from "../../Common.js";

import type { TreeWidgetTestingViewport } from "../../TreeUtils.js";

describe("VisibilityUtils", () => {
  beforeAll(async () => {
    await NoRenderApp.startup();
    await TestUtils.initialize();
  });

  afterAll(async () => {
    TestUtils.terminate();
    await IModelApp.shutdown();
  });

  const categoryId = "CategoryId";
  const subCategoryId = "SubCategoryId";
  const categoriesInfo = new Map([
    [
      categoryId,
      {
        id: categoryId,
        subCategories: new Map([
          [
            subCategoryId,
            {
              id: subCategoryId,
              categoryId,
              appearance: new SubCategoryAppearance(),
            },
          ],
        ]),
      },
    ],
  ]);
  let viewport: TreeWidgetTestingViewport;

  beforeEach(() => {
    viewport = createFakeViewport({
      queryHandler: () => [{ id: categoryId }],
      getCategoryInfo: async () => categoriesInfo,
      viewType: "3d",
    });
  });

  describe("enableCategoryDisplay", () => {
    it("enables category", async () => {
      await enableCategoryDisplay(viewport, categoryId, true, false);
      expect(viewport.changeCategoryDisplay).toHaveBeenCalledWith({ categoryIds: [categoryId], display: true, enableAllSubCategories: false });
    });

    it("disables category", async () => {
      await enableCategoryDisplay(viewport, categoryId, false, false);
      expect(viewport.changeCategoryDisplay).toHaveBeenCalledWith({ categoryIds: [categoryId], display: false, enableAllSubCategories: false });
    });

    it("disables category and subcategories", async () => {
      await enableCategoryDisplay(viewport, categoryId, false, true);
      expect(viewport.changeCategoryDisplay).toHaveBeenCalledWith({ categoryIds: [categoryId], display: false, enableAllSubCategories: true });
      expect(viewport.changeSubCategoryDisplay).toHaveBeenCalledWith({ subCategoryId, display: false });
    });

    it("removes overrides per model when enabling category", async () => {
      const overrides = [{ modelId: "ModelId", categoryId, visible: false }];
      viewport.perModelCategoryOverrides = overrides;
      await enableCategoryDisplay(viewport, categoryId, true, false);

      expect(viewport.changeCategoryDisplay).toHaveBeenCalledWith({ categoryIds: [categoryId], display: true, enableAllSubCategories: false });
      expect(viewport.setPerModelCategoryOverride).toHaveBeenCalledWith({
        modelIds: new Set(["ModelId"]),
        categoryIds: new Set([categoryId]),
        override: "none",
      });
    });
  });
});

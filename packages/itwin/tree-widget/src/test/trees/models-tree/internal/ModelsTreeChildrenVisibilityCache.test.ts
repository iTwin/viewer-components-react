/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EmptyLocalization } from "@itwin/core-common";
import { TreeWidget } from "../../../../tree-widget-react.js";
import { ElementsChildCategoriesVisibilityCache } from "../../../../tree-widget-react/components/trees/common/internal/ElementsChildCategoriesVisibilityCache.js";
import { createVisibilityStatus } from "../../../../tree-widget-react/components/trees/common/internal/Tooltip.js";
import { createVisibilityChangeEventListener } from "../../../../tree-widget-react/components/trees/common/internal/VisibilityChangeEventListener.js";

import type { Viewport } from "@itwin/core-frontend";

describe("ElementsChildCategoriesVisibilityCache", () => {
  const modelId = "0x1";
  const parentElementId = "0x10";
  const firstChildCategoryId = "0x3";
  const otherChildCategoryId = "0x4";
  const listener = createVisibilityChangeEventListener({ viewport: {} as Viewport, listeners: {} });

  function createChildrenVisibilityCache() {
    return new ElementsChildCategoriesVisibilityCache(listener);
  }

  before(async () => {
    await TreeWidget.initialize(new EmptyLocalization());
  });

  after(() => {
    TreeWidget.terminate();
  });

  it("caches visibility and disposes", async () => {
    using cache = createChildrenVisibilityCache();
    expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.undefined;
    expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.undefined;

    const firstCategoryVisibilityStatus = createVisibilityStatus("visible");
    const otherCategoryVisibilityStatus = createVisibilityStatus("hidden");
    cache.setCategoryCachedVisibility({ modelId, categoryId: firstChildCategoryId, parentElementId, visibilityStatus: firstCategoryVisibilityStatus });
    cache.setCategoryCachedVisibility({ modelId, categoryId: otherChildCategoryId, parentElementId, visibilityStatus: otherCategoryVisibilityStatus });

    expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.eq(
      firstCategoryVisibilityStatus,
    );
    expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.eq(
      otherCategoryVisibilityStatus,
    );

    cache[Symbol.dispose]();

    expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.undefined;
    expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.undefined;
  });

  it("caches visibility and clears when event is raised", async () => {
    using cache = createChildrenVisibilityCache();
    expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.undefined;
    expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.undefined;

    const firstCategoryVisibilityStatus = createVisibilityStatus("visible");
    const otherCategoryVisibilityStatus = createVisibilityStatus("hidden");
    cache.setCategoryCachedVisibility({ modelId, categoryId: firstChildCategoryId, parentElementId, visibilityStatus: firstCategoryVisibilityStatus });
    cache.setCategoryCachedVisibility({ modelId, categoryId: otherChildCategoryId, parentElementId, visibilityStatus: otherCategoryVisibilityStatus });

    expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.eq(
      firstCategoryVisibilityStatus,
    );
    expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.eq(
      otherCategoryVisibilityStatus,
    );

    listener.onVisibilityChange.raiseEvent();

    expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.undefined;
    expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.undefined;
    cache[Symbol.dispose]();
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EmptyLocalization } from "@itwin/core-common";
import { TreeWidget } from "../../../../tree-widget-react.js";
import { createVisibilityStatus } from "../../../../tree-widget-react/components/trees/common/Tooltip.js";
import { ModelsTreeChildrenVisibilityCache } from "../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeChildrenVisibilityCache.js";

import type { Id64String } from "@itwin/core-bentley";
import type { ParentElementMap } from "../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";

describe("ModelsTreeChildrenVisibilityCache", () => {
  const modelId = "0x1";
  const categoryId = "0x2";
  const parentElementId = "0x10";
  const firstChildCategoryId = "0x3";
  const otherChildCategoryId = "0x4";
  const firstChildElementId = "0x11";
  const secondChildElementId = "0x12";
  const otherChildElementId = "0x13";
  const modelParentMap: ParentElementMap = new Map([
    [
      parentElementId,
      new Map([
        [firstChildCategoryId, new Set([firstChildElementId, secondChildElementId])],
        [otherChildCategoryId, new Set(otherChildElementId)],
      ]),
    ],
    [undefined, new Map([[categoryId, new Set([parentElementId])]])],
  ]);

  function createChildrenVisibilityCache() {
    return new ModelsTreeChildrenVisibilityCache();
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

  const testCases: Array<{
    name: string;
    nodeIdsToChange: Set<Id64String>;
    only?: boolean;
    firstChildVisibilityCleared?: boolean;
    secondChildVisibilityCleared?: boolean;
    firstCateogoryVisibilityCleared?: boolean;
    otherCateogoryVisibilityCleared?: boolean;
    otherChildVisibilityCleared?: boolean;
    viewsModelChange?: boolean;
    viewsCategoryChange?: boolean;
    perModelCategoryVisibility?: "visible" | "hidden";
    alwaysDrawChange?: boolean;
    neverDrawChange?: boolean;
  }> = [
    {
      name: "clears related nodes visibility when viewport changes model visibility",
      nodeIdsToChange: new Set([modelId]),
      viewsModelChange: true,
      firstCateogoryVisibilityCleared: true,
      firstChildVisibilityCleared: true,
      secondChildVisibilityCleared: true,
      otherCateogoryVisibilityCleared: true,
      otherChildVisibilityCleared: true,
    },
    {
      name: "clears related nodes visibility when viewport does not view category",
      nodeIdsToChange: new Set([firstChildCategoryId]),
      viewsCategoryChange: true,
      firstCateogoryVisibilityCleared: true,
      firstChildVisibilityCleared: true,
      secondChildVisibilityCleared: true,
    },
    {
      name: "clears related nodes visibility when perModelCategoryVisibility changes from 'hidden'",
      nodeIdsToChange: new Set([firstChildCategoryId]),
      perModelCategoryVisibility: "hidden",
      firstCateogoryVisibilityCleared: true,
      firstChildVisibilityCleared: true,
      secondChildVisibilityCleared: true,
    },
    {
      name: "clears related nodes visibility when perModelCategoryVisibility changes from 'visible'",
      nodeIdsToChange: new Set([firstChildCategoryId]),
      perModelCategoryVisibility: "visible",
      firstCateogoryVisibilityCleared: true,
      firstChildVisibilityCleared: true,
      secondChildVisibilityCleared: true,
    },
    {
      name: "clears related nodes visibility when alwaysDrawn changes",
      nodeIdsToChange: new Set([firstChildElementId]),
      alwaysDrawChange: true,
      firstCateogoryVisibilityCleared: true,
      firstChildVisibilityCleared: true,
    },
    {
      name: "clears related nodes visibility when neverDrawn changes",
      nodeIdsToChange: new Set([firstChildElementId]),
      neverDrawChange: true,
      firstCateogoryVisibilityCleared: true,
      firstChildVisibilityCleared: true,
    },
  ];

  testCases.forEach((props) => {
    (props.only ? it.only : it)(props.name, async () => {
      using cache = createChildrenVisibilityCache();

      expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.undefined;
      expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.undefined;

      const firstCategoryVisibilityStatus = createVisibilityStatus("partial");
      const otherCategoryVisibilityStatus = createVisibilityStatus("visible");

      cache.setCategoryCachedVisibility({ modelId, categoryId: firstChildCategoryId, parentElementId, visibilityStatus: firstCategoryVisibilityStatus });
      cache.setCategoryCachedVisibility({ modelId, categoryId: otherChildCategoryId, parentElementId, visibilityStatus: otherCategoryVisibilityStatus });

      expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.eq(
        firstCategoryVisibilityStatus,
      );
      expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.eq(
        otherCategoryVisibilityStatus,
      );

      props.nodeIdsToChange.clear();
      await cache.clearChangedValues();

      expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.eq(
        props.firstCateogoryVisibilityCleared ? undefined : firstCategoryVisibilityStatus,
      );
      expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentElementIds: [parentElementId], modelId })).to.be.eq(
        props.otherCateogoryVisibilityCleared ? undefined : otherCategoryVisibilityStatus,
      );
    });
  });
});

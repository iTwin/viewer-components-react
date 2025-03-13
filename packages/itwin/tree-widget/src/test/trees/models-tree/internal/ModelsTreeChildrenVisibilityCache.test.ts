/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EmptyLocalization } from "@itwin/core-common";
import { TreeWidget } from "../../../../tree-widget-react.js";
import { createVisibilityStatus } from "../../../../tree-widget-react/components/trees/common/Tooltip.js";
import { ModelsTreeChildrenVisibilityCache } from "../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeChildrenVisibilityCache.js";
import { createFakeSinonViewport } from "../../Common.js";
import { createFakeIdsCache } from "../Utils.js";

import type { Id64String } from "@itwin/core-bentley";
import type { CategorySelectorState, GeometricModelState, PerModelCategoryVisibility, ViewState } from "@itwin/core-frontend";
import type { ElementId } from "../../../../tree-widget-react/components/trees/common/internal/Types.js";
import type { ModelParentMap } from "../../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";

describe("ModelsTreeChildrenVisibilityCache", () => {
  const modelId = "0x1";
  const categoryId = "0x2";
  const parentId = "0x10";
  const firstChildCategoryId = "0x3";
  const otherChildCategoryId = "0x4";
  const firstChildElementId = "0x11";
  const secondChildElementId = "0x12";
  const otherChildElementId = "0x13";
  const modelParentMap: ModelParentMap = new Map([
    [
      parentId,
      {
        categoryChildrenMap: new Map([
          [
            firstChildCategoryId,
            [
              { childElementId: firstChildElementId, hasChildren: false },
              { childElementId: secondChildElementId, hasChildren: false },
            ],
          ],
          [otherChildCategoryId, [{ childElementId: otherChildElementId, hasChildren: false }]],
        ]),
        hasParent: false,
        rootElementCategoryId: categoryId,
      },
    ],
  ]);

  function createChildrenVisibilityCache(props?: {
    view?: Partial<ViewState>;
    perModelCategoryVisibility?: Partial<PerModelCategoryVisibility.Overrides>;
    alwaysDrawn?: Set<ElementId>;
    neverDrawn?: Set<ElementId>;
  }) {
    const viewport = createFakeSinonViewport(props);

    const childrenInfo = new Map([[modelId, modelParentMap]]);
    const modelsTreeIdsCache = createFakeIdsCache({ childrenInfo });
    return new ModelsTreeChildrenVisibilityCache(modelsTreeIdsCache, viewport);
  }

  before(async () => {
    await TreeWidget.initialize(new EmptyLocalization());
  });

  after(() => {
    TreeWidget.terminate();
  });

  it("caches visibility and disposes", async () => {
    using cache = createChildrenVisibilityCache();
    expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentIds: [parentId], modelId })).to.be.undefined;
    expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentIds: [parentId], modelId })).to.be.undefined;
    expect(cache.getGeometricElementCachedVisibility({ elementId: firstChildElementId, parentIds: [parentId], modelId })).to.be.undefined;
    expect(cache.getGeometricElementCachedVisibility({ elementId: secondChildElementId, parentIds: [parentId], modelId })).to.be.undefined;
    expect(cache.getGeometricElementCachedVisibility({ elementId: otherChildElementId, parentIds: [parentId], modelId })).to.be.undefined;

    const firstCategoryVisibilityStatus = createVisibilityStatus("visible");
    const otherCategoryVisibilityStatus = createVisibilityStatus("hidden");
    const firstElementVisibilityStatus = createVisibilityStatus("partial");
    cache.setCategoryCachedVisibility({ modelId, categoryId: firstChildCategoryId, parentId, visibilityStatus: firstCategoryVisibilityStatus });
    cache.setCategoryCachedVisibility({ modelId, categoryId: otherChildCategoryId, parentId, visibilityStatus: otherCategoryVisibilityStatus });
    cache.setGeometricElementCachedVisibility({
      modelId,
      elementId: firstChildElementId,
      parentId,
      visibilityStatus: firstElementVisibilityStatus,
    });

    expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentIds: [parentId], modelId })).to.be.eq(firstCategoryVisibilityStatus);
    expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentIds: [parentId], modelId })).to.be.eq(otherCategoryVisibilityStatus);
    expect(cache.getGeometricElementCachedVisibility({ elementId: firstChildElementId, parentIds: [parentId], modelId })).to.be.eq(
      firstElementVisibilityStatus,
    );
    expect(cache.getGeometricElementCachedVisibility({ elementId: secondChildElementId, parentIds: [parentId], modelId })).to.be.undefined;
    expect(cache.getGeometricElementCachedVisibility({ elementId: otherChildElementId, parentIds: [parentId], modelId })).to.be.undefined;

    cache[Symbol.dispose]();

    expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentIds: [parentId], modelId })).to.be.undefined;
    expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentIds: [parentId], modelId })).to.be.undefined;
    expect(cache.getGeometricElementCachedVisibility({ elementId: firstChildElementId, parentIds: [parentId], modelId })).to.be.undefined;
    expect(cache.getGeometricElementCachedVisibility({ elementId: secondChildElementId, parentIds: [parentId], modelId })).to.be.undefined;
    expect(cache.getGeometricElementCachedVisibility({ elementId: otherChildElementId, parentIds: [parentId], modelId })).to.be.undefined;
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
      const view: Partial<ViewState> | undefined = props.viewsCategoryChange
        ? {
            categorySelector: {
              categories: props.nodeIdsToChange,
            } as CategorySelectorState,
          }
        : props.viewsModelChange
          ? {
              forEachModel: (func) => {
                func({ id: [...props.nodeIdsToChange][0] } as GeometricModelState);
              },
            }
          : undefined;
      const perModelCategoryVisibility: Partial<PerModelCategoryVisibility.Overrides> | undefined = props.perModelCategoryVisibility
        ? {
            *[Symbol.iterator]() {
              yield { modelId, categoryId: [...props.nodeIdsToChange.keys()][0], visible: props.perModelCategoryVisibility === "visible" ? true : false };
            },
          }
        : undefined;
      const alwaysDrawn: Set<ElementId> | undefined = props.alwaysDrawChange ? props.nodeIdsToChange : undefined;
      const neverDrawn: Set<ElementId> | undefined = props.neverDrawChange ? props.nodeIdsToChange : undefined;
      using cache = createChildrenVisibilityCache({ view, perModelCategoryVisibility, alwaysDrawn, neverDrawn });

      expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentIds: [parentId], modelId })).to.be.undefined;
      expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentIds: [parentId], modelId })).to.be.undefined;
      expect(cache.getGeometricElementCachedVisibility({ elementId: firstChildElementId, parentIds: [parentId], modelId })).to.be.undefined;
      expect(cache.getGeometricElementCachedVisibility({ elementId: secondChildElementId, parentIds: [parentId], modelId })).to.be.undefined;
      expect(cache.getGeometricElementCachedVisibility({ elementId: otherChildElementId, parentIds: [parentId], modelId })).to.be.undefined;

      const firstCategoryVisibilityStatus = createVisibilityStatus("partial");
      const otherCategoryVisibilityStatus = createVisibilityStatus("visible");
      const firstElementVisibilityStatus = createVisibilityStatus("visible");
      const secondElementVisibilityStatus = createVisibilityStatus("hidden");
      const otherElementVisibilityStatus = createVisibilityStatus("visible");

      cache.setCategoryCachedVisibility({ modelId, categoryId: firstChildCategoryId, parentId, visibilityStatus: firstCategoryVisibilityStatus });
      cache.setCategoryCachedVisibility({ modelId, categoryId: otherChildCategoryId, parentId, visibilityStatus: otherCategoryVisibilityStatus });
      cache.setGeometricElementCachedVisibility({
        modelId,
        elementId: firstChildElementId,
        parentId,
        visibilityStatus: firstElementVisibilityStatus,
      });
      cache.setGeometricElementCachedVisibility({
        modelId,
        elementId: secondChildElementId,
        parentId,
        visibilityStatus: secondElementVisibilityStatus,
      });
      cache.setGeometricElementCachedVisibility({
        modelId,
        elementId: otherChildElementId,
        parentId,
        visibilityStatus: otherElementVisibilityStatus,
      });

      expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentIds: [parentId], modelId })).to.be.eq(firstCategoryVisibilityStatus);
      expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentIds: [parentId], modelId })).to.be.eq(otherCategoryVisibilityStatus);
      expect(cache.getGeometricElementCachedVisibility({ elementId: firstChildElementId, parentIds: [parentId], modelId })).to.be.eq(
        firstElementVisibilityStatus,
      );
      expect(cache.getGeometricElementCachedVisibility({ elementId: secondChildElementId, parentIds: [parentId], modelId })).to.be.eq(
        secondElementVisibilityStatus,
      );
      expect(cache.getGeometricElementCachedVisibility({ elementId: otherChildElementId, parentIds: [parentId], modelId })).to.be.eq(
        otherElementVisibilityStatus,
      );

      props.nodeIdsToChange.clear();
      await cache.clearChangedValues();

      expect(cache.getCategoryCachedVisibility({ categoryId: firstChildCategoryId, parentIds: [parentId], modelId })).to.be.eq(
        props.firstCateogoryVisibilityCleared ? undefined : firstCategoryVisibilityStatus,
      );
      expect(cache.getCategoryCachedVisibility({ categoryId: otherChildCategoryId, parentIds: [parentId], modelId })).to.be.eq(
        props.otherCateogoryVisibilityCleared ? undefined : otherCategoryVisibilityStatus,
      );
      expect(cache.getGeometricElementCachedVisibility({ elementId: firstChildElementId, parentIds: [parentId], modelId })).to.be.eq(
        props.firstChildVisibilityCleared ? undefined : firstElementVisibilityStatus,
      );
      expect(cache.getGeometricElementCachedVisibility({ elementId: secondChildElementId, parentIds: [parentId], modelId })).to.be.eq(
        props.secondChildVisibilityCleared ? undefined : secondElementVisibilityStatus,
      );
      expect(cache.getGeometricElementCachedVisibility({ elementId: otherChildElementId, parentIds: [parentId], modelId })).to.be.eq(
        props.otherChildVisibilityCleared ? undefined : otherElementVisibilityStatus,
      );
    });
  });
});

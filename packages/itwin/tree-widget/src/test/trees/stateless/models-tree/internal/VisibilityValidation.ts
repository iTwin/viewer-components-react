/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { expand, from, mergeMap } from "rxjs";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { toVoidPromise } from "../../../../../components/trees/common/Rxjs";
import { ModelsTreeNode } from "../../../../../components/trees/stateless/models-tree/internal/ModelsTreeNode";

import type { Visibility } from "../../../../../components/trees/stateless/models-tree/internal/Tooltip";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyProvider } from "@itwin/presentation-hierarchies";
import type { ModelsTreeVisibilityHandler } from "../../../../../components/trees/stateless/models-tree/internal/ModelsTreeVisibilityHandler";

interface VisibilityExpectations {
  subject(id: string): Visibility;
  element(props: { modelId: Id64String; categoryId: Id64String; elementId: Id64String }): "visible" | "hidden";
  groupingNode(props: { modelId: Id64String; categoryId: Id64String; elementIds: Id64Array }): Visibility;
  category(props: { modelId: Id64String; categoryId: Id64String }):
    | Visibility
    | {
        tree: Visibility;
        categorySelector: boolean;
        perModelCategoryOverride: "show" | "hide" | "none";
      };
  model(modelId: Id64String):
    | Visibility
    | {
        tree: Visibility;
        modelSelector: boolean;
      };
}

export namespace VisibilityExpectations {
  export function all(visibility: "visible" | "hidden"): VisibilityExpectations {
    return {
      subject: () => visibility,
      model: () => visibility,
      category: () => visibility,
      groupingNode: () => visibility,
      element: () => visibility,
    };
  }
}

export interface ValidateNodeProps {
  handler: ModelsTreeVisibilityHandler;
  viewport: Viewport;
  visibilityExpectations: VisibilityExpectations;
}

export async function validateNodeVisibility({ node, handler, visibilityExpectations, viewport }: ValidateNodeProps & { node: HierarchyNode }) {
  const visibility = await handler.getVisibilityStatus(node);

  // modelId, categoryId, id are redefined at the bottom
  /* eslint-disable @typescript-eslint/no-shadow */

  if (HierarchyNode.isClassGroupingNode(node)) {
    assert(!!node.extendedData);
    const modelId = ModelsTreeNode.getModelId(node)!;
    const categoryId = ModelsTreeNode.getCategoryId(node)!;
    const elementIds = node.groupedInstanceKeys.map(({ id }) => id);
    const expected = visibilityExpectations.groupingNode({ modelId, categoryId, elementIds });
    expect(visibility.state).to.eq(expected, JSON.stringify({ className: node.key.className, ids: node.groupedInstanceKeys.map(({ id }) => id) }));
    return;
  }

  assert(HierarchyNode.isInstancesNode(node));
  const { id } = node.key.instanceKeys[0];

  if (ModelsTreeNode.isSubjectNode(node)) {
    expect(visibility.state).to.eq(visibilityExpectations.subject(id), `Subject ${id}`);
    return;
  }

  if (ModelsTreeNode.isModelNode(node)) {
    const expected = visibilityExpectations.model(id);
    if (typeof expected === "string") {
      expect(visibility.state).to.eq(expected, `Model ${id}`);
      return;
    }

    const { tree: handlerVisibility, modelSelector } = expected;
    expect(visibility.state).to.eq(handlerVisibility, `Model ${id}`);
    expect(viewport.viewsModel(id)).to.eq(modelSelector, `Model ${id}`);
    return;
  }

  if (ModelsTreeNode.isCategoryNode(node)) {
    const modelId = ModelsTreeNode.getModelId(node)!;
    const expected = visibilityExpectations.category({ modelId, categoryId: id });
    if (typeof expected === "string") {
      expect(visibility.state).to.eq(expected, JSON.stringify({ modelId, categoryId: id }));
      return;
    }

    const { tree: handlerVisibility, categorySelector, perModelCategoryOverride } = expected;
    expect(visibility.state).to.eq(handlerVisibility, JSON.stringify({ modelId, categoryId: id }));
    expect(viewport.view.viewsCategory(id)).to.eq(categorySelector, `Category selector for: ${JSON.stringify({ modelId, categoryId: id })}`);

    const ovr = viewport.perModelCategoryVisibility.getOverride(modelId, id);
    expect(overrideToString(ovr)).to.eq(perModelCategoryOverride, JSON.stringify({ modelId, categoryId: id }));
    return;
  }

  const modelId = ModelsTreeNode.getModelId(node)!;
  const categoryId = ModelsTreeNode.getCategoryId(node)!;
  const expected = visibilityExpectations.element({ modelId, categoryId, elementId: id });
  expect(visibility.state).to.eq(expected, JSON.stringify({ modelId, categoryId, elementId: id }));
}

export async function validateHierarchyVisibility({
  provider,
  ...props
}: Omit<ValidateNodeProps, "visibilityExpectations"> & {
  visibilityExpectations: VisibilityExpectations;
  provider: HierarchyProvider;
}) {
  await toVoidPromise(
    from(provider.getNodes({ parentNode: undefined })).pipe(
      expand((node) => provider.getNodes({ parentNode: node })),
      mergeMap(async (node) => validateNodeVisibility({ ...props, node })),
    ),
  );
}

export function overrideToString(ovr: PerModelCategoryVisibility.Override) {
  switch (ovr) {
    case PerModelCategoryVisibility.Override.None:
      return "none";
    case PerModelCategoryVisibility.Override.Show:
      return "show";
    case PerModelCategoryVisibility.Override.Hide:
      return "hide";
  }
}

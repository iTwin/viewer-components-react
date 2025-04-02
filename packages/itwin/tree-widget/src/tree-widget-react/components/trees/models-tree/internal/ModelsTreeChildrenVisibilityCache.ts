/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { VisibilityStatus } from "../../common/UseHierarchyVisibility.js";
import type { CategoryId, ElementId, ModelId, ParentId } from "../../common/internal/Types.js";

/**
 * Cache used for saving categories and elements whose parent in models tree is an element.
 * @internal
 */
export class ModelsTreeChildrenVisibilityCache implements Disposable {
  private _categoriesVisibilityStatus = new Map<ModelId, Map<ParentId, Map<CategoryId, VisibilityStatus>>>();

  public [Symbol.dispose]() {
    this._categoriesVisibilityStatus.clear();
  }

  public clearChangedValues() {
    this._categoriesVisibilityStatus.clear();
  }

  public setCategoryCachedVisibility({
    modelId,
    categoryId,
    parentElementId,
    visibilityStatus,
  }: {
    modelId: ModelId;
    categoryId: CategoryId;
    parentElementId: ElementId;
    visibilityStatus: VisibilityStatus;
  }) {
    let parentMap = this._categoriesVisibilityStatus.get(modelId);
    if (!parentMap) {
      parentMap = new Map();
      this._categoriesVisibilityStatus.set(modelId, parentMap);
    }

    let categoryMap = parentMap.get(parentElementId);
    if (!categoryMap) {
      categoryMap = new Map();
      parentMap.set(parentElementId, categoryMap);
    }

    return categoryMap.set(categoryId, visibilityStatus);
  }

  public getCategoryCachedVisibility({
    categoryId,
    parentElementIds,
    modelId,
  }: {
    categoryId: CategoryId;
    parentElementIds: Array<ElementId>;
    modelId: ModelId;
  }): VisibilityStatus | undefined {
    const parentMap = this._categoriesVisibilityStatus.get(modelId);
    if (parentMap === undefined) {
      return undefined;
    }

    for (const parentElementId of parentElementIds) {
      const result = parentMap?.get(parentElementId)?.get(categoryId);
      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  }
}

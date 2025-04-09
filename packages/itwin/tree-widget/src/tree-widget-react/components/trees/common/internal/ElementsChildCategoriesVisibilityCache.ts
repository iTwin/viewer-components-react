/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { VisibilityStatus } from "../UseHierarchyVisibility.js";
import type { CategoryId, ModelId, ParentId } from "./Types.js";
import type { IVisibilityChangeEventListener } from "./VisibilityChangeEventListener.js";

/**
 * Cache used for saving categories VisibilityStatus whose parent is an element.
 * @internal
 */
export class ElementsChildCategoriesVisibilityCache implements Disposable {
  private _categoriesVisibilityStatus = new Map<ModelId, Map<ParentId, Map<CategoryId, VisibilityStatus>>>();
  private _listener: () => void;
  constructor(private _visibilityChangeEventListener: IVisibilityChangeEventListener) {
    this._listener = this._visibilityChangeEventListener.onVisibilityChange.addListener(() => this.clearChangedValues());
  }

  public [Symbol.dispose]() {
    this._listener();
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
    modelId: Id64String;
    categoryId: Id64String;
    parentElementId: Id64String;
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
    categoryId: Id64String;
    parentElementIds: Id64Array;
    modelId: Id64String;
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

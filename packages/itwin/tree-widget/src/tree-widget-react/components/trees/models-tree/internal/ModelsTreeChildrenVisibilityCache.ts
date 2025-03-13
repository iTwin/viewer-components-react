/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { VisibilityStatus } from "../../common/UseHierarchyVisibility.js";
import type { ModelParentMap, ModelsTreeIdsCache } from "./ModelsTreeIdsCache.js";
import type { CategoryId, ElementId, ModelId, ParentId } from "../../common/internal/Types.js";

interface ViewportValues {
  models: Set<ModelId>;
  categories: Set<CategoryId>;
  overridenVisibleCategories: Set<CategoryId>;
  overridenHiddenCategories: Set<CategoryId>;
  neverDrawn: Set<ElementId>;
  alwaysDrawn: Set<ElementId>;
}

/**
 * Cache used for saving categories and elements whose parent in models tree is an element.
 * @internal
 */
export class ModelsTreeChildrenVisibilityCache implements Disposable {
  private _childElementsVisibilityStatus = new Map<ModelId, Map<ParentId, Map<ElementId, VisibilityStatus | "cleared">>>();
  private _categoriesVisibilityStatus = new Map<ModelId, Map<ParentId, Map<CategoryId, VisibilityStatus | "cleared">>>();
  private _viewportValues: ViewportValues;

  constructor(
    private _modelsTreeIdsCache: ModelsTreeIdsCache,
    private _viewport: Viewport,
  ) {
    this._viewportValues = getViewportValues(this._viewport);
  }

  public [Symbol.dispose]() {
    this._childElementsVisibilityStatus.clear();
    this._categoriesVisibilityStatus.clear();
  }

  public async clearChangedValues() {
    const newViewportValues = getViewportValues(this._viewport);
    const changedViewportValues = getChangedViewportValues(this._viewportValues, newViewportValues);
    this._viewportValues = newViewportValues;

    this.clearModelsCachedVisibility(changedViewportValues.changedModels);
    const arrayOfCategoriesAndElementsToClear: Array<{ categories: Set<CategoryId>; elements: Set<ElementId> }> = await Promise.all([
      ...[...changedViewportValues.changedCategories].map(async (changedCategory) => this.getCategoryRelatedNodes(changedCategory)),
      ...[...changedViewportValues.changedElements].map(async (changedElement) => this.getElementRelatedNodes(changedElement)),
    ]);

    const categoriesToClear = new Array(...changedViewportValues.changedCategories);
    const elementsToClear = new Array(...changedViewportValues.changedElements);
    for (const { categories, elements } of arrayOfCategoriesAndElementsToClear) {
      categoriesToClear.push(...categories);
      elementsToClear.push(...elements);
    }
    this.clearCategories(new Set(categoriesToClear));
    this.clearElements(new Set(elementsToClear));
  }

  public setGeometricElementCachedVisibility({
    modelId,
    elementId,
    parentId,
    visibilityStatus,
  }: {
    elementId: ElementId;
    modelId: ModelId;
    visibilityStatus: VisibilityStatus;
    parentId: ParentId;
  }) {
    let parentMap = this._childElementsVisibilityStatus.get(modelId);
    if (!parentMap) {
      parentMap = new Map();
      this._childElementsVisibilityStatus.set(modelId, parentMap);
    }
    let elementMap = parentMap.get(parentId);
    if (!elementMap) {
      elementMap = new Map();
      parentMap.set(parentId, elementMap);
    }

    return elementMap.set(elementId, visibilityStatus);
  }

  public setCategoryCachedVisibility({
    modelId,
    categoryId,
    parentId,
    visibilityStatus,
  }: {
    modelId: ModelId;
    categoryId: CategoryId;
    parentId: ParentId;
    visibilityStatus: VisibilityStatus;
  }) {
    let parentMap = this._categoriesVisibilityStatus.get(modelId);
    if (!parentMap) {
      parentMap = new Map();
      this._categoriesVisibilityStatus.set(modelId, parentMap);
    }

    let categoryMap = parentMap.get(parentId);
    if (!categoryMap) {
      categoryMap = new Map();
      parentMap.set(parentId, categoryMap);
    }

    return categoryMap.set(categoryId, visibilityStatus);
  }

  public getGeometricElementCachedVisibility({
    modelId,
    elementId,
    parentIds,
  }: {
    modelId: ModelId;
    elementId: ElementId;
    parentIds: Array<ParentId>;
  }): VisibilityStatus | undefined {
    const parentMap = this._childElementsVisibilityStatus.get(modelId);
    if (parentMap === undefined) {
      return undefined;
    }

    for (const parentId of parentIds) {
      const result = parentMap?.get(parentId)?.get(elementId);
      if (result !== undefined) {
        return result === "cleared" ? undefined : result;
      }
    }

    return undefined;
  }

  public getCategoryCachedVisibility({
    categoryId,
    parentIds,
    modelId,
  }: {
    categoryId: CategoryId;
    parentIds: Array<ParentId>;
    modelId: ModelId;
  }): VisibilityStatus | undefined {
    const parentMap = this._categoriesVisibilityStatus.get(modelId);
    if (parentMap === undefined) {
      return undefined;
    }

    for (const parentId of parentIds) {
      const result = parentMap?.get(parentId)?.get(categoryId);
      if (result !== undefined) {
        return result === "cleared" ? undefined : result;
      }
    }
    return undefined;
  }

  private clearModelsCachedVisibility(modelIds: Iterable<ModelId>) {
    for (const modelId of modelIds) {
      this._categoriesVisibilityStatus.delete(modelId);
      this._childElementsVisibilityStatus.delete(modelId);
    }
  }

  private async getElementRelatedNodes(elementId: ElementId): Promise<{ categories: Set<CategoryId>; elements: Set<ElementId> }> {
    const modelMap = await this._modelsTreeIdsCache.getAllChildrenInfo();
    const categories = new Array<CategoryId>();
    const elements = new Array<ElementId>();
    for (const [, parentMap] of modelMap) {
      const children = this.getElementsChildren({ elementIds: [elementId], modelParentMap: parentMap });
      const parents = this.getElementsParents({ elementId, modelParentMap: parentMap });
      if (children.elements.size === 0 && parents.elements.size === 0) {
        continue;
      }
      elements.push(...children.elements);
      elements.push(...parents.elements);
      categories.push(...children.categories);
      categories.push(...parents.categories);
      break;
    }
    return { categories: new Set(categories), elements: new Set(elements) };
  }

  private async getCategoryRelatedNodes(categoryId: CategoryId): Promise<{ categories: Set<CategoryId>; elements: Set<ElementId> }> {
    const modelMap = await this._modelsTreeIdsCache.getAllChildrenInfo();
    const categories = new Array<CategoryId>();
    const elements = new Array<ElementId>();
    for (const [, parentMap] of modelMap) {
      for (const [parentId, parentEntry] of parentMap) {
        if (parentEntry.rootElementCategoryId === categoryId) {
          if (parentEntry.hasParent) {
            elements.push(parentId);
          }
          elements.push(
            ...[...parentEntry.categoryChildrenMap.values()]
              .reduce((acc, elementInfosArray) => acc.concat(elementInfosArray), [])
              .map((elementInfo) => elementInfo.childElementId),
          );
          categories.push(...parentEntry.categoryChildrenMap.keys());
        }

        const childInfos = parentEntry.categoryChildrenMap.get(categoryId);
        if (!childInfos) {
          continue;
        }
        if (parentEntry.hasParent) {
          elements.push(parentId);
          const parentParents = this.getElementsParents({ elementId: parentId, modelParentMap: parentMap });
          elements.push(...parentParents.elements);
          categories.push(...parentParents.categories);
        }

        const childElements = childInfos.map((childInfo) => childInfo.childElementId);
        elements.push(...childElements);
        const childChildren = this.getElementsChildren({ elementIds: childElements, modelParentMap: parentMap });
        elements.push(...childChildren.elements);
        categories.push(...childChildren.categories);
      }
    }
    return { categories: new Set(categories), elements: new Set(elements) };
  }

  private getElementsChildren(props: { elementIds: Array<ElementId>; modelParentMap: ModelParentMap }): {
    categories: Set<CategoryId>;
    elements: Set<ElementId>;
  } {
    const childElements = new Array<ElementId>();
    const childCategories = new Array<CategoryId>();
    for (const elementId of props.elementIds) {
      const parentEntry = props.modelParentMap.get(elementId);
      if (!parentEntry) {
        continue;
      }

      childCategories.push(...parentEntry.categoryChildrenMap.keys());

      for (const [, childInfos] of parentEntry.categoryChildrenMap) {
        const foundChildElements = childInfos.map((childInfo) => childInfo.childElementId);
        childElements.push(...foundChildElements);
        const childElementsChildren = this.getElementsChildren({ elementIds: foundChildElements, modelParentMap: props.modelParentMap });
        childCategories.push(...childElementsChildren.categories);
        childElements.push(...childElementsChildren.elements);
      }
    }

    return { categories: new Set(childCategories), elements: new Set(childElements) };
  }

  private getElementsParents(props: { elementId: ElementId; modelParentMap: ModelParentMap }): { categories: Set<CategoryId>; elements: Set<ElementId> } {
    for (const [parentId, parentEntry] of props.modelParentMap) {
      for (const [categoryId, childInfos] of parentEntry.categoryChildrenMap) {
        if (childInfos.some((childInfo) => childInfo.childElementId === props.elementId)) {
          const parentElements = new Array<ElementId>();
          const parentCategories = new Array<CategoryId>();
          parentElements.push(parentId);
          parentCategories.push(categoryId);
          const parentParents = this.getElementsParents({ elementId: parentId, modelParentMap: props.modelParentMap });
          parentCategories.push(...parentParents.categories);
          parentElements.push(...parentParents.elements);
          return { categories: new Set(parentCategories), elements: new Set(parentElements) };
        }
      }
    }
    return { categories: new Set(), elements: new Set() };
  }

  private clearCategories(categoryIds: Set<CategoryId>) {
    for (const [, parentMap] of this._categoriesVisibilityStatus) {
      for (const [, categoryMap] of parentMap) {
        for (const categoryId of categoryIds) {
          if (categoryMap.has(categoryId)) {
            categoryMap.set(categoryId, "cleared");
          }
        }
      }
    }
  }

  private clearElements(elementIds: Set<CategoryId>) {
    for (const [, parentMap] of this._childElementsVisibilityStatus) {
      for (const [, elementsMap] of parentMap) {
        for (const elementId of elementIds) {
          if (elementsMap.has(elementId)) {
            elementsMap.set(elementId, "cleared");
            elementIds.delete(elementId);
          }
        }
      }
    }
  }
}

function getViewportValues(viewport: Viewport): ViewportValues {
  const alwaysDrawn = new Set(viewport.alwaysDrawn ? [...viewport.alwaysDrawn] : []);
  const neverDrawn = new Set(viewport.neverDrawn ? [...viewport.neverDrawn] : []);
  const categories = new Set([...viewport.view.categorySelector.categories]);
  const models = new Set<ModelId>();
  viewport.view.forEachModel((model) => {
    models.add(model.id);
  });

  const overridenVisibleCategories = new Set<CategoryId>();
  const overridenHiddenCategories = new Set<CategoryId>();
  for (const ovr of viewport.perModelCategoryVisibility) {
    if (ovr.visible) {
      overridenVisibleCategories.add(ovr.categoryId);
    } else {
      overridenHiddenCategories.add(ovr.categoryId);
    }
  }
  return {
    models,
    alwaysDrawn,
    neverDrawn,
    categories,
    overridenHiddenCategories,
    overridenVisibleCategories,
  };
}

function getChangedViewportValues(
  lhs: ViewportValues,
  rhs: ViewportValues,
): { changedModels: Array<ModelId>; changedElements: Set<ElementId>; changedCategories: Set<CategoryId> } {
  const changedModels = getChangedValues(lhs.models, rhs.models);
  const changedCategories = new Set([
    ...getChangedValues(lhs.categories, rhs.categories),
    ...getChangedValues(lhs.overridenVisibleCategories, rhs.overridenVisibleCategories),
    ...getChangedValues(lhs.overridenHiddenCategories, rhs.overridenHiddenCategories),
  ]);
  const changedElements = new Set([...getChangedValues(lhs.neverDrawn, rhs.neverDrawn), ...getChangedValues(lhs.alwaysDrawn, rhs.alwaysDrawn)]);
  return {
    changedModels,
    changedCategories,
    changedElements,
  };
}

function getChangedValues(lhs: Id64Set, rhs: Id64Set) {
  const changed = new Array<Id64String>();
  for (const lhsElement of lhs) {
    if (!rhs.has(lhsElement)) {
      changed.push(lhsElement);
    }
  }
  for (const rhsElement of rhs) {
    if (!lhs.has(rhsElement)) {
      changed.push(rhsElement);
    }
  }
  return changed;
}

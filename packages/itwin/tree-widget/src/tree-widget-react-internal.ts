/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// WARNING: This barrel file exports internal APIs only for use by `@itwin/presentation-backend` and `@itwin/presentation-frontend` packages.
// They should not be used outside of these packages. These APIs may be broken or removed at any time without notice.

export {
  ModelsTreeDefinition,
  defaultHierarchyConfiguration as defaultModelsTreeHierarchyConfiguration,
} from "./tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
export { ModelsTreeIdsCache } from "./tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
export { createModelsTreeVisibilityHandler } from "./tree-widget-react/components/trees/models-tree/internal/ModelsTreeVisibilityHandler.js";
export {
  CategoriesTreeDefinition,
  defaultHierarchyConfiguration as defaultCategoriesTreeHierarchyConfiguration,
} from "./tree-widget-react/components/trees/categories-tree/CategoriesTreeDefinition.js";
export { CategoriesTreeIdsCache } from "./tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.js";
export { CategoriesVisibilityHandler } from "./tree-widget-react/components/trees/categories-tree/internal/CategoriesVisibilityHandler.js";
export { toVoidPromise, collect } from "./tree-widget-react/components/trees/common/Rxjs.js";
export { CategoriesTreeNode } from "./tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeNode.js";
export { releaseMainThreadOnItemsCount } from "./tree-widget-react/components/trees/models-tree/Utils.js";

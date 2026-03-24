<!-- cspell: ignore getsubjectsvisibilitystatus getcategoriesvisibilitystatus getmodelsvisibilitystatus getsubcategoriesvisibilitystatus getelementsvisibilitystatus getdefinitioncontainersvisibilitystatus getclassificationtablesvisibilitystatus getclassificationsvisibilitystatus -->

# Visibility Handling in Tree Widget

This document explains visibility handling across tree types (Models, Categories, and Classifications) and node types (models, categories, geometric elements, sub-categories, sub-models, classifications, classification tables and definition containers).

## Key Internal APIs

- [`useCachedVisibility`](../src/tree-widget-react/components/trees/common/internal/useTreeHooks/UseCachedVisibility.ts) — React hook that returns a tree-specific visibility handler.
  - Uses [`VisibilityChangeEventListener`](../src/tree-widget-react/components/trees/common/internal/VisibilityChangeEventListener.ts) to allow `getVisibilityStatus()` calls to be cancelled and re-requested by [`useHierarchyVisibility`](../src/tree-widget-react/components/trees/common/UseHierarchyVisibility.ts) via `onVisibilityChange()`.
  - Pauses event notifications while `changeVisibility()` is in progress to avoid re-requesting `getVisibilityStatus` before change finishes.
  - Applies special handling when search paths are present (for nodes that are not search targets or have no search-target ancestors).

- [`BaseVisibilityHelper`](../src/tree-widget-react/components/trees/common/internal/visibility/BaseVisibilityHelper.ts) — shared get/change operations for visibility status based on element/model/category ids.
  - Uses [`BaseIdsCache`](../src/tree-widget-react/components/trees/common/internal/caches/BaseIdsCache.ts) to retrieve information about nodes.
  - Examples: `getModelsVisibilityStatus()`, `getCategoriesVisibilityStatus()`, `changeModelsVisibilityStatus()`, `changeCategoriesVisibilityStatus()`.

- Tree-specific visibility handlers [`CategoriesTreeVisibilityHandler`](../src/tree-widget-react/components/trees/categories-tree/internal/visibility/CategoriesTreeVisibilityHandler.ts), [`ClassificationsTreeVisibilityHandler`](../src/tree-widget-react/components/trees/classifications-tree/internal/visibility/ClassificationsTreeVisibilityHandler.ts), [`ModelsTreeVisibilityHandler`](../src/tree-widget-react/components/trees/models-tree/internal/visibility/ModelsTreeVisibilityHandler.ts):
  - These handlers are aware of tree-specific hierarchy structure.
  - Take tree nodes as input, determine node type via nodes' `extendedData` property, and use appropriate methods from visibility helpers.
  - Expose get/change visibility status logic for search-target nodes.

- Tree-specific visibility helpers ([`CategoriesTreeVisibilityHelper`](../src/tree-widget-react/components/trees/categories-tree/internal/visibility/CategoriesTreeVisibilityHelper.ts), [`ClassificationsTreeVisibilityHelper`](../src/tree-widget-react/components/trees/classifications-tree/internal/visibility/ClassificationsTreeVisibilityHelper.ts), [`ModelsTreeVisibilityHelper`](../src/tree-widget-react/components/trees/models-tree/internal/visibility/ModelsTreeVisibilityHelper.ts)):
  - Cover tree-specific cases (e.g. definition containers exist only in the Categories tree, so `CategoriesTreeVisibilityHelper` implements get/change visibility methods for definition containers).
  - All of them use [`BaseVisibilityHelper`](../src/tree-widget-react/components/trees/common/internal/visibility/BaseVisibilityHelper.ts) to get/change visibility for those tree-specific cases.

- Search-results trees ([`BaseSearchResultsTree`](../src/tree-widget-react/components/trees/common/internal/visibility/BaseSearchResultsTree.ts) and tree-specific implementations: [Categories](../src/tree-widget-react/components/trees/categories-tree/internal/visibility/SearchResultsTree.ts), [Classifications](../src/tree-widget-react/components/trees/classifications-tree/internal/visibility/SearchResultsTree.ts), [Models](../src/tree-widget-react/components/trees/models-tree/internal/visibility/SearchResultsTree.ts)):
  - Help get/change visibility of nodes which are not search targets and don't have search-target ancestors (since these nodes might have some children missing). They allow retrieving child search targets for such nodes and then getting/changing visibility is done based on search targets instead.

- Caching:
  - [`BaseIdsCache`](../src/tree-widget-react/components/trees/common/internal/caches/BaseIdsCache.ts) - stores data that is relevant to models/categories/classifications trees (e.g. model <-> category relationship).
    - This cache is composed of other caches ([`ElementChildrenCache`](../src/tree-widget-react/components/trees/common/internal/caches/ElementChildrenCache.ts), [`SubCategoriesCache`](../src/tree-widget-react/components/trees/common/internal/caches/SubCategoriesCache.ts) and others).
    - Data stored in this cache is requested only once, because it does not change.
  - Tree-specific id caches ([`CategoriesTreeIdsCache`](../src/tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.ts), [`ClassificationsTreeIdsCache`](../src/tree-widget-react/components/trees/classifications-tree/internal/ClassificationsTreeIdsCache.ts), [`ModelsTreeIdsCache`](../src/tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.ts)):
    - Store various tree-specific relationships, (e.g. models tree ids cache stores element's model <-> subject relationship).
    - Extend `BaseIdsCacheImpl` so each tree-specific cache can be used in [`BaseVisibilityHelper`](../src/tree-widget-react/components/trees/common/internal/visibility/BaseVisibilityHelper.ts).

  - [`AlwaysAndNeverDrawnElementInfoCache`](../src/tree-widget-react/components/trees/common/internal/caches/AlwaysAndNeverDrawnElementInfoCache.ts) — caches extra data (like category) for always/never drawn elements.
    - Always and never drawn caches are reset when always and never drawn sets change respectively.
    - Child always and never drawn elements can be retrieved for models, categories and parent elements.

  - [`ElementChildrenCache`](../src/tree-widget-react/components/trees/common/internal/caches/ElementChildrenCache.ts) — cache for retrieving elements' children.
    - When changing element or element grouping nodes' visibility, need to put all children (nested as well) into always/never drawn list. This cache is used to retrieve child nodes' ids in such cases.
    - It is not used (and should not be used) when getting visibility status:
      - Only total children counts (this is stored on nodes `extendedData` property) and child always/never drawn elements (these are retrieved from [`AlwaysAndNeverDrawnElementInfoCache`](../src/tree-widget-react/components/trees/common/internal/caches/AlwaysAndNeverDrawnElementInfoCache.ts)) are needed for determining visibility.
      - Element might have hundreds of thousands of child elements. And retrieving this information for each element in the hierarchy would be very slow.

## How visibility is determined in the viewport

The viewport only renders elements. Element visibility is resolved in the following order (highest priority first):

1. **Model selector**: if a model is hidden, its elements are never visible.
2. **Always/Never drawn sets**: elements in these sets are forced to be visible/hidden.
3. **Always drawn exclusive flag**: If flag is on, then only elements in the `alwaysDrawn` set are visible, otherwise rules below apply.
4. **Per model-category overrides**: a category can be overridden per model with `hide`, `show`, or `none`.
   - `hide`: hides all elements of that category within the model.
   - `show`: shows all elements of that category within the model.
5. **Category selector**: hidden categories hide their elements.
6. **Sub-categories**: hidden sub-categories hide their elements.
   - **Note**: Determining element -> sub-category relationship is not supported at the moment. So sub-category checks are only performed when the Categories tree calls `getVisibilityStatus()` for categories or sub-categories.

## Visibility logic

- Getting visibility status
  - [Models tree](./ModelsTreeVisibilityHandling.md)
    - [getSubjectsVisibilityStatus](./ModelsTreeVisibilityHandling.md#getsubjectsvisibilitystatus)
    - [getModelsVisibilityStatus](./SharedVisibilityHandling.md#getmodelsvisibilitystatus)
    - [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus)
    - [getElementsVisibilityStatus](./SharedVisibilityHandling.md#getelementsvisibilitystatus)
  - [Categories tree](./CategoriesTreeVisibilityHandling.md)
    - [getDefinitionContainersVisibilityStatus](./CategoriesTreeVisibilityHandling.md#getdefinitioncontainersvisibilitystatus)
    - [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus)
    - [getSubCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getsubcategoriesvisibilitystatus)
    - [getElementsVisibilityStatus](./SharedVisibilityHandling.md#getelementsvisibilitystatus)
  - [Classifications tree](./ClassificationsTreeVisibilityHandling.md)
    - [getClassificationTablesVisibilityStatus](./ClassificationsTreeVisibilityHandling.md#getclassificationtablesvisibilitystatus)
    - [getClassificationsVisibilityStatus](./ClassificationsTreeVisibilityHandling.md#getclassificationsvisibilitystatus)
    - [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus)
    - [getElementsVisibilityStatus](./SharedVisibilityHandling.md#getelementsvisibilitystatus)

# Visibility Handling in Tree Widget

This document explains how visibility handling works across tree types (Models, Categories, and Classifications) and node types (models, categories, geometric elements, sub-categories, sub-models, classifications, classification tables and definition containers).

## File Overview

- [UseCachedVisibility.ts](./src/tree-widget-react/components/trees/common/internal/useTreeHooks/UseCachedVisibility.ts)
  - Returns a tree-specific visibility handler.
  - Uses [VisibilityChangeEventListener](./src/tree-widget-react/components/trees/common/internal/VisibilityChangeEventListener.ts) to allow `getVisibilityStatus()` calls to be cancelled and re-requested by [UseHierarchyVisibility](./src/tree-widget-react/components/trees/common/UseHierarchyVisibility.ts) via `onVisibilityChange()`.
  - Pauses event notifications while `changeVisibility()` is in progress to avoid re-requesting `getVisibilityStatus` before change finishes.
  - Applies special handling when search paths are present (for nodes that are not search targets or have no search-target ancestors).

- [BaseVisibilityHelper.ts](./src/tree-widget-react/components/trees/common/internal/visibility/BaseVisibilityHelper.ts)
  - Shared read/write operations for visibility based on element/model/category ids.
  - Uses `BaseIdsCache` to retrieve information about nodes.
  - Examples: `getModelsVisibilityStatus()`, `getCategoriesVisibilityStatus()`, `changeModelsVisibilityStatus()`, `changeCategoriesVisibilityStatus()`.

- Tree-specific visibility handlers:
  - Files: [CategoriesTreeVisibilityHandler.ts](./src/tree-widget-react/components/trees/categories-tree/internal/visibility/CategoriesTreeVisibilityHandler.ts), [ClassificationsTreeVisibilityHandler.ts](./src/tree-widget-react/components/trees/classifications-tree/internal/visibility/ClassificationsTreeVisibilityHandler.ts), [ModelsTreeVisibilityHandler.ts](./src/tree-widget-react/components/trees/models-tree/internal/visibility/ModelsTreeVisibilityHandler.ts).
  - These take tree nodes as input, determine node type via nodes' `extendedData` property, and use appropriate methods from visibility helpers.
  - Each exposes read/write logic for search-target nodes.
  - Each provides wrapper methods for its tree-specific caches used by `BaseVisibilityHelper`.

- Tree-specific visibility helpers:
  - Files: [CategoriesTreeVisibilityHelper.ts](./src/tree-widget-react/components/trees/categories-tree/internal/visibility/CategoriesTreeVisibilityHelper.ts), [ClassificationsTreeVisibilityHelper.ts](./src/tree-widget-react/components/trees/classifications-tree/internal/visibility/ClassificationsTreeVisibilityHelper.ts), [ModelsTreeVisibilityHelper.ts](./src/tree-widget-react/components/trees/models-tree/internal/visibility/ModelsTreeVisibilityHelper.ts).
  - These cover tree specific cases (e.g. definition containers exist only in the Categories tree, so `CategoriesTreeVisibilityHelper` implements get/change visibility methods for definition containers).
  - All of them use `BaseVisibilityHelper` to get/change visibility for those tree specific cases.

- Search-results trees:
  - [BaseSearchResultsTree.ts](./src/tree-widget-react/components/trees/common/internal/visibility/BaseSearchResultsTree.ts) defines the abstraction and factory methods.
  - Tree-specific implementation files: [Categories SearchResultsTree](./src/tree-widget-react/components/trees/categories-tree/internal/visibility/SearchResultsTree.ts), [Classifications SearchResultsTree](./src/tree-widget-react/components/trees/classifications-tree/internal/visibility/SearchResultsTree.ts), [Models SearchResultsTree](./src/tree-widget-react/components/trees/models-tree/internal/visibility/SearchResultsTree.ts).
  - The main purpose of search results trees is to help determine/change visibility of nodes which are not search targets and don't have search target ancestors (since these nodes might have some children missing). These trees allow retrieving child search targets for such nodes and then getting/changing visibility is done based on search targets instead.

- Caching:
  - Tree specific caches (requests data once):
    - [CategoriesTreeIdsCache.ts](./src/tree-widget-react/components/trees/categories-tree/internal/CategoriesTreeIdsCache.ts), [ClassificationsTreeIdsCache.ts](./src/tree-widget-react/components/trees/classifications-tree/internal/ClassificationsTreeIdsCache.ts), [ModelsTreeIdsCache.ts](./src/tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.ts)
    - These caches store various relationships, e.g. element's model <-> category.
    - The data stored in these caches is requested once (it does not change).
    - Some caching implementations is reused across these files and is stored inside [this folder](./src/tree-widget-react/components/trees/common/internal/caches/).

  - [AlwaysAndNeverDrawnElementInfoCache.ts](./src/tree-widget-react/components/trees/common/internal/caches/AlwaysAndNeverDrawnElementInfoCache.ts)
    - Caches extra metadata (like category) for always/never drawn element ids so visibility can be resolved correctly.
    - Always and never drawn caches are reset when always and never drawn sets change respectively.

  - [ElementChildrenCache.ts](./src/tree-widget-react/components/trees/common/internal/caches/ElementChildrenCache.ts)
    - Cache for retrieving elements' children.
    - Using this cache to query data is a little expensive, so it is only used when changing visibility for element or element grouping nodes.

## How visibility is determined in the viewport

The viewport only renders elements. Element visibility is resolved in the following order (highest priority first):

1. **Model selector**: if a model is hidden, its elements are never visible.
2. **Always/Never drawn sets**: elements in these sets are forced to be visible/hidden.
3. **Per model-category overrides**: a category can be overridden per model with `hide`, `show`, or `none`.
   - `hide`: hides all elements of that category within the model.
   - `show`: shows all elements of that category within the model.
   - `none`: defers to category and sub-category rules below.
4. **Category selector**: hidden categories hide their elements.
5. **Sub-categories**: hidden sub-categories hide their elements.

Note: Determining element -> sub-category relationships is not supported at the moment. So sub-category checks are only performed when the Categories tree calls `getVisibilityStatus()` for categories or sub-categories.

## Architecture

### Getting visibility status

#### getSubjectsVisibilityStatus

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  R1[/partial/]
  R2[/visible/]
  R3[/hidden/]

  %% Start
  TITLE([getSubjectsVisibilityStatus]) --> A["Get models under Props.subjectIds from cache. These are related models and models of child subjects (can be nested)"]

  PROPS[\"Props
    <div style='text-align: left;'>- subjectIds: **Id64Arg**</div>
  "\]

  A -- modelIds --> B["**getModelsVisibilityStatus**({ modelIds })"]

  %% Results
  B -- partial --> R1
  B -- visible --> R2
  B -- hidden --> R3
```

</div>

#### getClassificationTablesVisibilityStatus

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  R1[/partial/]
  R2[/visible/]
  R3[/hidden/]


  %% Start
  TITLE([getClassificationTablesVisibilityStatus]) --> A["Get categories under Props.classificationTableIds from cache. These are categories of child classifications (can be nested)"]

  PROPS[\"
    Props
    <div style='text-align: left;'>- classificationTableIds: **Id64Arg**</div>
  "\]

  A -- categoryIds --> B["**getCategoriesVisibilityStatus**({ categoryIds, modelId: undefined })"]

  %% Results
  B -- partial --> R1
  B -- visible --> R2
  B -- hidden --> R3
```

</div>

#### getClassificationsVisibilityStatus

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  R1[/partial/]
  R2[/visible/]
  R3[/hidden/]

  %% Start
  TITLE([getClassificationsVisibilityStatus]) --> A["Get categories under Props.classificationIds from cache. These are related categories and categories of child classifications (can be nested)"]

  PROPS[\"
    Props
    <div style='text-align: left;'>- classificationIds: **Id64Arg**</div>
  "\]

  A -- categoryIds --> B["**getCategoriesVisibilityStatus**({ categoryIds, modelId: undefined })"]

  %% Results
  B -- partial --> R1
  B -- visible --> R2
  B -- hidden --> R3
```

</div>

#### getDefinitionContainersVisibilityStatus

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  R1[/partial/]
  R2[/visible/]
  R3[/hidden/]

  %% Start
  TITLE([getDefinitionContainersVisibilityStatus]) --> A["Get categories under Props.definitionContainerIds from cache. These are categories whose modelId is the same as definition container or categories of child definition containers (can be nested)"]

  PROPS[\"
    Props
    <div style='text-align: left;'>- definitionContainerIds: **Id64Arg**</div>
  "\]

  A -- categoryIds --> B["**getCategoriesVisibilityStatus**({ categoryIds, modelId: undefined })"]

  %% Results
  B -- partial --> R1
  B -- visible --> R2
  B -- hidden --> R3
```

</div>

#### getSubCategoriesVisibilityStatus

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  R1[/partial/]
  R2[/visible/]
  R3[/hidden/]

  %% Start
  TITLE([getSubCategoriesVisibilityStatus]) --> A{"viewport.viewsCategory(Props.categoryId)"}

  PROPS[\"
    Props
    <div style='text-align: left;'>- categoryId: **Id64String** <br/> - subCategoryIds: **Id64Arg** </div>
  "\]

  %% Branch No
  A -- No --> R3

  %% Branch Yes
  A -- Yes --> B["Iterate through sub-categories"]
  B -- subCategoryId --> C{"viewport.viewsSubCategory(subCategoryId)"}
  C -- Yes -->  D1[visible]
  C -- No -->  D2[hidden]

  %% Merge
  D1 --> M[Merge visibility statuses]
  D2 --> M

  M --> N[Some 'visible' && Some 'hidden' <br/> **OR** <br/> at least one is 'partial']

  %% Results
  N -- Yes --> R1

  N -- No --> O[All are 'visible']

  O -- Yes --> R2
  O -- No --> R3
```

</div>

#### getModelsVisibilityStatus

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  R1[/partial/]
  R2[/visible/]
  R3[/hidden/]

  %% Start
  TITLE([getModelsVisibilityStatus]) --> A[Iterate through Props.modelIds]

  PROPS[\"
    Props
    <div style='text-align: left;'>- modelIds: **Id64Arg**</div>
  "\]

  A -- modelId --> B{"viewport.viewsModel(modelId)"}

  %% Branch Yes
  B -- Yes --> C1[Get categories of elements which exist under modelId]
  C1 -- categoryIds --> D1["**getCategoriesVisibilityStatus**({ modelId, categoryIds })"]

  %% Branch No
  B -- No --> C2[Get modelled elements under modelId]
  C2 -- modelIds --> D2{"**getModelsVisibilityStatus**({ modelIds }) <br/> === 'hidden'/empty"}
  D2 -- Yes --> E1[hidden]
  D2 -- No --> E2[partial]

  %% Merge
  D1 --> M[Merge visibility statuses]
  E1 --> M
  E2 --> M

  M --> N[Some 'visible' && Some 'hidden' <br/> **OR** <br/> at least one is 'partial']

  N -- Yes --> R1

  N -- No --> O[All are 'visible']

  O -- Yes --> R2
  O -- No --> R3
```

</div>

#### getCategoriesVisibilityStatus

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  R1[/partial/]
  R2[/visible/]
  R3[/hidden/]

  %% Start
  TITLE([getCategoriesVisibilityStatus]) --> A{Props.modelId <br/>=== undefined}

  PROPS[\"
    Props
    <div style='text-align: left;'>- modelId: **Id64String | undefined** <br/> - categoryIds: **Id64Arg**</div>
  "\]

  %% Branch Yes
  A -- Yes --> B[Iterate through categories]
  B -- categoryId --> C1[Get sub-categories for specified category from cache]
  B -- categoryId --> C2[Get models for specified category from cache]

  C1 -- subCategoryIds --> D1["**getSubCategoriesVisibilityStatus**({ subCategoryIds, categoryId })"]

  C2 --> D2[Iterate through models]
  D2 -- modelId --> F["**getModelWithCategoryVisibilityStatus**({ modelId, categoryId })"]

  %% Branch No
  A -- No --> B2[Iterate through categories]
  B2 -- categoryId --> F

  %% Merge
  D1 --> M[Merge visibility statuses]
  F --> M

  M --> N[Some 'visible' && Some 'hidden' <br/> **OR** <br/> at least one is 'partial']

  %% Results
  N -- Yes --> R1

  N -- No --> O[All are 'visible']

  O -- Yes --> R2
  O -- No --> R3
```

</div>

#### getModelWithCategoryVisibilityStatus

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  R1[/partial/]
  R2[/visible/]
  R3[/hidden/]

  %% Start
  TITLE([getModelWithCategoryVisibilityStatus]) --> A1[Get modelled elements under category with model]
  TITLE([getModelWithCategoryVisibilityStatus]) --> A2{"viewport.viewsModel(Props.modelId)"}

  PROPS[\"
    Props
    <div style='text-align: left;'>- modelId: **Id64String** <br/> - categoryId: **Id64String**</div>
  "\]

  %% Branch A1
    A1 -- modelIds --> B["**getModelsVisibilityStatus**({ modelIds })"]

  %% Branch A2

    %% Branch No
    A2 -- No --> C[hidden]

    %% Branch Yes

    A2 -- Yes --> D{Is always drawn exclusive}

      %% Branch Yes
      D -- Yes --> E1["**defaultStatus**: 'hidden' <br/> **oppositeSet**: alwaysDrawn"]

      %% Branch No
      D -- No --> E2{"
        <div style='padding: 20px'>
          Per model category override === 'show' <br/>
          <strong style='font-weight: bold;'>OR</strong>
          <br/>
          Per model category override === 'none'<br/> && viewport.viewsCategory(Props.categoryId)
        </div>
      "}


        %% Branch No
        E2 -- No --> E1

        %% Branch Yes
         E2 -- Yes --> E3["**defaultStatus**: 'visible' <br/> **oppositeSet**: neverDrawn"]

    E1 -- Pass down --> F{"**oppositeSet**.size > 0"}
    E3 -- Pass down --> F

      %% Branch No
      F -- No --> G1[defaultStatus]

      %% Branch Yes
      F -- Yes --> G2[From cache get total count of elements under category with model]

      F -- Yes --> G3["Props
    <div style='text-align: left;'>- For **oppositeSet** elements execute query (if set changed after last execution), to get their models, categories and parent elements path. <br/> - Find always/never drawn child elements (nested as well) where queried data matches Props.modelId & Props.categoryId. <br/> - Get count of elements under model with category in **oppositeSet**: numberOfElementsInOppositeSet </div>
    "]

      G2 -- totalCount --> H["**getAlwaysOrNeverDrawnVisibilityStatus**({ totalCount, numberOfElementsInOppositeSet, defaultStatus })"]
      G3 -- Pass down --> H


  %% Merge
  B --> M[Merge visibility statuses]
  C --> M
  H --> M
  G1 --> M

  M --> N[Some 'visible' && Some 'hidden' <br/> **OR** <br/> at least one is 'partial']

  %% Results
  N -- Yes --> R1

  N -- No --> O[All are 'visible']

  O -- Yes --> R2
  O -- No --> R3
```

</div>

#### getElementsVisibilityStatus

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  R1[/partial/]
  R2[/visible/]
  R3[/hidden/]

  %% Start
  TITLE([getElementsVisibilityStatus]) --> A1["<div style='text-align: left;'> Get modelIds from cache: <br/> 1. Props.elementIds which are sub-models <br/> 2. Children which are sub-models (nested as well) </div>"]
  TITLE([getElementsVisibilityStatus]) --> A2{"viewport.viewsModel(Props.modelId)"}

  PROPS[\"
    Props
    <div style='text-align: left;'>- elementIds: **Id64Arg** <br/> - modelId: **Id64String** <br/> - categoryId: **Id64String** <br/> - categoryOfTopMostParentElement: **Id64String** </br> - parentElementIdsPath: **Array<Id64Arg>** <br/> - childrenCount: **number | undefined**</div>
  "\]

  %% Branch A1
    A1 -- modelIds --> B["**getModelsVisibilityStatus**({ modelIds })"]

  %% Branch A2

    %% Branch No
    A2 -- No --> C[hidden]

    %% Branch Yes

    A2 -- Yes --> D{Is always drawn exclusive}

      %% Branch Yes
      D -- Yes --> E1["**defaultStatus**: 'hidden' <br/> **oppositeSet**: alwaysDrawn"]

      %% Branch No
      D -- No --> E2{"
        <div style='padding: 20px'>
          Per model category override === 'show' <br/>
          <strong style='font-weight: bold;'>OR</strong>
          <br/>
          Per model category override === 'none'<br/> && viewport.viewsCategory(Props.categoryId)
        </div>
      "}

        %% Branch No
        E2 -- No --> E1

        %% Branch Yes
         E2 -- Yes --> E3["**defaultStatus**: 'visible' <br/> **oppositeSet**: neverDrawn"]

    E1 -- Pass down --> F{"**oppositeSet**.size > 0"}
    E3 -- Pass down --> F

      %% Branch No
      F -- No --> G1[defaultStatus]

      %% Branch Yes
      F -- Yes --> G2{"Props.childrenCount <br/> === 0 / undefined"}

        %% Branch Yes
        G2 -- Yes --> H1[Children count in oppositeSet === 0]

        %% Branch No
        G2 -- No --> H2["Props
        <div style='text-align: left;'>- For **oppositeSet** elements execute query (if set changed after last execution), to get their models, categories and parent elements path. <br/> - Find always/never drawn child elements (nested as well) where queried data matches Props.modelId & Props.categoryId & Props.parentElementIdsPath. <br/> - Get count of children in **oppositeSet**: numberOfElementsInOppositeSet </div>
        "]



      H1 -- Pass down --> I["**numberOfElementsInOppositeSet**: Props.elementIds in oppositeSet and children count in oppositeSet <br/> **totalCount**: Props.elementIds + Props.childrenCount"]
      H2 -- Pass down --> I

      I -- Pass down --> J["**getAlwaysOrNeverDrawnVisibilityStatus**({ totalCount, numberOfElementsInOppositeSet, defaultStatus })"]


  %% Merge
  B --> M[Merge visibility statuses]
  C --> M
  G1 --> M
  J --> M

  M --> N[Some 'visible' && Some 'hidden' <br/> **OR** <br/> at least one is 'partial']

  %% Results
  N -- Yes --> R1

  N -- No --> O[All are 'visible']

  O -- Yes --> R2
  O -- No --> R3
```

</div>

#### getAlwaysOrNeverDrawnVisibilityStatus

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  R1[/partial/]
  R2[/visible/]
  R3[/hidden/]

  %% Start
  TITLE([getAlwaysOrNeverDrawnVisibilityStatus]) --> A{"Props.totalCount <br/> === 0 <br/> **OR** <br/> Props.numberOfElementsInOppositeSet <br/> === 0"}

  PROPS[\"
    Props
    <div style='text-align: left; line-height: 1.2'>
      - totalCount: **number**
      %% need !important on color since to not take the config color
     <span style='color: #808080 !important; font-style: italic; margin-top: 4px; display: block; margin-left: 15px'>Number of elements that are under node <br/> (includes node itself and its nested child elements)
     </span>
      - numberOfElementsInOppositeSet: **number**
      <span style='color: #808080 !important; font-style: italic; margin-top: 4px; display: block; margin-left: 15px'>Number of elements in the set that is opposite  <br/> to default status. If default status 'visible', it's  <br/> always drawn, otherwise it's never drawn set
      </span>
      - defaultStatus: **'visible' | 'hidden'**
      <span style='color: #808080 !important; font-style: italic; margin-top: 4px; display: block; margin-left: 15px'>Elements visibility status when they are not <br/>in always/never drawn list
      </span>
    </div>
  "\]

  %% Branch Yes
  A -- Yes --> B1{"Props.defaultStatus <br/> === 'visible'"}

    %% Branch Yes
    B1 -- Yes --> R2

    %% Branch No
    B1 -- No --> R3

  %% Branch No
  A -- No --> B2{"Props.numberOfElementsInOppositeSet <br/> === Props.totalCount"}

    %% Branch No
    B2 -- No --> R1

    %% Branch Yes
    B2 -- Yes --> C{"Props.defaultStatus <br/> === 'visible'"}

      %% Branch Yes
      C -- Yes --> R3

      %% Branch No
      C -- No --> R2
```

</div>

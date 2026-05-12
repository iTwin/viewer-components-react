<!-- cspell: ignore getcategoriesvisibilitystatus getmodelsvisibilitystatus getsubcategoriesvisibilitystatus getmodelwithcategoryvisibilitystatus getalwaysorneverdrawnvisibilitystatus getvisiblemodelcategorydirectvisibilitystatus changemodelsvisibilitystatus changecategoriesvisibilitystatus changecategoriesundermodelvisibilitystatus changeelementsvisibilitystatus showmodelwithoutanycategoriesorelements queueelementsvisibilitychange clearalwaysandneverdrawnelements -->

# Shared visibility handling

This document explains the shared parts of visibility handling in models, categories and classifications trees. Please read [how visibility is determined in the viewport](./Visibility.md#how-visibility-is-determined-in-the-viewport).

## Table of contents

- [Getting visibility status](#getting-visibility-status)
  - [getSubCategoriesVisibilityStatus](#getsubcategoriesvisibilitystatus)
  - [getModelsVisibilityStatus](#getmodelsvisibilitystatus)
  - [getCategoriesVisibilityStatus](#getcategoriesvisibilitystatus)
  - [getModelWithCategoryVisibilityStatus](#getmodelwithcategoryvisibilitystatus)
  - [getElementsVisibilityStatus](#getelementsvisibilitystatus)
  - [getAlwaysOrNeverDrawnVisibilityStatus](#getalwaysorneverdrawnvisibilitystatus)
  - [getVisibleModelCategoryDirectVisibilityStatus](#getvisiblemodelcategorydirectvisibilitystatus)
- [Changing visibility status](#changing-visibility-status)
  - [changeModelsVisibilityStatus](#changemodelsvisibilitystatus)
  - [changeCategoriesVisibilityStatus](#changecategoriesvisibilitystatus)
  - [changeCategoriesUnderModelVisibilityStatus](#changecategoriesundermodelvisibilitystatus)
  - [changeElementsVisibilityStatus](#changeelementsvisibilitystatus)
  - [showModelWithoutAnyCategoriesOrElements](#showmodelwithoutanycategoriesorelements)
  - [clearAlwaysAndNeverDrawnElements](#clearalwaysandneverdrawnelements)
  - [queueElementsVisibilityChange](#queueelementsvisibilitychange)

## Getting visibility status

### getSubCategoriesVisibilityStatus

Visibility of sub-category is `hidden` if its category is `hidden` **Or** the sub-category itself is hidden, otherwise it is `visible`. When determining visibility of multiple sub-categories, need to check if some are `visible` and some are `hidden`, in such case `partial` visibility is returned.

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Partial[/partial/]
  RESULT_Visible[/visible/]
  RESULT_Hidden[/hidden/]

  %% Start
  TITLE(["<span style='font-family: monospace;'>getSubCategoriesVisibilityStatus</span>"]) --> A{"<span style='font-family: monospace;'>viewport.viewsCategory(props.categoryId)</span>"}

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- categoryId: Id64String<br/> - subCategoryIds: Id64Arg</span>
  "\]

  %% Branch No
  A -- No --> RESULT_Hidden

  %% Branch Yes
  A -- Yes --> B["Iterate through sub-categories"]
  B -- subCategoryId --> C{"<span style='font-family: monospace;'>viewport.viewsSubCategory(subCategoryId)</span>"}
  C -- Yes -->  D1[visible]
  C -- No -->  D2[hidden]

  %% Merge
  D1 --> M[Merge visibility statuses]
  D2 --> M

  M --> N{Some 'visible' <br/> && <br/> Some 'hidden'}

  %% Results
  N -- Yes --> RESULT_Partial

  N -- No --> O{All are 'visible'}

  O -- Yes --> RESULT_Visible
  O -- No --> RESULT_Hidden
```

### getModelsVisibilityStatus

Visibility of model is determined by merging visibility status of two parts:

1. Model selector. If model is not hidden in selector, need to check categories of child elements (they are retrieved from cache) by calling [getCategoriesVisibilityStatus](#getcategoriesvisibilitystatus).
2. Child elements which are sub-models (retrieved from cache). For such elements call [getModelsVisibilityStatus](#getmodelsvisibilitystatus).

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Partial[/partial/]
  RESULT_Visible[/visible/]
  RESULT_Hidden[/hidden/]

  %% Start
  TITLE(["<span style='font-family: monospace;'>getModelsVisibilityStatus</span>"]) --> A[Iterate through <span style='font-family: monospace;'>props.modelIds</span>]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- modelIds: Id64Arg</span>
  "\]

  A -- modelId --> B{"<span style='font-family: monospace;'>viewport.viewsModel(modelId)</span>"}

  %% Branch Yes
  B -- Yes --> C1{Is always drawn exclusive}
  C1 -- No --> C11[Get categories of all elements which exist under <span style='font-family: monospace;'>modelId</span>.]
  C1 -- Yes --> C12[Get categories of top most elements which exist under <span style='font-family: monospace;'>modelId</span>.]
  C11 -- categoryIds --> D0{<span style='font-family: monospace;'>categoryIds.size > 0</span>}
  C12 -- categoryIds --> D0
    D0 -- Yes --> D1["<div style='text-align: left; font-family: monospace;'><a href='#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>modelId,</span>
    <span style='padding-left: 2rem;'>categoryIds</span>
    })</div>"]
    D0 -- No --> E1[visible]

  %% Branch No
  B -- No --> C2[Get modelled elements under <span style='font-family: monospace;'>modelId</span>]
  C2 -- modelIds --> D2{"<span style='font-family: monospace;'><a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</span> <br/> === 'hidden'/empty"}
    D2 -- Yes --> E2[hidden]
    D2 -- No --> E3[partial]

  %% Merge
  D1 --> M[Merge visibility statuses]
  E1 --> M
  E2 --> M
  E3 --> M

  M --> N{<br/> Some 'visible' && Some 'hidden' <br/> <strong>OR</strong> <br/> at least one is 'partial'}

  N -- Yes --> RESULT_Partial

  N -- No --> O{All are 'visible'}

  O -- Yes --> RESULT_Visible
  O -- No --> RESULT_Hidden
```

### getCategoriesVisibilityStatus

Allows getting category visibility under specific model (when `props.modelId` is defined) or to get generic category visibility.

1. For category visibility under specific model, [getModelWithCategoryVisibilityStatus](#getmodelwithcategoryvisibilitystatus) is used.
2. For generic category visibility status, merge statuses from:
   - Get sub-categories related to category (from cache), and call [getSubCategoriesVisibilityStatus](#getsubcategoriesvisibilitystatus).
   - Get models of category elements (from cache), for each model call [getModelWithCategoryVisibilityStatus](#getmodelwithcategoryvisibilitystatus).

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Partial[/partial/]
  RESULT_Visible[/visible/]
  RESULT_Hidden[/hidden/]

  %% Start
  TITLE(["<span style='font-family: monospace;'>getCategoriesVisibilityStatus</span>"]) --> A{<span style='font-family: monospace;'>props.modelId === undefined</span>}

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- modelId: Id64String | undefined <br/> - categoryIds: Id64Arg</span>
  "\]

  %% Branch Yes
  A -- Yes --> B[Iterate through categories]
  B -- categoryId --> C1[Get sub-categories for specified category from cache]
  B -- categoryId --> C2[Get models for specified category from cache]

  C1 -- subCategoryIds --> D1["<div style='text-align: left; font-family: monospace;'><a href='#getsubcategoriesvisibilitystatus'>getSubCategoriesVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>subCategoryIds,</span>
    <span style='padding-left: 2rem;'>categoryId</span>
    })</div>"]

  C2 --> D2[Iterate through models]
  D2 -- modelId --> F["<div style='text-align: left; font-family: monospace;'><a href='#getmodelwithcategoryvisibilitystatus'>getModelWithCategoryVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>modelId,</span>
    <span style='padding-left: 2rem;'>categoryId</span>
    })</div>"]

  %% Branch No
  A -- No --> B2[Iterate through categories]
  B2 -- categoryId --> F

  %% Merge
  D1 --> M[Merge visibility statuses]
  F --> M

  M --> N{<br/> Some 'visible' && Some 'hidden' <br/> <strong>OR</strong> <br/> at least one is 'partial'}

  %% Results
  N -- Yes --> RESULT_Partial

  N -- No --> O{All are 'visible'}

  O -- Yes --> RESULT_Visible
  O -- No --> RESULT_Hidden
```

### getModelWithCategoryVisibilityStatus

Determines visibility status of category under model. It is done by merging visibility statuses of:

- **Sub-models**: Model category elements which are sub-models (retrieved from cache) and calling [getModelsVisibilityStatus](#getmodelsvisibilitystatus).
- **Child elements**: determining child elements visibility is done by:
  1. Getting total count of elements under the category with model.
  2. Getting default child elements status based on per-model category override and category selector.
  3. Get `opposite set` to default status: default status === `visible` -> `alwaysDrawn`, `neverDrawn` otherwise.
  4. The `opposite set` can contain elements from any categories and models, need to query data of these elements and find the ones which are related to the desired category and model.
  5. Once all the above data (1-4) is known, visibility can be determined by comparing the total count, number of elements (related to specific model and category) in the opposite set, and default status.

  **Note**: All the checks are done only when [visibility rules](./Visibility.md#how-visibility-is-determined-in-the-viewport) that have higher priority do not interfere (e.g. if model is hidden in selector, then always/never drawn elements are **not checked** and `hidden` is returned for `Child Elements` visibility).

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Partial[/partial/]
  RESULT_Visible[/visible/]
  RESULT_Hidden[/hidden/]

  %% Start
  TITLE(["<span style='font-family: monospace;'>getModelWithCategoryVisibilityStatus</span>"]) --> A1[Get modelled elements under category with model]
  TITLE(["<span style='font-family: monospace;'>getModelWithCategoryVisibilityStatus</span>"]) --> A2{"<span style='font-family: monospace;'>viewport.viewsModel(props.modelId)</span>"}

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- modelId: Id64String<br/> - categoryId: Id64String</span>
  "\]

  %% Branch A1
    A1 -- modelIds --> B["<span style='font-family: monospace;'><a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</span>"]

  %% Branch A2

    %% Branch No
    A2 -- No --> C[hidden]

    %% Branch Yes

    A2 -- Yes --> D{Is always drawn exclusive}

      %% Branch Yes
      D -- Yes --> E1["<span style='font-family: monospace;'>defaultStatus: 'hidden' <br/> oppositeSet: alwaysDrawn</span>"]

      %% Branch No
      D -- No --> E2{"
        <div style='padding: 20px'>
          Per model category override === 'show'
          <strong style='font-weight: bold;'>OR</strong>
          Per model category override === 'none'<br/> && <span style='font-family: monospace;'>viewport.viewsCategory(props.categoryId)</span>
        </span>
      "}


        %% Branch No
        E2 -- No --> E1

        %% Branch Yes
         E2 -- Yes --> E3["<span style='font-family: monospace;'>defaultStatus: 'visible' <br/> oppositeSet: neverDrawn</span>"]

    E1 -- Pass down --> F{"<span style='font-family: monospace;'>oppositeSet.size > 0</span>"}
    E3 -- Pass down --> F

      %% Branch No
      F -- No --> G1[<span style='font-family: monospace;'>defaultStatus</span>]

      %% Branch Yes
      F -- Yes --> G2[From cache get total count of elements under category with model]

      F -- Yes --> G3["Props
    <span style='display: block; text-align: left; font-family: monospace;'>- For <span style='font-family: monospace;'>oppositeSet</span> elements execute query (if set changed after last execution), to get their models, categories and parent elements path. <br/> - Find always/never drawn child elements (nested as well) where queried data matches <span style='font-family: monospace;'>props.modelId</span> & <span style='font-family: monospace;'>props.categoryId</span>. <br/> - Get count of elements under model with category in <span style='font-family: monospace;'>oppositeSet</span>: <span style='font-family: monospace;'>numberOfElementsInOppositeSet</span> </span>
    "]

      G2 -- totalCount --> H["<div style='text-align: left; font-family: monospace;'><a href='#getalwaysorneverdrawnvisibilitystatus'>getAlwaysOrNeverDrawnVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>totalCount,</span>
    <span style='padding-left: 2rem;'>numberOfElementsInOppositeSet,</span>
    <span style='padding-left: 2rem;'>defaultStatus</span>
    })</div>"]
      G3 -- Pass down --> H


  %% Merge
  B --> M[Merge visibility statuses]
  C --> M
  H --> M
  G1 --> M

  M --> N{<br/> Some 'visible' && Some 'hidden' <br/> <strong>OR</strong> <br/> at least one is 'partial'}

  %% Results
  N -- Yes --> RESULT_Partial

  N -- No --> O{All are 'visible'}

  O -- Yes --> RESULT_Visible
  O -- No --> RESULT_Hidden
```

### getElementsVisibilityStatus

Determines visibility status of elements. Structure is very similar to [getModelWithCategoryVisibilityStatus](#getmodelwithcategoryvisibilitystatus), except everything is done based on elements instead of model + category.

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Partial[/partial/]
  RESULT_Visible[/visible/]
  RESULT_Hidden[/hidden/]

  %% Start
  TITLE(["<span style='font-family: monospace;'>getElementsVisibilityStatus</span>"]) --> A1["<span style='display: block; text-align: left; font-family: monospace;'> Get modelIds from cache: <br/> 1. <span style='font-family: monospace;'>props.elementIds</span> which are sub-models <br/> 2. Children which are sub-models (nested as well) </span>"]
  TITLE(["<span style='font-family: monospace;'>getElementsVisibilityStatus</span>"]) --> A2{"<span style='font-family: monospace;'>viewport.viewsModel(props.modelId)</span>"}

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- elementIds: Id64Arg<br/> - modelId: Id64String<br/> - categoryId: Id64String<br/> - categoryOfTopMostParentElement: Id64String<br/> - parentElementIdsPath: Array(Id64Arg)<br/> - childrenCount: number | undefined</span>
  "\]

  %% Branch A1
    A1 -- modelIds --> B["<span style='font-family: monospace;'><a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</span>"]

  %% Branch A2

    %% Branch No
    A2 -- No --> C[hidden]

    %% Branch Yes

    A2 -- Yes --> D{Is always drawn exclusive}

      %% Branch Yes
      D -- Yes --> E1["<span style='font-family: monospace;'>defaultStatus: 'hidden' <br/> oppositeSet: alwaysDrawn</span>"]

      %% Branch No
      D -- No --> E2{"
        <div style='padding: 20px'>
          Per model category override === 'show'
          <strong style='font-weight: bold;'>OR</strong>
          Per model category override === 'none'<br/> && <span style='font-family: monospace;'>viewport.viewsCategory(props.categoryId)</span>
        </span>
      "}

        %% Branch No
        E2 -- No --> E1

        %% Branch Yes
         E2 -- Yes --> E3["<span style='font-family: monospace;'>defaultStatus: 'visible' <br/> oppositeSet: neverDrawn</span>"]

    E1 -- Pass down --> F{"<span style='font-family: monospace;'>oppositeSet.size > 0</span>"}
    E3 -- Pass down --> F

      %% Branch No
      F -- No --> G1[<span style='font-family: monospace;'>defaultStatus</span>]

      %% Branch Yes
      F -- Yes --> G2{"<span style='font-family: monospace;'>props.childrenCount<br/> === 0 / undefined</span>"}

        %% Branch Yes
        G2 -- Yes --> H1[Children count in <span style='font-family: monospace;'>oppositeSet</span> === 0]

        %% Branch No
        G2 -- No --> H2["Props
        <span style='display: block; text-align: left; font-family: monospace;'>- For <span style='font-family: monospace;'>oppositeSet</span> elements execute query (if set changed after last execution), to get their models, categories and parent elements path. <br/> - Find always/never drawn child elements (nested as well) where queried data matches <span style='font-family: monospace;'>props.modelId</span> & <span style='font-family: monospace;'>props.categoryId</span> & <span style='font-family: monospace;'>props.parentElementIdsPath</span>. <br/> - Get count of children in <span style='font-family: monospace;'>oppositeSet</span>: <span style='font-family: monospace;'>numberOfElementsInOppositeSet</span> </span>
        "]



      H1 -- Pass down --> I["<span style='font-family: monospace;'>numberOfElementsInOppositeSet</span>: <span style='font-family: monospace;'>props.elementIds</span> in <span style='font-family: monospace;'>oppositeSet</span> and children count in <span style='font-family: monospace;'>oppositeSet</span> <br/> <span style='font-family: monospace;'>totalCount</span>: <span style='font-family: monospace;'>props.elementIds</span> + <span style='font-family: monospace;'>props.childrenCount</span>"]
      H2 -- Pass down --> I

      I -- Pass down --> J["<div style='text-align: left; font-family: monospace;'><a href='#getalwaysorneverdrawnvisibilitystatus'>getAlwaysOrNeverDrawnVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>totalCount,</span>
    <span style='padding-left: 2rem;'>numberOfElementsInOppositeSet,</span>
    <span style='padding-left: 2rem;'>defaultStatus</span>
    })</div>"]


  %% Merge
  B --> M[Merge visibility statuses]
  C --> M
  G1 --> M
  J --> M

  M --> N{<br/> Some 'visible' && Some 'hidden' <br/> <strong>OR</strong> <br/> at least one is 'partial'}

  %% Results
  N -- Yes --> RESULT_Partial

  N -- No --> O{All are 'visible'}

  O -- Yes --> RESULT_Visible
  O -- No --> RESULT_Hidden
```

### getAlwaysOrNeverDrawnVisibilityStatus

Helper function that is used by [getModelWithCategoryVisibilityStatus](#getmodelwithcategoryvisibilitystatus) and [getElementsVisibilityStatus](#getelementsvisibilitystatus). It determines visibility status of elements based on `totalCount`, `numberOfElementsInOppositeSet` and `defaultStatus`.

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Partial[/partial/]
  RESULT_Visible[/visible/]
  RESULT_Hidden[/hidden/]

  %% Start
  TITLE(["<span style='font-family: monospace;'>getAlwaysOrNeverDrawnVisibilityStatus</span>"]) --> A{"<span style='font-family: monospace;'>props.totalCount === 0</span><br/><strong>OR</strong><br/><span style='font-family: monospace;'>props.numberOfElementsInOppositeSet === 0</span>"}

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>
      - totalCount: number
     <span style='color: #808080 !important; font-style: italic;'>Number of elements that are under node <br/> (includes node itself and its nested child elements)
     </span>
      - numberOfElementsInOppositeSet: number
      <span style='color: #808080 !important; font-style: italic;'>Number of elements in the set that is opposite  <br/> to default status. If default status 'visible', it's  <br/> always drawn, otherwise it's never drawn set
      </span>
      - defaultStatus: 'visible' | 'hidden'
      <span style='color: #808080 !important; font-style: italic; display: block;'>Elements visibility status when they are not <br/>in always/never drawn list
      </span>
    </span>
  "\]

  %% Branch Yes
  A -- Yes --> B1{"<span style='font-family: monospace;'>props.defaultStatus === 'visible'</span>"}

    %% Branch Yes
    B1 -- Yes --> RESULT_Visible

    %% Branch No
    B1 -- No --> RESULT_Hidden

  %% Branch No
  A -- No --> B2{"<span style='font-family: monospace;'>props.numberOfElementsInOppositeSet<br /> === props.totalCount</span>"}

    %% Branch No
    B2 -- No --> RESULT_Partial

    %% Branch Yes
    B2 -- Yes --> C{"<span style='font-family: monospace;'>props.defaultStatus === 'visible'</span>"}

      %% Branch Yes
      C -- Yes --> RESULT_Hidden

      %% Branch No
      C -- No --> RESULT_Visible
```

### getVisibleModelCategoryDirectVisibilityStatus

Determines visibility status of a category assuming the model is visible. Returns a non-partial visibility status (`visible` or `hidden`) based on per-model category overrides and the category selector.

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Visible[/visible/]
  RESULT_Hidden[/hidden/]

  %% Start
  TITLE(["<span style='font-family: monospace;'>getVisibleModelCategoryDirectVisibilityStatus</span>"]) --> A["<span style='font-family: monospace;'>viewport.getPerModelCategoryOverride({ modelId, categoryId })</span>"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- modelId: Id64String<br/> - categoryId: Id64String</span>
  "\]

  A -- override --> B{"<span style='font-family: monospace;'>override === 'show'</span>"}

  B -- Yes --> RESULT_Visible

  B -- No --> C{"<span style='font-family: monospace;'>override === 'none' && <br/> viewport.viewsCategory(categoryId)</span>"}

  C -- Yes --> RESULT_Visible
  C -- No --> RESULT_Hidden
```

## Changing visibility status

### changeModelsVisibilityStatus

Changes visibility of models by updating the model selector, clearing per-model category overrides, and recursively propagating the change to sub-models and their categories.

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Done([Done])

  %% Start
  TITLE(["<span style='font-family: monospace;'>changeModelsVisibilityStatus</span>"]) --> A{"<span style='font-family: monospace;'>modelIds</span> is empty"}

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- modelIds: Id64Arg<br/>- on: boolean</span>
  "\]

  A -- Yes --> RESULT_Done
  A -- No --> B["<span style='font-family: monospace;'>viewport.clearPerModelCategoryOverrides({ modelIds })</span>"]

  B --> C{"<span style='font-family: monospace;'>props.on</span>"}

  %% Branch off
  C -- false --> D["<span style='font-family: monospace;'>viewport.changeModelDisplay({ modelIds, display: false })</span>"]
  D --> E["For each <span style='font-family: monospace;'>modelId</span>: get sub-models from cache"]
  E --> F["<div style='text-align: left; font-family: monospace;'><a href='#changemodelsvisibilitystatus'>changeModelsVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>modelIds: subModels,</span>
    <span style='padding-left: 2rem;'>on: false</span>
    })</div>"]
  F --> RESULT_Done

  %% Branch on
  C -- true --> G["<span style='font-family: monospace;'>viewport.changeModelDisplay({ modelIds, display: true })</span>"]
  G --> H["For each <span style='font-family: monospace;'>modelId</span>: get categories from cache"]
  H --> I["<div style='text-align: left; font-family: monospace;'><a href='#changecategoriesvisibilitystatus'>changeCategoriesVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>categoryIds,</span>
    <span style='padding-left: 2rem;'>modelId,</span>
    <span style='padding-left: 2rem;'>on: true</span>
    })</div>"]
  I --> RESULT_Done
```

### changeCategoriesVisibilityStatus

Changes visibility of categories. Behavior differs based on whether a `modelId` is provided (per-model category override) or not (generic category selector change).

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Done([Done])

  %% Start
  TITLE(["<span style='font-family: monospace;'>changeCategoriesVisibilityStatus</span>"]) --> A{"<span style='font-family: monospace;'>categoryIds</span> is empty"}

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- categoryIds: Id64Arg<br/>- on: boolean<br/>- modelId: Id64String | undefined</span>
  "\]

  A -- Yes --> RESULT_Done
  A -- No --> B{"<span style='font-family: monospace;'>props.modelId</span> is defined"}

  %% Branch with modelId
  B -- Yes --> C["<div style='text-align: left; font-family: monospace;'><a href='#changecategoriesundermodelvisibilitystatus'>changeCategoriesUnderModelVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>categoryIds,</span>
    <span style='padding-left: 2rem;'>modelId,</span>
    <span style='padding-left: 2rem;'>on</span>
    })</div>"]
  C --> RESULT_Done

  %% Branch without modelId - run in parallel
  B -- No --> E["<div style='text-align: left; font-family: monospace;'>viewport.changeCategoryDisplay({
    <span style='padding-left: 2rem;'>categoryIds,</span>
    <span style='padding-left: 2rem;'>display: on,</span>
    <span style='padding-left: 2rem;'>enableAllSubCategories: false</span>
    })</div>"]
  B -- No --> D["Get models which are related to categories from cache."]
  D -- "Map(modelId, Set(modelCategoryIds))" --> F["Iterate through map entries"]
  F -- "modelId, modelCategoryIds" --> F1{"<span style='font-family: monospace;'>hasSubModels({ modelId })</span>"}
  F1 -- No --> RESULT_Done
  F1 -- Yes --> F1_1["Iterate through <span style='font-family: monospace;'>modelCategoryIds</span>"]
  F1_1 -- categoryId --> F1_2["Get sub-models under the model & category from cache"]
  F1_2 -- subModels --> F1_3["<div style='text-align: left; font-family: monospace;'><a href='#changemodelsvisibilitystatus'>changeModelsVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>modelIds: subModels,</span>
    <span style='padding-left: 2rem;'>on</span>
    })</div>"]

  B -- No --> G{"<span style='font-family: monospace;'>props.on</span>"}

  F -- "modelId, modelCategories" --> F2["<div style='text-align: left; font-family: monospace;'>viewport.setPerModelCategoryOverride({
    <span style='padding-left: 2rem;'>modelIds: modelId,</span>
    <span style='padding-left: 2rem;'>categoryIds: modelCategories,</span>
    <span style='padding-left: 2rem;'>override: 'none'</span>
    })</div>"]
  F -- "modelId, modelCategories" --> F3["<div style='text-align: left; font-family: monospace;'><a href='#clearalwaysandneverdrawnelements'>clearAlwaysAndNeverDrawnElements</a>({
    <span style='padding-left: 2rem;'>categoryIds: modelCategories,</span>
    <span style='padding-left: 2rem;'>modelId</span>
    })</div>"]

  G -- Yes --> F4{"<span style='font-family: monospace;'>viewport.viewsModel(modelId)</span>"}
  F4 -- Yes --> RESULT_Done
  F4 -- No --> F5["<div style='text-align: left; font-family: monospace;'><a href='#showmodelwithoutanycategoriesorelements'>showModelWithoutAnyCategoriesOrElements</a>({
    <span style='padding-left: 2rem;'>modelId,</span>
    <span style='padding-left: 2rem;'>categoriesToNotOverride: modelCategories</span>
    })</div>"]

  F5 --> RESULT_Done

  G -- Yes --> G1["Iterate through categories"]
  G1 -- categoryId --> G2["Get sub-categories under category from cache"]
  G2 -- subCategories --> G3["Iterate through sub-categories"]
  G3 -- subCategoryId --> G4{"<span style='font-family: monospace;'>viewport.viewsSubCategory(subCategoryId)</span>"}
  G4 -- Yes --> RESULT_Done
  G4 -- No --> G5["<div style='text-align: left; font-family: monospace;'>viewport.changeSubCategoryDisplay({
    <span style='padding-left: 2rem;'>subCategoryId,</span>
    <span style='padding-left: 2rem;'>display: true</span>
    })</div>"]
  G5 --> RESULT_Done
  G -- No --> RESULT_Done

  E --> RESULT_Done
  F1_3 --> RESULT_Done
  F2 --> RESULT_Done
  F3 --> RESULT_Done
```

### changeCategoriesUnderModelVisibilityStatus

Changes visibility of categories under a specific model by setting per-model category overrides. All operations run in parallel.

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Done([Done])

  %% Start
  TITLE(["<span style='font-family: monospace;'>changeCategoriesUnderModelVisibilityStatus</span>"]) --> A{"<span style='font-family: monospace;'>props.on  && <br/> !viewport.viewsModel(modelId) </span>"}

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- modelId: Id64String<br/>- categoryIds: Id64Arg<br/>- on: boolean</span>
  "\]

  %% All run in parallel (merge)
  A -- Yes --> A1["<div style='text-align: left; font-family: monospace;'><a href='#showmodelwithoutanycategoriesorelements'>showModelWithoutAnyCategoriesOrElements</a>({
    <span style='padding-left: 2rem;'>modelId,</span>
    <span style='padding-left: 2rem;'>categoriesToNotOverride: categoryIds</span>
    })</div>"]
  A1 --> RESULT_Done
  A -- No --> RESULT_Done

  TITLE --> B["<div style='text-align: left; font-family: monospace;'>viewport.setPerModelCategoryOverride({
    <span style='padding-left: 2rem;'>modelIds: modelId,</span>
    <span style='padding-left: 2rem;'>categoryIds,</span>
    <span style='padding-left: 2rem;'>override: on ? 'show' : 'hide'</span>
    })</div>"]
  TITLE --> C["<div style='text-align: left; font-family: monospace;'><a href='#clearalwaysandneverdrawnelements'>clearAlwaysAndNeverDrawnElements</a>({
    <span style='padding-left: 2rem;'>categoryIds,</span>
    <span style='padding-left: 2rem;'>modelId</span>
    })</div>"]
  TITLE --> D{"<span style='font-family: monospace;'>hasSubModels({ modelId })</span>"}
  D -- Yes --> D1["Iterate through categories"]
  D1 -- categoryId --> D2["Get sub-models under model & category"]
  D2 -- subModels --> D3["<div style='text-align: left; font-family: monospace;'><a href='#changemodelsvisibilitystatus'>changeModelsVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>modelIds: subModels,</span>
    <span style='padding-left: 2rem;'>on</span>
    })</div>"]

  B --> RESULT_Done
  C --> RESULT_Done
  D -- No --> RESULT_Done
  D3 --> RESULT_Done
```

### changeElementsVisibilityStatus

Changes visibility of elements by adding them to the viewport's always/never drawn sets. The default visibility of the element (determined by model and category state) decides which set to modify. Also handles elements that are sub-models by recursively calling `changeModelsVisibilityStatus`.

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Done([Done])

  %% Start
  TITLE(["<span style='font-family: monospace;'>changeElementsVisibilityStatus</span>"]) --> A["<span style='font-family: monospace;'>elementsToChange</span> = <span style='font-family: monospace;'>props.elementIds</span> + <span style='font-family: monospace;'>props.children</span> (if any)"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- elementIds: Id64Arg<br/>- modelId: Id64String<br/>- categoryId: Id64String<br/>- on: boolean<br/>- children: Id64Arg | undefined</span>
  "\]

  A --> B{"<span style='font-family: monospace;'>viewport.viewsModel(props.modelId)</span>"}

  %% Model not visible
  B -- No --> C{"<span style='font-family: monospace;'>props.on</span>"}
  C -- No --> D["<span style='font-family: monospace;'>visibleByDefault = () => false</span>"]
  D --> H["<div style='text-align: left; font-family: monospace;'><a href='#queueelementsvisibilitychange'>queueElementsVisibilityChange</a>({
    <span style='padding-left: 2rem;'>elementIds: elementsToChange,</span>
    <span style='padding-left: 2rem;'>on,</span>
    <span style='padding-left: 2rem;'>visibleByDefault</span>
    })</div>"]
  C -- Yes --> E["<div style='text-align: left; font-family: monospace;'><a href='#showmodelwithoutanycategoriesorelements'>showModelWithoutAnyCategoriesOrElements</a>({
    <span style='padding-left: 2rem;'>modelId: props.modelId</span>
    })</div>"]
  E --> F["<span style='font-family: monospace;'>defaultVisibility</span> = <span style='font-family: monospace;'><a href='#getvisiblemodelcategorydirectvisibilitystatus'>getVisibleModelCategoryDirectVisibilityStatus</a>({categoryId, modelId })</span>"]
  B -- Yes --> F
  F -- defaultVisibility --> G1["<span style='font-family: monospace;'>visibleByDefault = (elementId) => (elementIds.has(elementId) ? defaultVisibility : !on)</span>"]

  G1 --> H

  %% Sub-models (runs concurrently)
  TITLE --> J["Iterate through <span style='font-family: monospace;'>elementIds</span>"]

  J -- elementId --> K["get sub-models under element (if element itself is a sub-model it is included)"]
  K -- subModels --> L{"<span style='font-family: monospace;'> subModels.length > 0 </span>"}
  L -- Yes -->  L1["<div style='text-align: left; font-family: monospace;'><a href='#changemodelsvisibilitystatus'>changeModelsVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>modelIds: subModels,</span>
    <span style='padding-left: 2rem;'>on</span>
    })</div>"]

  H --> RESULT_Done
  L -- No --> RESULT_Done
  L1 --> RESULT_Done
```

### showModelWithoutAnyCategoriesOrElements

Turns a model on without making any of its elements visible. This is used when a category or element visibility change requires the model to be displayed, but the caller will handle showing the specific categories/elements.

The method:

1. Fetches all model categories and always-drawn elements from cache.
2. If the model was already turned on (e.g. concurrently), returns early.
3. Removes model's always-drawn elements from the viewport's always-drawn set.
4. Turns the model display on.
5. Sets per-model category overrides to hide all categories (except those in `categoriesToNotOverride`).

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Done([Done])

  %% Start
  TITLE(["<span style='font-family: monospace;'>showModelWithoutAnyCategoriesOrElements</span>"]) --> A["Fetch from cache in parallel:<br/>1. All categories of model<br/>2. Always drawn elements of model"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- modelId: Id64String<br/> - categoriesToNotOverride: Id64Set | undefined</span>
  "\]

  A -- "allModelCategories,<br/>modelAlwaysDrawnElements" --> B{"<span style='font-family: monospace;'>viewport.viewsModel(modelId)</span>"}

  %% Early return
  B -- Yes --> RESULT_Done

  %% Main flow
  B -- No --> C{"<span style='font-family: monospace;'>alwaysDrawn &&  <br/> modelAlwaysDrawnElements </span>"}
  C -- Yes --> C1["<div style='text-align: left; font-family: monospace;'>viewport.setAlwaysDrawn({
    <span style='padding-left: 2rem;'>elementIds: alwaysDrawn - modelAlwaysDrawnElements</span>
    })</div>"]
  C -- No --> RESULT_Done
  B -- No -->  D["<div style='text-align: left; font-family: monospace;'>viewport.changeModelDisplay({
    <span style='padding-left: 2rem;'>modelIds: modelId,</span>
    <span style='padding-left: 2rem;'>display: true</span>
    })</div>"]

  B -- No --> E["Iterate through <span style='font-family: monospace;'>allModelCategories</span>"]
  E -- categoryId --> G{"<span style='font-family: monospace;'>categoriesToNotOverride?.has(categoryId)</span>"}

  G -- Yes --> K["Collect <span style='font-family: monospace;'>toHide</span> and <span style='font-family: monospace;'>toNone</span> lists"]
  G -- No --> H{"<span style='font-family: monospace;'>viewport.viewsCategory(categoryId)</span>"}

  H -- Yes --> I1["Add to <span style='font-family: monospace;'>toHide</span> list"]
  H -- No --> I2["Add to <span style='font-family: monospace;'>toNone</span> list"]

  I1 --> K
  I2 --> K
  K -- toHide, toNone --> J{"<span style='font-family: monospace;'>list.length > 0 </span>"}
  J -- Yes --> J1["<div style='text-align: left; font-family: monospace;'>viewport.setPerModelCategoryOverride({
    <span style='padding-left: 2rem;'>modelIds,</span>
    <span style='padding-left: 2rem;'>categoryIds: list,</span>
    <span style='padding-left: 2rem;'>override: list === toHide ? 'hide' : 'none'</span>
    })</div>"]
  J -- No --> RESULT_Done

  C1 --> RESULT_Done
  D --> RESULT_Done
  J1 --> RESULT_Done
```

### queueElementsVisibilityChange

Queues a visibility change for elements. If the change is cancelled before completion, the queued operation is skipped.

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Done([Done])

  %% Start
  TITLE(["<span style='font-family: monospace;'>queueElementsVisibilityChange</span>"]) --> A["Iterate through <span style='font-family: monospace;'>elementIds</span>"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- elementIds: Id64Arg<br/> - on: boolean<br/> - visibleByDefault: (elementId) => boolean</span>
  "\]

  A -- elementId --> B{"<span style='font-family: monospace;'>props.on</span>"}

  %% Turn on
  B -- true --> C1["Remove <span style='font-family: monospace;'>elementId</span> from <span style='font-family: monospace;'>neverDrawn</span>"]
  C1 --> D1{"<span style='font-family: monospace;'>!visibleByDefault(elementId)<br/> || isAlwaysDrawnExclusive</span>"}
  D1 -- Yes --> E1["Add <span style='font-family: monospace;'>elementId</span> to <span style='font-family: monospace;'>alwaysDrawn</span>"]
  D1 -- No --> F
  E1 --> F

  %% Turn off
  B -- false --> C2["Remove <span style='font-family: monospace;'>elementId</span> from <span style='font-family: monospace;'>alwaysDrawn</span>"]
  C2 --> D2{"<span style='font-family: monospace;'>visibleByDefault(elementId)<br/> && !isAlwaysDrawnExclusive</span>"}
  D2 -- Yes --> E2["Add <span style='font-family: monospace;'>elementId</span> to <span style='font-family: monospace;'>neverDrawn</span>"]
  D2 -- No --> F
  E2 --> F

  F["After all elements processed"] --> G["Apply accumulated changes to viewport:<br/><span style='font-family: monospace;'>viewport.setAlwaysDrawn / viewport.setNeverDrawn</span>"]
  G --> RESULT_Done
```

### clearAlwaysAndNeverDrawnElements

Removes elements (related to the specified model and categories) from the viewport's always and never drawn sets.

```mermaid
---
config:
  flowchart:
    wrappingWidth: 750
    useMaxWidth: false
---

flowchart TD
  RESULT_Done([Done])

  %% Start
  TITLE(["<span style='font-family: monospace;'>clearAlwaysAndNeverDrawnElements</span>"]) --> A["Fetch from cache in parallel:<br/>1. Always drawn elements for model & categories <br/>2. Never drawn elements for model & categories"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- categoryIds: Id64Arg<br/> - modelId: Id64String</span>
  "\]

  A -- "alwaysDrawn" --> B1{"<span style='font-family: monospace;'>viewport.alwaysDrawn?.size<br/> && alwaysDrawn.size </span>"}
  B1 -- Yes --> B2["<div style='text-align: left; font-family: monospace;'>viewport.setAlwaysDrawn({
    <span style='padding-left: 2rem;'>elementIds: viewport.alwaysDrawn - alwaysDrawn</span>
    })</div>"]
  B1 -- No --> RESULT_Done
  B2 --> RESULT_Done

  A -- "neverDrawn" --> C1{"<span style='font-family: monospace;'>viewport.neverDrawn?.size<br/> && neverDrawn.size </span>"}
  C1 -- Yes --> C2["<div style='text-align: left; font-family: monospace;'>viewport.setNeverDrawn({
    <span style='padding-left: 2rem;'>elementIds: viewport.neverDrawn - neverDrawn</span>
    })</div>"]
  C1 -- No --> RESULT_Done
  C2 --> RESULT_Done
```

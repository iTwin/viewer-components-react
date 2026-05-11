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
  TITLE(["<code>getSubCategoriesVisibilityStatus</code>"]) --> A{"<code>viewport.viewsCategory(props.categoryId)</code>"}

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- categoryId: Id64String<br/> - subCategoryIds: Id64Arg</code>
  "\]

  %% Branch No
  A -- No --> RESULT_Hidden

  %% Branch Yes
  A -- Yes --> B["Iterate through sub-categories"]
  B -- subCategoryId --> C{"<code>viewport.viewsSubCategory(subCategoryId)</code>"}
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
  TITLE(["<code>getModelsVisibilityStatus</code>"]) --> A[Iterate through <code>props.modelIds</code>]

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- modelIds: Id64Arg</code>
  "\]

  A -- modelId --> B{"<code>viewport.viewsModel(modelId)</code>"}

  %% Branch Yes
  B -- Yes --> C1{Is always drawn exclusive}
  C1 -- No --> C11[Get categories of all elements which exist under <code>modelId</code>.]
  C1 -- Yes --> C12[Get categories of top most elements which exist under <code>modelId</code>.]
  C11 -- categoryIds --> D0{<code>categoryIds.size > 0<code/>}
  C12 -- categoryIds --> D0
    D0 -- Yes --> D1["<code style='display: block; text-align: left;'><a href='#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>({
      <code style='padding-left: 2rem'>modelId,</code>
      <code style='padding-left: 2rem'>categoryIds</code>
    })</code>"]
    D0 -- No --> E1[visible]

  %% Branch No
  B -- No --> C2[Get modelled elements under <code>modelId</code>]
  C2 -- modelIds --> D2{"<code><a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</code> <br/> === 'hidden'/empty"}
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
  TITLE(["<code>getCategoriesVisibilityStatus</code>"]) --> A{<code>props.modelId === undefined</code>}

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- modelId: Id64String | undefined <br/> - categoryIds: Id64Arg</code>
  "\]

  %% Branch Yes
  A -- Yes --> B[Iterate through categories]
  B -- categoryId --> C1[Get sub-categories for specified category from cache]
  B -- categoryId --> C2[Get models for specified category from cache]

  C1 -- subCategoryIds --> D1["<code style='display: block; text-align: left;'><a href='#getsubcategoriesvisibilitystatus'>getSubCategoriesVisibilityStatus</a>({
    <code style='padding-left: 2rem'>subCategoryIds,</code>
    <code style='padding-left: 2rem'>categoryId</code>
  })</code>"]

  C2 --> D2[Iterate through models]
  D2 -- modelId --> F["<code style='display: block; text-align: left;'><a href='#getmodelwithcategoryvisibilitystatus'>getModelWithCategoryVisibilityStatus</a>({
    <code style='padding-left: 2rem'>modelId,</code>
    <code style='padding-left: 2rem'>categoryId</code>
  })</code>"]

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
  TITLE(["<code>getModelWithCategoryVisibilityStatus</code>"]) --> A1[Get modelled elements under category with model]
  TITLE(["<code>getModelWithCategoryVisibilityStatus</code>"]) --> A2{"<code>viewport.viewsModel(props.modelId)</code>"}

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- modelId: Id64String<br/> - categoryId: Id64String</code>
  "\]

  %% Branch A1
    A1 -- modelIds --> B["<code><a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</code>"]

  %% Branch A2

    %% Branch No
    A2 -- No --> C[hidden]

    %% Branch Yes

    A2 -- Yes --> D{Is always drawn exclusive}

      %% Branch Yes
      D -- Yes --> E1["<code>defaultStatus: 'hidden' <br/> oppositeSet: alwaysDrawn</code>"]

      %% Branch No
      D -- No --> E2{"
        <div style='padding: 20px'>
          Per model category override === 'show'
          <strong style='font-weight: bold;'>OR</strong>
          Per model category override === 'none'<br/> && <code>viewport.viewsCategory(props.categoryId)</code>
        </code>
      "}


        %% Branch No
        E2 -- No --> E1

        %% Branch Yes
         E2 -- Yes --> E3["<code>defaultStatus: 'visible' <br/> oppositeSet: neverDrawn</code>"]

    E1 -- Pass down --> F{"<code>oppositeSet.size > 0</code>"}
    E3 -- Pass down --> F

      %% Branch No
      F -- No --> G1[<code>defaultStatus</code>]

      %% Branch Yes
      F -- Yes --> G2[From cache get total count of elements under category with model]

      F -- Yes --> G3["Props
    <code style='display: block; text-align: left;'>- For <code>oppositeSet</code> elements execute query (if set changed after last execution), to get their models, categories and parent elements path. <br/> - Find always/never drawn child elements (nested as well) where queried data matches <code>props.modelId</code> & <code>props.categoryId</code>. <br/> - Get count of elements under model with category in <code>oppositeSet</code>: <code>numberOfElementsInOppositeSet</code> </code>
    "]

      G2 -- totalCount --> H["<code style='display: block; text-align: left;'><a href='#getalwaysorneverdrawnvisibilitystatus'>getAlwaysOrNeverDrawnVisibilityStatus</a>({
        <code style='padding-left: 2rem'>totalCount,</code>
        <code style='padding-left: 2rem'>numberOfElementsInOppositeSet,</code>
        <code style='padding-left: 2rem'>defaultStatus</code>
      })</code>"]
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
  TITLE(["<code>getElementsVisibilityStatus</code>"]) --> A1["<code style='display: block; text-align: left;'> Get modelIds from cache: <br/> 1. <code>props.elementIds</code> which are sub-models <br/> 2. Children which are sub-models (nested as well) </code>"]
  TITLE(["<code>getElementsVisibilityStatus</code>"]) --> A2{"<code>viewport.viewsModel(props.modelId)</code>"}

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- elementIds: Id64Arg<br/> - modelId: Id64String<br/> - categoryId: Id64String<br/> - categoryOfTopMostParentElement: Id64String<br/> - parentElementIdsPath: Array(Id64Arg)<br/> - childrenCount: number | undefined</code>
  "\]

  %% Branch A1
    A1 -- modelIds --> B["<code><a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</code>"]

  %% Branch A2

    %% Branch No
    A2 -- No --> C[hidden]

    %% Branch Yes

    A2 -- Yes --> D{Is always drawn exclusive}

      %% Branch Yes
      D -- Yes --> E1["<code>defaultStatus: 'hidden' <br/> oppositeSet: alwaysDrawn</code>"]

      %% Branch No
      D -- No --> E2{"
        <div style='padding: 20px'>
          Per model category override === 'show'
          <strong style='font-weight: bold;'>OR</strong>
          Per model category override === 'none'<br/> && <code>viewport.viewsCategory(props.categoryId)</code>
        </code>
      "}

        %% Branch No
        E2 -- No --> E1

        %% Branch Yes
         E2 -- Yes --> E3["<code>defaultStatus: 'visible' <br/> oppositeSet: neverDrawn</code>"]

    E1 -- Pass down --> F{"<code>oppositeSet.size > 0</code>"}
    E3 -- Pass down --> F

      %% Branch No
      F -- No --> G1[<code>defaultStatus</code>]

      %% Branch Yes
      F -- Yes --> G2{"<code>props.childrenCount<br/> === 0 / undefined</code>"}

        %% Branch Yes
        G2 -- Yes --> H1[Children count in <code>oppositeSet</code> === 0]

        %% Branch No
        G2 -- No --> H2["Props
        <code style='display: block; text-align: left;'>- For <code>oppositeSet</code> elements execute query (if set changed after last execution), to get their models, categories and parent elements path. <br/> - Find always/never drawn child elements (nested as well) where queried data matches <code>props.modelId</code> & <code>props.categoryId</code> & <code>props.parentElementIdsPath</code>. <br/> - Get count of children in <code>oppositeSet</code>: <code>numberOfElementsInOppositeSet</code> </code>
        "]



      H1 -- Pass down --> I["<code>numberOfElementsInOppositeSet</code>: <code>props.elementIds</code> in <code>oppositeSet</code> and children count in <code>oppositeSet</code> <br/> <code>totalCount</code>: <code>props.elementIds</code> + <code>props.childrenCount</code>"]
      H2 -- Pass down --> I

      I -- Pass down --> J["<code style='display: block; text-align: left;'><a href='#getalwaysorneverdrawnvisibilitystatus'>getAlwaysOrNeverDrawnVisibilityStatus</a>({
      <code style='padding-left: 2rem'>totalCount,</code>
      <code style='padding-left: 2rem'>numberOfElementsInOppositeSet,</code>
      <code style='padding-left: 2rem'>defaultStatus</code>
      })</code>"]


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
  TITLE(["<code>getAlwaysOrNeverDrawnVisibilityStatus</code>"]) --> A{"<code>props.totalCount === 0</code><br/><strong>OR</strong><br/><code>props.numberOfElementsInOppositeSet === 0</code>"}

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>
      - totalCount: number
     <span style='color: #808080 !important; font-style: italic;'>Number of elements that are under node <br/> (includes node itself and its nested child elements)
     </span>
      - numberOfElementsInOppositeSet: number
      <span style='color: #808080 !important; font-style: italic;'>Number of elements in the set that is opposite  <br/> to default status. If default status 'visible', it's  <br/> always drawn, otherwise it's never drawn set
      </span>
      - defaultStatus: 'visible' | 'hidden'
      <span style='color: #808080 !important; font-style: italic; display: block;'>Elements visibility status when they are not <br/>in always/never drawn list
      </span>
    </code>
  "\]

  %% Branch Yes
  A -- Yes --> B1{"<code>props.defaultStatus === 'visible'</code>"}

    %% Branch Yes
    B1 -- Yes --> RESULT_Visible

    %% Branch No
    B1 -- No --> RESULT_Hidden

  %% Branch No
  A -- No --> B2{"<code>props.numberOfElementsInOppositeSet<br /> === props.totalCount</code>"}

    %% Branch No
    B2 -- No --> RESULT_Partial

    %% Branch Yes
    B2 -- Yes --> C{"<code>props.defaultStatus === 'visible'</code>"}

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
  TITLE(["<code>getVisibleModelCategoryDirectVisibilityStatus</code>"]) --> A["<code>viewport.getPerModelCategoryOverride({ modelId, categoryId })</code>"]

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- modelId: Id64String<br/> - categoryId: Id64String</code>
  "\]

  A -- override --> B{"<code>override === 'show'</code>"}

  B -- Yes --> RESULT_Visible

  B -- No --> C{"<code>override === 'none' && <br/> viewport.viewsCategory(categoryId)</code>"}

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
  TITLE(["<code>changeModelsVisibilityStatus</code>"]) --> A{"<code>modelIds</code> is empty"}

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- modelIds: Id64Arg<br/>- on: boolean</code>
  "\]

  A -- Yes --> RESULT_Done
  A -- No --> B["<code>viewport.clearPerModelCategoryOverrides({ modelIds })</code>"]

  B --> C{"<code>props.on</code>"}

  %% Branch off
  C -- false --> D["<code>viewport.changeModelDisplay({ modelIds, display: false })</code>"]
  D --> E["For each <code>modelId</code>: get sub-models from cache"]
  E --> F["<code style='display: block; text-align: left;'><a href='#changemodelsvisibilitystatus'>changeModelsVisibilityStatus</a>({
    <code style='padding-left: 2rem'>modelIds: subModels,</code>
    <code style='padding-left: 2rem'>on: false</code>
  })</code>"]
  F --> RESULT_Done

  %% Branch on
  C -- true --> G["<code>viewport.changeModelDisplay({ modelIds, display: true })</code>"]
  G --> H["For each <code>modelId</code>: get categories from cache"]
  H --> I["<code style='display: block; text-align: left;'><a href='#changecategoriesvisibilitystatus'>changeCategoriesVisibilityStatus</a>({
    <code style='padding-left: 2rem'>categoryIds,</code>
    <code style='padding-left: 2rem'>modelId,</code>
    <code style='padding-left: 2rem'>on: true</code>
  })</code>"]
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
  TITLE(["<code>changeCategoriesVisibilityStatus</code>"]) --> A{"<code>categoryIds</code> is empty"}

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- categoryIds: Id64Arg<br/>- on: boolean<br/>- modelId: Id64String | undefined</code>
  "\]

  A -- Yes --> RESULT_Done
  A -- No --> B{"<code>props.modelId</code> is defined"}

  %% Branch with modelId
  B -- Yes --> C["<code style='display: block; text-align: left;'><a href='#changecategoriesundermodelvisibilitystatus'>changeCategoriesUnderModelVisibilityStatus</a>({
    <code style='padding-left: 2rem'>categoryIds,</code>
    <code style='padding-left: 2rem'>modelId,</code>
    <code style='padding-left: 2rem'>on</code>
  })</code>"]
  C --> RESULT_Done

  %% Branch without modelId - run in parallel
  B -- No --> E["<code style='display: block; text-align: left;'>viewport.changeCategoryDisplay({
    <code style='padding-left: 2rem'>categoryIds,</code>
    <code style='padding-left: 2rem'>display: on,</code>
    <code style='padding-left: 2rem'>enableAllSubCategories: false</code>
  })
  </code>"]
  B -- No --> D["Get models which are related to categories from cache."]
  D -- "Map(modelId, Set(modelCategoryIds))" --> F["Iterate through map entries"]
  F -- "modelId, modelCategoryIds" --> F1{"<code>hasSubModels({ modelId })</code>"}
  F1 -- No --> RESULT_Done
  F1 -- Yes --> F1_1["Iterate through <code>modelCategoryIds</code>"]
  F1_1 -- categoryId --> F1_2["Get sub-models under the model & category from cache"]
  F1_2 -- subModels --> F1_3["<code style='display: block; text-align: left;'><a href='#changemodelsvisibilitystatus'>changeModelsVisibilityStatus</a>({
    <code style='padding-left: 2rem'>modelIds: subModels,</code>
    <code style='padding-left: 2rem'>on</code>
  })
  </code>"]

  B -- No --> G{"<code>props.on</code>"}

  F -- "modelId, modelCategories" --> F2["<code style='display: block; text-align: left;'>viewport.setPerModelCategoryOverride({
    <code style='padding-left: 2rem'>modelIds: modelId,</code>
    <code style='padding-left: 2rem'>categoryIds: modelCategories,</code>
    <code style='padding-left: 2rem'>override: 'none'</code>
  })</code>"]
  F -- "modelId, modelCategories" --> F3["<code style='display: block; text-align: left;'><a href='#clearalwaysandneverdrawnelements'>clearAlwaysAndNeverDrawnElements</a>({
    <code style='padding-left: 2rem'>categoryIds: modelCategories,</code>
    <code style='padding-left: 2rem'>modelId</code>
  })</code>"]

  G -- Yes --> F4{"<code>viewport.viewsModel(modelId)</code>"}
  F4 -- Yes --> RESULT_Done
  F4 -- No --> F5["<code style='display: block; text-align: left;'><a href='#showmodelwithoutanycategoriesorelements'>showModelWithoutAnyCategoriesOrElements</a>({
    <code style='padding-left: 2rem'>modelId,</code>
    <code style='padding-left: 2rem'>categoriesToNotOverride: modelCategories</code>
  })</code>"]

  F5 --> RESULT_Done

  G -- Yes --> G1["Iterate through categories"]
  G1 -- categoryId --> G2["Get sub-categories under category from cache"]
  G2 -- subCategories --> G3["Iterate through sub-categories"]
  G3 -- subCategoryId --> G4{"<code>viewport.viewsSubCategory(subCategoryId)</code>"}
  G4 -- Yes --> RESULT_Done
  G4 -- No --> G5["<code style='display: block; text-align: left;'>viewport.changeSubCategoryDisplay({
    <code style='padding-left: 2rem'>subCategoryId,</code>
    <code style='padding-left: 2rem'>display: true</code>
  })</code>"]
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
  TITLE(["<code>changeCategoriesUnderModelVisibilityStatus</code>"]) --> A{"<code>props.on  && <br/> !viewport.viewsModel(modelId) </code>"}

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- modelId: Id64String<br/>- categoryIds: Id64Arg<br/>- on: boolean</code>
  "\]

  %% All run in parallel (merge)
  A -- Yes --> A1["<code style='display: block; text-align: left;'><a href='#showmodelwithoutanycategoriesorelements'>showModelWithoutAnyCategoriesOrElements</a>({
  <code style='padding-left: 2rem'>modelId,</code>
  <code style='padding-left: 2rem'>categoriesToNotOverride: categoryIds</code>
  })</code>"]
  A1 --> RESULT_Done
  A -- No --> RESULT_Done

  TITLE --> B["<code style='display: block; text-align: left;'>viewport.setPerModelCategoryOverride({
    <code style='padding-left: 2rem'>modelIds: modelId,</code>
    <code style='padding-left: 2rem'>categoryIds,</code>
    <code style='padding-left: 2rem'>override: on ? 'show' : 'hide'</code>
  })</code>"]
  TITLE --> C["<code style='display: block; text-align: left;'><a href='#clearalwaysandneverdrawnelements'>clearAlwaysAndNeverDrawnElements</a>({
    <code style='padding-left: 2rem'>categoryIds,</code>
    <code style='padding-left: 2rem'>modelId</code>
  })</code>"]
  TITLE --> D{"<code>hasSubModels({ modelId })</code>"}
  D -- Yes --> D1["Iterate through categories"]
  D1 -- categoryId --> D2["Get sub-models under model & category"]
  D2 -- subModels --> D3["<code style='display: block; text-align: left;'><a href='#changemodelsvisibilitystatus'>changeModelsVisibilityStatus</a>({
    <code style='padding-left: 2rem'>modelIds: subModels,</code>
    <code style='padding-left: 2rem'>on</code>
  })</code>"]

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
  TITLE(["<code>changeElementsVisibilityStatus</code>"]) --> A["<code>elementsToChange</code> = <code>props.elementIds</code> + <code>props.children</code> (if any)"]

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- elementIds: Id64Arg<br/>- modelId: Id64String<br/>- categoryId: Id64String<br/>- on: boolean<br/>- children: Id64Arg | undefined</code>
  "\]

  A --> B{"<code>viewport.viewsModel(props.modelId)</code>"}

  %% Model not visible
  B -- No --> C{"<code>props.on</code>"}
  C -- No --> D["<code>visibleByDefault = () => false</code>"]
  D --> H["<code style='display: block; text-align: left;'><a href='#queueelementsvisibilitychange'>queueElementsVisibilityChange</a>({
    <code style='padding-left: 2rem'>elementIds: elementsToChange,</code>
    <code style='padding-left: 2rem'>on,</code>
    <code style='padding-left: 2rem'>visibleByDefault</code>
  })</code>"]
  C -- Yes --> E["<code style='display: block; text-align: left;'><a href='#showmodelwithoutanycategoriesorelements'>showModelWithoutAnyCategoriesOrElements</a>({
  <code style='padding-left: 2rem'>modelId: props.modelId</code>
  })</code>"]
  E --> F["<code>defaultVisibility</code> = <code><a href='#getvisiblemodelcategorydirectvisibilitystatus'>getVisibleModelCategoryDirectVisibilityStatus</a>({categoryId, modelId })</code>"]
  B -- Yes --> F
  F -- defaultVisibility --> G1["<code>visibleByDefault = (elementId) => { elementIds.has(elementId) ? defaultVisibility : !on }</code>"]

  G1 --> H

  %% Sub-models (runs concurrently)
  TITLE --> J["Iterate through <code>elementIds</code>"]

  J -- elementId --> K["get sub-models under element (if element itself is a sub-model it is included)"]
  K -- subModels --> L{"<code> subModels.length > 0 </code>"}
  L -- Yes -->  L1["<code style='display: block; text-align: left;'><a href='#changemodelsvisibilitystatus'>changeModelsVisibilityStatus</a>({
    <code style='padding-left: 2rem'>modelIds: subModels,</code>
    <code style='padding-left: 2rem'>on</code>
  })</code>"]

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
  TITLE(["<code>showModelWithoutAnyCategoriesOrElements</code>"]) --> A["Fetch from cache in parallel:<br/>1. All categories of model<br/>2. Always drawn elements of model"]

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- modelId: Id64String<br/> - categoriesToNotOverride: Id64Set | undefined</code>
  "\]

  A -- "allModelCategories,<br/>modelAlwaysDrawnElements" --> B{"<code>viewport.viewsModel(modelId)</code>"}

  %% Early return
  B -- Yes --> RESULT_Done

  %% Main flow
  B -- No --> C{"<code>alwaysDrawn &&  <br/> modelAlwaysDrawnElements </code>"}
  C -- Yes --> C1["<code style='display: block; text-align: left;'>viewport.setAlwaysDrawn({
    <code style='padding-left: 2rem'>elementIds: alwaysDrawn - modelAlwaysDrawnElements</code>
  })</code>"]
  C -- No --> RESULT_Done
  B -- No -->  D["<code style='display: block; text-align: left;'>viewport.changeModelDisplay({
    <code style='padding-left: 2rem'>modelIds: modelId,</code>
    <code style='padding-left: 2rem'>display: true</code>
  })</code>"]

  B -- No --> E["Iterate through <code>allModelCategories</code>"]
  E -- categoryId --> G{"<code>categoriesToNotOverride?.has(categoryId)</code>"}

  G -- Yes --> K["Collect <code>toHide</code> and <code>toNone</code> lists"]
  G -- No --> H{"<code>viewport.viewsCategory(categoryId)</code>"}

  H -- Yes --> I1["Add to <code>toHide</code> list"]
  H -- No --> I2["Add to <code>toNone</code> list"]

  I1 --> K
  I2 --> K
  K -- toHide, toNone --> J{"<code>list.length > 0 </code>"}
  J -- Yes --> J1["<code style='display: block; text-align: left;'>viewport.setPerModelCategoryOverride({
  <code style='padding-left: 2rem'>modelIds,</code>
  <code style='padding-left: 2rem'>categoryIds: list,</code>
  <code style='padding-left: 2rem'>override: list === toHide ? 'hide' : 'none'</code>
  })</code>
  <br/>
  "]
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
  TITLE(["<code>queueElementsVisibilityChange</code>"]) --> A["Iterate through <code>elementIds</code>"]

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- elementIds: Id64Arg<br/> - on: boolean<br/> - visibleByDefault: (elementId) => boolean</code>
  "\]

  A -- elementId --> B{"<code>props.on</code>"}

  %% Turn on
  B -- true --> C1["Remove <code>elementId</code> from <code>neverDrawn</code>"]
  C1 --> D1{"<code>!visibleByDefault(elementId)<br/> || isAlwaysDrawnExclusive</code>"}
  D1 -- Yes --> E1["Add <code>elementId</code> to <code>alwaysDrawn</code>"]
  D1 -- No --> F
  E1 --> F

  %% Turn off
  B -- false --> C2["Remove <code>elementId</code> from <code>alwaysDrawn</code>"]
  C2 --> D2{"<code>visibleByDefault(elementId)<br/> && !isAlwaysDrawnExclusive</code>"}
  D2 -- Yes --> E2["Add <code>elementId</code> to <code>neverDrawn</code>"]
  D2 -- No --> F
  E2 --> F

  F["After all elements processed"] --> G["Apply accumulated changes to viewport:<br/><code>viewport.setAlwaysDrawn / viewport.setNeverDrawn</code>"]
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
  TITLE(["<code>clearAlwaysAndNeverDrawnElements</code>"]) --> A["Fetch from cache in parallel:<br/>1. Always drawn elements for model & categories <br/>2. Never drawn elements for model & categories"]

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- categoryIds: Id64Arg<br/> - modelId: Id64String</code>
  "\]

  A -- "alwaysDrawn" --> B1{"<code>viewport.alwaysDrawn?.size<br/> && alwaysDrawn.size </code>"}
  B1 -- Yes --> B2["<code style='display: block; text-align: left;'>viewport.setAlwaysDrawn({
    <code style='padding-left: 2rem'>elementIds: viewport.alwaysDrawn - alwaysDrawn</code>
  })</code>"]
  B1 -- No --> RESULT_Done
  B2 --> RESULT_Done

  A -- "neverDrawn" --> C1{"<code>viewport.neverDrawn?.size<br/> && neverDrawn.size </code>"}
  C1 -- Yes --> C2["<code style='display: block; text-align: left;'>viewport.setNeverDrawn({
    <code style='padding-left: 2rem'>elementIds: viewport.neverDrawn - neverDrawn</code>
  })</code>"]
  C1 -- No --> RESULT_Done
  C2 --> RESULT_Done
```

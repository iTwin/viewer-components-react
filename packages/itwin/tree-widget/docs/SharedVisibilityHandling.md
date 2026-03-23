<!-- cspell: ignore getcategoriesvisibilitystatus getmodelsvisibilitystatus getsubcategoriesvisibilitystatus getmodelwithcategoryvisibilitystatus getalwaysorneverdrawnvisibilitystatus -->

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
    <code style='text-align: left;'>- categoryId: **Id64String**<br/> - subCategoryIds: **Id64Arg**</code>
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

  M --> N[Some 'visible' && Some 'hidden' <br/> **OR** <br/> at least one is 'partial']

  %% Results
  N -- Yes --> RESULT_Partial

  N -- No --> O[All are 'visible']

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
    <code style='text-align: left;'>- modelIds: **Id64Arg**</code>
  "\]

  A -- modelId --> B{"<code>viewport.viewsModel(modelId)</code>"}

  %% Branch Yes
  B -- Yes --> C1[Get categories of elements which exist under modelId]
  C1 -- categoryIds --> D1["<code><a href='#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>({ modelId, categoryIds })</code>"]

  %% Branch No
  B -- No --> C2[Get modelled elements under modelId]
  C2 -- modelIds --> D2{"<code><a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</code> <br/> === 'hidden'/empty"}
  D2 -- Yes --> E1[hidden]
  D2 -- No --> E2[partial]

  %% Merge
  D1 --> M[Merge visibility statuses]
  E1 --> M
  E2 --> M

  M --> N[Some 'visible' && Some 'hidden' <br/> **OR** <br/> at least one is 'partial']

  N -- Yes --> RESULT_Partial

  N -- No --> O[All are 'visible']

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
    <code style='text-align: left;'>- modelId: **Id64String | undefined** <br/> - categoryIds: **Id64Arg**</code>
  "\]

  %% Branch Yes
  A -- Yes --> B[Iterate through categories]
  B -- categoryId --> C1[Get sub-categories for specified category from cache]
  B -- categoryId --> C2[Get models for specified category from cache]

  C1 -- subCategoryIds --> D1["<code><a href='#getsubcategoriesvisibilitystatus'>getSubCategoriesVisibilityStatus</a>({ subCategoryIds, categoryId })</code>"]

  C2 --> D2[Iterate through models]
  D2 -- modelId --> F["<code><a href='#getmodelwithcategoryvisibilitystatus'>getModelWithCategoryVisibilityStatus</a>({ modelId, categoryId })</code>"]

  %% Branch No
  A -- No --> B2[Iterate through categories]
  B2 -- categoryId --> F

  %% Merge
  D1 --> M[Merge visibility statuses]
  F --> M

  M --> N[Some 'visible' && Some 'hidden' <br/> **OR** <br/> at least one is 'partial']

  %% Results
  N -- Yes --> RESULT_Partial

  N -- No --> O[All are 'visible']

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
    <code style='text-align: left;'>- modelId: **Id64String**<br/> - categoryId: **Id64String**</code>
  "\]

  %% Branch A1
    A1 -- modelIds --> B["<code><a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</code>"]

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
          Per model category override === 'none'<br/> && <code>viewport.viewsCategory(props.categoryId)</code>
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
    <div style='text-align: left;'>- For **oppositeSet** elements execute query (if set changed after last execution), to get their models, categories and parent elements path. <br/> - Find always/never drawn child elements (nested as well) where queried data matches <code>props.modelId</code> & <code>props.categoryId</code>. <br/> - Get count of elements under model with category in **oppositeSet**: numberOfElementsInOppositeSet </div>
    "]

      G2 -- totalCount --> H["<code><a href='#getalwaysorneverdrawnvisibilitystatus'>getAlwaysOrNeverDrawnVisibilityStatus</a>({ totalCount, numberOfElementsInOppositeSet, defaultStatus })</code>"]
      G3 -- Pass down --> H


  %% Merge
  B --> M[Merge visibility statuses]
  C --> M
  H --> M
  G1 --> M

  M --> N[Some 'visible' && Some 'hidden' <br/> **OR** <br/> at least one is 'partial']

  %% Results
  N -- Yes --> RESULT_Partial

  N -- No --> O[All are 'visible']

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
  TITLE(["<code>getElementsVisibilityStatus</code>"]) --> A1["<div style='text-align: left;'> Get modelIds from cache: <br/> 1. <code>props.elementIds</code> which are sub-models <br/> 2. Children which are sub-models (nested as well) </div>"]
  TITLE(["<code>getElementsVisibilityStatus</code>"]) --> A2{"<code>viewport.viewsModel(props.modelId)</code>"}

  PROPS[\"
    <code>props</code>
    <code style='text-align: left;'>- elementIds: **Id64Arg**<br/> - modelId: **Id64String**<br/> - categoryId: **Id64String**<br/> - categoryOfTopMostParentElement: **Id64String**<br/> - parentElementIdsPath: **Array<Id64Arg>**<br/> - childrenCount: **number | undefined**</code>
  "\]

  %% Branch A1
    A1 -- modelIds --> B["<code><a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</code>"]

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
          Per model category override === 'none'<br/> && <code>viewport.viewsCategory(props.categoryId)</code>
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
      F -- Yes --> G2{"<code>props.childrenCount<br/> === 0 / undefined</code>"}

        %% Branch Yes
        G2 -- Yes --> H1[Children count in **oppositeSet** === 0]

        %% Branch No
        G2 -- No --> H2["Props
        <div style='text-align: left;'>- For **oppositeSet** elements execute query (if set changed after last execution), to get their models, categories and parent elements path. <br/> - Find always/never drawn child elements (nested as well) where queried data matches <code>props.modelId</code> & <code>props.categoryId</code> & <code>props.parentElementIdsPath</code>. <br/> - Get count of children in **oppositeSet**: numberOfElementsInOppositeSet </div>
        "]



      H1 -- Pass down --> I["**numberOfElementsInOppositeSet**: <code>props.elementIds</code> in oppositeSet and children count in oppositeSet <br/> **totalCount**: <code>props.elementIds</code> + <code>props.childrenCount</code>"]
      H2 -- Pass down --> I

      I -- Pass down --> J["<code><a href='#getalwaysorneverdrawnvisibilitystatus'>getAlwaysOrNeverDrawnVisibilityStatus</a>({ totalCount, numberOfElementsInOppositeSet, defaultStatus })</code>"]


  %% Merge
  B --> M[Merge visibility statuses]
  C --> M
  G1 --> M
  J --> M

  M --> N[Some 'visible' && Some 'hidden' <br/> **OR** <br/> at least one is 'partial']

  %% Results
  N -- Yes --> RESULT_Partial

  N -- No --> O[All are 'visible']

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
  TITLE(["<code>getAlwaysOrNeverDrawnVisibilityStatus</code>"]) --> A{"<code>props.totalCount === 0</code><br/>**OR**<br/><code>props.numberOfElementsInOppositeSet === 0</code>"}

  PROPS[\"
    <code>props</code>
    <code style='text-align: left; line-height: 1.2'>
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
    </code>
  "\]

  %% Branch Yes
  A -- Yes --> B1{"<code>props.defaultStatus === 'visible'</code>"}

    %% Branch Yes
    B1 -- Yes --> RESULT_Visible

    %% Branch No
    B1 -- No --> RESULT_Hidden

  %% Branch No
  A -- No --> B2{"<code>props.numberOfElementsInOppositeSet</code> <br/> === <code>props.totalCount</code>"}

    %% Branch No
    B2 -- No --> RESULT_Partial

    %% Branch Yes
    B2 -- Yes --> C{"<code>props.defaultStatus</code> <br/> === 'visible'"}

      %% Branch Yes
      C -- Yes --> RESULT_Hidden

      %% Branch No
      C -- No --> RESULT_Visible
```

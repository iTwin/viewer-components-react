<!-- cspell: ignore getcategoriesvisibilitystatus getmodelsvisibilitystatus getsubcategoriesvisibilitystatus getmodelwithcategoryvisibilitystatus getalwaysorneverdrawnvisibilitystatus -->

# Shared visibility handling

This document explains the shared parts of visibility handling in models, categories and classifications trees. Please read <a href='./Visibility.md#how-visibility-is-determined-in-the-viewport'>how visibility is determined in the viewport</a> before continuing.

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
  TITLE([getSubCategoriesVisibilityStatus]) --> A{"viewport.viewsCategory(<code>Props.categoryId</code>)"}

  PROPS[\"
    Props
    <div style='text-align: left;'>- categoryId: **Id64String** <br/> - subCategoryIds: **Id64Arg** </div>
  "\]

  %% Branch No
  A -- No --> RESULT_Hidden

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
  N -- Yes --> RESULT_Partial

  N -- No --> O[All are 'visible']

  O -- Yes --> RESULT_Visible
  O -- No --> RESULT_Hidden
```

### getModelsVisibilityStatus

Visibility of model is determined by merging visibility status of two parts:

1. Model selector. If model is not hidden in selector, need to check categories of child elements (they are retrieved from cache) by calling [getCategoriesVisibilityStatus](#getcategoriesvisibilitystatus).
2. Child elements' which are sub-models (retrieved from cache). For such elements call [getModelsVisibilityStatus](#getmodelsvisibilitystatus).

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
  TITLE([getModelsVisibilityStatus]) --> A[Iterate through <code>Props.modelIds</code>]

  PROPS[\"
    Props
    <div style='text-align: left;'>- modelIds: **Id64Arg**</div>
  "\]

  A -- modelId --> B{"viewport.viewsModel(modelId)"}

  %% Branch Yes
  B -- Yes --> C1[Get categories of elements which exist under modelId]
  C1 -- categoryIds --> D1["<a href='#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>({ modelId, categoryIds })"]

  %% Branch No
  B -- No --> C2[Get modelled elements under modelId]
  C2 -- modelIds --> D2{"<a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds }) <br/> === 'hidden'/empty"}
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

Allows getting category visibility under specific model (when modelId is defined in props) or to get generic category visibility.

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
  TITLE([getCategoriesVisibilityStatus]) --> A{<code>Props.modelId</code> <br/>=== undefined}

  PROPS[\"
    Props
    <div style='text-align: left;'>- modelId: **Id64String | undefined** <br/> - categoryIds: **Id64Arg**</div>
  "\]

  %% Branch Yes
  A -- Yes --> B[Iterate through categories]
  B -- categoryId --> C1[Get sub-categories for specified category from cache]
  B -- categoryId --> C2[Get models for specified category from cache]

  C1 -- subCategoryIds --> D1["<a href='#getsubcategoriesvisibilitystatus'>getSubCategoriesVisibilityStatus</a>({ subCategoryIds, categoryId })"]

  C2 --> D2[Iterate through models]
  D2 -- modelId --> F["<a href='#getmodelwithcategoryvisibilitystatus'>getModelWithCategoryVisibilityStatus</a>({ modelId, categoryId })"]

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
  1.  Getting total count of elements under the category with model.
  2.  Getting default child elements status based on per-model category override and category selector.
  3.  Get `opposite set` to default status: default status === `visible` -> `alwaysDrawn`, `neverDrawn` otherwise.
  4.  The `opposite set` can contain elements from any categories and models, need to query data of these elements and find the ones which are related to the desired category and model.
  5.  Once all the above data (1-4) is known, visibility can be determined by comparing the total count, number of elements (related to specific model and category) in the opposite set, and default status.

  **Note**: All the checks are done only when <a href='./Visibility.md#how-visibility-is-determined-in-the-viewport'>visibility rules</a> that have higher priority do not interfere (e.g. if model is hidden in selector, then always/never drawn elements are **not checked** and `hidden` is returned for `Child Elements` visibility).

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
  TITLE([getModelWithCategoryVisibilityStatus]) --> A1[Get modelled elements under category with model]
  TITLE([getModelWithCategoryVisibilityStatus]) --> A2{"viewport.viewsModel(<code>Props.modelId</code>)"}

  PROPS[\"
    Props
    <div style='text-align: left;'>- modelId: **Id64String** <br/> - categoryId: **Id64String**</div>
  "\]

  %% Branch A1
    A1 -- modelIds --> B["<a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })"]

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
          Per model category override === 'none'<br/> && viewport.viewsCategory(<code>Props.categoryId</code>)
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
    <div style='text-align: left;'>- For **oppositeSet** elements execute query (if set changed after last execution), to get their models, categories and parent elements path. <br/> - Find always/never drawn child elements (nested as well) where queried data matches <code>Props.modelId</code> & <code>Props.categoryId</code>. <br/> - Get count of elements under model with category in **oppositeSet**: numberOfElementsInOppositeSet </div>
    "]

      G2 -- totalCount --> H["<a href='#getalwaysorneverdrawnvisibilitystatus'>getAlwaysOrNeverDrawnVisibilityStatus</a>({ totalCount, numberOfElementsInOppositeSet, defaultStatus })"]
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
  TITLE([getElementsVisibilityStatus]) --> A1["<div style='text-align: left;'> Get modelIds from cache: <br/> 1. <code>Props.elementIds</code> which are sub-models <br/> 2. Children which are sub-models (nested as well) </div>"]
  TITLE([getElementsVisibilityStatus]) --> A2{"viewport.viewsModel(<code>Props.modelId</code>)"}

  PROPS[\"
    Props
    <div style='text-align: left;'>- elementIds: **Id64Arg** <br/> - modelId: **Id64String** <br/> - categoryId: **Id64String** <br/> - categoryOfTopMostParentElement: **Id64String** <br/> - parentElementIdsPath: **Array<Id64Arg>** <br/> - childrenCount: **number | undefined**</div>
  "\]

  %% Branch A1
    A1 -- modelIds --> B["<a href='#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })"]

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
          Per model category override === 'none'<br/> && viewport.viewsCategory(<code>Props.categoryId</code>)
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
      F -- Yes --> G2{"<code>Props.childrenCount</code> <br/> === 0 / undefined"}

        %% Branch Yes
        G2 -- Yes --> H1[Children count in oppositeSet === 0]

        %% Branch No
        G2 -- No --> H2["Props
        <div style='text-align: left;'>- For **oppositeSet** elements execute query (if set changed after last execution), to get their models, categories and parent elements path. <br/> - Find always/never drawn child elements (nested as well) where queried data matches <code>Props.modelId</code> & <code>Props.categoryId</code> & <code>Props.parentElementIdsPath</code>. <br/> - Get count of children in **oppositeSet**: numberOfElementsInOppositeSet </div>
        "]



      H1 -- Pass down --> I["**numberOfElementsInOppositeSet**: <code>Props.elementIds</code> in oppositeSet and children count in oppositeSet <br/> **totalCount**: <code>Props.elementIds</code> + <code>Props.childrenCount</code>"]
      H2 -- Pass down --> I

      I -- Pass down --> J["<a href='#getalwaysorneverdrawnvisibilitystatus'>getAlwaysOrNeverDrawnVisibilityStatus</a>({ totalCount, numberOfElementsInOppositeSet, defaultStatus })"]


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
  TITLE([getAlwaysOrNeverDrawnVisibilityStatus]) --> A{"<code>Props.totalCount</code> <br/> === 0 <br/> **OR** <br/> <code>Props.numberOfElementsInOppositeSet</code> <br/> === 0"}

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
  A -- Yes --> B1{"<code>Props.defaultStatus</code> <br/> === 'visible'"}

    %% Branch Yes
    B1 -- Yes --> RESULT_Visible

    %% Branch No
    B1 -- No --> RESULT_Hidden

  %% Branch No
  A -- No --> B2{"<code>Props.numberOfElementsInOppositeSet</code> <br/> === <code>Props.totalCount</code>"}

    %% Branch No
    B2 -- No --> RESULT_Partial

    %% Branch Yes
    B2 -- Yes --> C{"<code>Props.defaultStatus</code> <br/> === 'visible'"}

      %% Branch Yes
      C -- Yes --> RESULT_Hidden

      %% Branch No
      C -- No --> RESULT_Visible
```

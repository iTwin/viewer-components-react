<!-- cspell: ignore getcategoriesvisibilitystatus getdefinitioncontainersvisibilitystatus getsubcategoriesvisibilitystatus getelementsvisibilitystatus changedefinitioncontainersvisibilitystatus changesubcategoriesvisibilitystatus enablecategorywithout enablingothercategories changegroupedelementsvisibilitystatus changecategoriesvisibilitystatus changeelementsvisibilitystatus enablecategorywithoutenablingothercategories -->

# Categories tree specific visibility handling

This document explains visibility handling for categories tree specific cases.

## Table of contents

- [Getting visibility status](#getting-visibility-status)
  - [getDefinitionContainersVisibilityStatus](#getdefinitioncontainersvisibilitystatus)
  - [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus)
  - [getSubCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getsubcategoriesvisibilitystatus)
  - [getElementsVisibilityStatus](./SharedVisibilityHandling.md#getelementsvisibilitystatus)
- [Changing visibility status](#changing-visibility-status)
  - [changeDefinitionContainersVisibilityStatus](#changedefinitioncontainersvisibilitystatus)
  - [changeSubCategoriesVisibilityStatus](#changesubcategoriesvisibilitystatus)
  - [enableCategoryWithoutEnablingOtherCategories](#enablecategorywithoutenablingothercategories)
  - [changeGroupedElementsVisibilityStatus](#changegroupedelementsvisibilitystatus)
  - [changeCategoriesVisibilityStatus](./SharedVisibilityHandling.md#changecategoriesvisibilitystatus)
  - [changeElementsVisibilityStatus](./SharedVisibilityHandling.md#changeelementsvisibilitystatus)

## Getting visibility status

### getDefinitionContainersVisibilityStatus

To determine definition containers' visibility status, get their child categories from cache and call [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus).

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
  TITLE(["<code>getDefinitionContainersVisibilityStatus</code>"]) --> A["Get categories under <code>props.definitionContainerIds</code> from cache. These are categories whose modelId is the same as definition container or categories of child definition containers (can be nested)"]

  PROPS[\"
    <code>props</code>
    <div style='text-align: left;'>- definitionContainerIds: **Id64Arg**</div>
  "\]

  A -- categoryIds --> B["<code><a href='./SharedVisibilityHandling.md#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>({ categoryIds, modelId: undefined })</code>"]

  %% Results
  B -- partial --> RESULT_Partial
  B -- visible --> RESULT_Visible
  B -- hidden --> RESULT_Hidden
```

## Changing visibility status

### changeDefinitionContainersVisibilityStatus

Changes definition containers' visibility status by propagating the change to all contained categories.

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
  TITLE(["<code>changeDefinitionContainersVisibilityStatus</code>"]) --> A["Get categories under <code>props.definitionContainerIds</code> from cache. These are categories whose modelId is the same as definition container or categories of child definition containers (can be nested)"]

  PROPS[\"
    <code>props</code>
    <code style='text-align: left;'>- definitionContainerIds: **Id64Arg**<br/>- on: **boolean**</code>
  "\]

  A -- categoryIds --> B["<code><a href='./SharedVisibilityHandling.md#changecategoriesvisibilitystatus'>changeCategoriesVisibilityStatus</a>({ categoryIds, modelId: undefined, on })</code>"]
  B --> RESULT_Done
```

### changeSubCategoriesVisibilityStatus

Changes sub-categories' visibility. When turning on, first ensures the parent category and its related models are enabled without affecting other categories.

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
  TITLE(["<code>changeSubCategoriesVisibilityStatus</code>"]) --> A{"<code>props.on</code>"}

  PROPS[\"
    <code>props</code>
    <code style='text-align: left;'>- categoryId: **Id64String**<br/>- subCategoryIds: **Id64Arg**<br/>- on: **boolean**</code>
  "\]

  %% Branch on=true
  A -- true --> B["<code><a href='#enablecategorywithoutenablingothercategories'>enableCategoryWithoutEnablingOtherCategories</a>(props.categoryId)</code>"]
  B --> C["For each subCategoryId:<br/><code>viewport.changeSubCategoryDisplay({ subCategoryId, display: true })</code>"]

  %% Branch on=false
  A -- false --> D["For each subCategoryId:<br/><code>viewport.changeSubCategoryDisplay({ subCategoryId, display: false })</code>"]

  C --> RESULT_Done
  D --> RESULT_Done
```

### enableCategoryWithoutEnablingOtherCategories

Turns on a category and its related models while preserving the hidden state of all other categories in those models. Used internally when enabling a sub-category.

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
  TITLE(["<code>enableCategoryWithoutEnablingOtherCategories</code>"]) --> A["<code>viewport.changeCategoryDisplay({ categoryIds: categoryId, display: true })</code>"]

  PROPS[\"
    <code>props</code>
    <code style='text-align: left;'>- categoryId: **Id64String**</code>
  "\]

  A --> B["Get all models for <code>categoryId</code> from cache (including sub-models)"]
  B -- modelIds --> C["Iterate through models"]
  C -- modelId --> D1["<code>viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: categoryId, override: 'none' })</code>"]
  C -- modelId --> D2{"<code>viewport.viewsModel(modelId)</code>"}

  D1 --> RESULT_Done

  D2 -- Yes --> RESULT_Done
  D2 -- No --> E1["Get all categories for modelId from cache."]
  D2 -- No --> E2["Collect hidden models"]
  E1 -- modelCategoryIds --> F["Iterate through model categories"]
  F -- modelCategoryId --> G["<code>modelCategoryId !== categoryId <br/> && <br/> viewport.setPerModelCategoryOverride({ modelIds: modelId, categoryIds: otherCategoryId, override: 'hide' })</code>"]
  G --> RESULT_Done
  E2 -- hiddenModels --> H["<code>viewport.changeModelDisplay({ modelIds: hiddenModels, display: true })</code>"]
  H --> RESULT_Done
```

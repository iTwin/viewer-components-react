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
  TITLE(["<span style='font-family: monospace;'>getDefinitionContainersVisibilityStatus</span>"]) --> A["Get categories under <span style='font-family: monospace;'>props.definitionContainerIds</span> from cache. These are categories whose modelId is the same as definition container or categories of child definition containers (can be nested)"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- definitionContainerIds: Id64Arg</span>
  "\]


  A -- categoryIds --> B["<div style='text-align: left; font-family: monospace;'><a href='./SharedVisibilityHandling.md#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>categoryIds,</span>
    <span style='padding-left: 2rem;'>modelId: undefined</span>
    })</div>"]

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
  TITLE(["<span style='font-family: monospace;'>changeDefinitionContainersVisibilityStatus</span>"]) --> A["Get categories under <span style='font-family: monospace;'>props.definitionContainerIds</span> from cache. These are categories whose modelId is the same as definition container or categories of child definition containers (can be nested)"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- definitionContainerIds: Id64Arg<br/>- on: boolean</span>
  "\]

  A -- categoryIds --> B["<div style='text-align: left; font-family: monospace;'><a href='./SharedVisibilityHandling.md#changecategoriesvisibilitystatus'>changeCategoriesVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>categoryIds,</span>
    <span style='padding-left: 2rem;'>modelId: undefined,</span>
    <span style='padding-left: 2rem;'>on</span>
    })</div>"]
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
  TITLE(["<span style='font-family: monospace;'>changeSubCategoriesVisibilityStatus</span>"]) --> A{"<span style='font-family: monospace;'>props.on</span>"}

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- categoryId: Id64String<br/>- subCategoryIds: Id64Arg<br/>- on: boolean</span>
  "\]

  %% Branch on=true
  A -- true --> B["<span style='font-family: monospace;'><a href='#enablecategorywithoutenablingothercategories'>enableCategoryWithoutEnablingOtherCategories</a>(props.categoryId)</span>"]
  B --> C["Iterate through sub-categories"]
  C -- subCategoryId --> C1["<div style='text-align: left; font-family: monospace;'>viewport.changeSubCategoryDisplay({
    <span style='padding-left: 2rem;'>subCategoryId,</span>
    <span style='padding-left: 2rem;'>display: true</span>
    })</div>"]

  %% Branch on=false
  A -- false --> D["Iterate through sub-categories"]
  D -- subCategoryId --> D1["<div style='text-align: left; font-family: monospace;'>viewport.changeSubCategoryDisplay({
    <span style='padding-left: 2rem;'>subCategoryId,</span>
    <span style='padding-left: 2rem;'>display: false</span>
    })</div>"]

  C1 --> RESULT_Done
  D1 --> RESULT_Done
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
  TITLE(["<span style='font-family: monospace;'>enableCategoryWithoutEnablingOtherCategories</span>"]) --> A["<span style='font-family: monospace;'>viewport.changeCategoryDisplay({ categoryIds: categoryId, display: true })</span>"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- categoryId: Id64String</span>
  "\]

  A --> B["Get all models for <span style='font-family: monospace;'>categoryId</span> from cache (including sub-models)"]
  B -- modelIds --> C["Iterate through models"]
  C -- modelId --> D1["<div style='text-align: left; font-family: monospace;'>viewport.setPerModelCategoryOverride({
    <span style='padding-left: 2rem;'>modelIds: modelId,</span>
    <span style='padding-left: 2rem;'>categoryIds: categoryId,</span>
    <span style='padding-left: 2rem;'>override: 'none'</span>
    })</div>"]
  C -- modelId --> D2{"<span style='font-family: monospace;'>viewport.viewsModel(modelId)</span>"}

  D1 --> RESULT_Done

  D2 -- Yes --> RESULT_Done
  D2 -- No --> E1["Get all categories for <span style='font-family: monospace;'>modelId</span> from cache."]
  D2 -- No --> E2["Collect hidden models"]
  E1 -- modelCategoryIds --> F["Iterate through model categories"]
  F -- modelCategoryId --> G{"<span style='font-family: monospace;'>modelCategoryId === categoryId </span>"}
  G -- No --> G1["<div style='text-align: left; font-family: monospace;'>viewport.setPerModelCategoryOverride({
    <span style='padding-left: 2rem;'>modelIds: modelId,</span>
    <span style='padding-left: 2rem;'>categoryIds: otherCategoryId,</span>
    <span style='padding-left: 2rem;'>override: 'hide'</span>
    })</div>"]
    G1 --> RESULT_Done
  G -- Yes --> RESULT_Done
  E2 -- hiddenModels --> H["<div style='text-align: left; font-family: monospace;'>viewport.changeModelDisplay({
    <span style='padding-left: 2rem;'>modelIds: hiddenModels,</span>
    <span style='padding-left: 2rem;'>display: true</span>
    })</div>"]
  H --> RESULT_Done
```

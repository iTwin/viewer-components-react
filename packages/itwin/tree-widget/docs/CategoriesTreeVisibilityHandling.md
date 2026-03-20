<!-- cspell: ignore getcategoriesvisibilitystatus getdefinitioncontainersvisibilitystatus getsubcategoriesvisibilitystatus getelementsvisibilitystatus -->

# Categories tree specific visibility handling

This document explains visibility handling for categories tree specific cases.

## Table of contents

- [Getting visibility status](#getting-visibility-status)
  - [getDefinitionContainersVisibilityStatus](#getdefinitioncontainersvisibilitystatus)
  - [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus)
  - [getSubCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getsubcategoriesvisibilitystatus)
  - [getElementsVisibilityStatus](./SharedVisibilityHandling.md#getelementsvisibilitystatus)

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

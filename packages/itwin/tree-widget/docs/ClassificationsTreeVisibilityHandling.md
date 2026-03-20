<!-- cspell: ignore getclassificationtablesvisibilitystatus getclassificationsvisibilitystatus getcategoriesvisibilitystatus getelementsvisibilitystatus -->

# Classifications tree specific visibility handling

This document explains visibility handling for classifications tree specific cases.

## Table of contents

- [Getting visibility status](#getting-visibility-status)
  - [getClassificationTablesVisibilityStatus](#getclassificationtablesvisibilitystatus)
  - [getClassificationsVisibilityStatus](#getclassificationsvisibilitystatus)
  - [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus)
  - [getElementsVisibilityStatus](./SharedVisibilityHandling.md#getelementsvisibilitystatus)

## Getting visibility status

### getClassificationTablesVisibilityStatus

To determine classification tables' visibility status, get their child categories from cache and call [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus).

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
  TITLE(["<code>getClassificationTablesVisibilityStatus</code>"]) --> A["Get categories under <code>props.classificationTableIds</code> from cache. These are categories of child classifications (can be nested)"]

  PROPS[\"
    <code>props</code>
    <div style='text-align: left;'>- classificationTableIds: **Id64Arg**</div>
  "\]

  A -- categoryIds --> B["<code><a href='./SharedVisibilityHandling.md#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>({ categoryIds, modelId: undefined })</code>"]

  %% Results
  B -- partial --> RESULT_Partial
  B -- visible --> RESULT_Visible
  B -- hidden --> RESULT_Hidden
```

### getClassificationsVisibilityStatus

To determine classifications' visibility status, get their child categories from cache and call [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus).

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
  TITLE(["<code>getClassificationsVisibilityStatus</code>"]) --> A["Get categories under <code>props.classificationIds</code> from cache. These are related categories and categories of child classifications (can be nested)"]

  PROPS[\"
    <code>props</code>
    <div style='text-align: left;'>- classificationIds: **Id64Arg**</div>
  "\]

  A -- categoryIds --> B["<code><a href='./SharedVisibilityHandling.md#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>({ categoryIds, modelId: undefined })</code>"]

  %% Results
  B -- partial --> RESULT_Partial
  B -- visible --> RESULT_Visible
  B -- hidden --> RESULT_Hidden
```

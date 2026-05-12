<!-- cspell: ignore getclassificationtablesvisibilitystatus getclassificationsvisibilitystatus getcategoriesvisibilitystatus getelementsvisibilitystatus changeclassificationtablesvisibilitystatus changeclassificationsvisibilitystatus changecategoriesvisibilitystatus -->

# Classifications tree specific visibility handling

This document explains visibility handling for classifications tree specific cases.

## Table of contents

- [Getting visibility status](#getting-visibility-status)
  - [getClassificationTablesVisibilityStatus](#getclassificationtablesvisibilitystatus)
  - [getClassificationsVisibilityStatus](#getclassificationsvisibilitystatus)
  - [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus)
  - [getElementsVisibilityStatus](./SharedVisibilityHandling.md#getelementsvisibilitystatus)
- [Changing visibility status](#changing-visibility-status)
  - [changeClassificationTablesVisibilityStatus](#changeclassificationtablesvisibilitystatus)
  - [changeClassificationsVisibilityStatus](#changeclassificationsvisibilitystatus)
  - [changeCategoriesVisibilityStatus](./SharedVisibilityHandling.md#changecategoriesvisibilitystatus)

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
  TITLE(["<span style='font-family: monospace;'>getClassificationTablesVisibilityStatus</span>"]) --> A["Get categories under <span style='font-family: monospace;'>props.classificationTableIds</span> from cache. These are categories of child classifications (can be nested)"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- classificationTableIds: Id64Arg</span>
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
  TITLE(["<span style='font-family: monospace;'>getClassificationsVisibilityStatus</span>"]) --> A["Get categories under <span style='font-family: monospace;'>props.classificationIds</span> from cache. These are related categories and categories of child classifications (can be nested)"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- classificationIds: Id64Arg</span>
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

### changeClassificationTablesVisibilityStatus

Changes classification tables' visibility status by propagating the change to all contained categories.

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
  TITLE(["<span style='font-family: monospace;'>changeClassificationTablesVisibilityStatus</span>"]) --> A["Get categories under <span style='font-family: monospace;'>props.classificationTableIds</span> from cache. These are categories of child classifications (can be nested)"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- classificationTableIds: Id64Arg<br/>- on: boolean</span>
  "\]

  A -- categoryIds --> B["<div style='text-align: left; font-family: monospace;'><a href='./SharedVisibilityHandling.md#changecategoriesvisibilitystatus'>changeCategoriesVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>categoryIds,</span>
    <span style='padding-left: 2rem;'>modelId: undefined,</span>
    <span style='padding-left: 2rem;'>on</span>
    })</div>"]
  B --> RESULT_Done
```

### changeClassificationsVisibilityStatus

Changes classifications' visibility status by propagating the change to all contained categories.

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
  TITLE(["<span style='font-family: monospace;'>changeClassificationsVisibilityStatus</span>"]) --> A["Get categories under <span style='font-family: monospace;'>props.classificationIds</span> from cache. These are related categories and categories of child classifications (can be nested)"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- classificationIds: Id64Arg<br/>- on: boolean</span>
  "\]

  A -- categoryIds --> B["<div style='text-align: left; font-family: monospace;'><a href='./SharedVisibilityHandling.md#changecategoriesvisibilitystatus'>changeCategoriesVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>categoryIds,</span>
    <span style='padding-left: 2rem;'>modelId: undefined,</span>
    <span style='padding-left: 2rem;'>on</span>
    })</div>"]
  B --> RESULT_Done
```

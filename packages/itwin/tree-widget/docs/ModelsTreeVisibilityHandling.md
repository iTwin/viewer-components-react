<!-- cspell: ignore getsubjectsvisibilitystatus getmodelsvisibilitystatus getcategoriesvisibilitystatus getelementsvisibilitystatus changesubjectsvisibilitystatus changegroupedelementsvisibilitystatus changemodelsvisibilitystatus changeelementsvisibilitystatus -->

# Models tree specific visibility handling

This document explains visibility handling for models tree specific cases.

## Table of contents

- [Getting visibility status](#getting-visibility-status)
  - [getSubjectsVisibilityStatus](#getsubjectsvisibilitystatus)
  - [getModelsVisibilityStatus](./SharedVisibilityHandling.md#getmodelsvisibilitystatus)
  - [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus)
  - [getElementsVisibilityStatus](./SharedVisibilityHandling.md#getelementsvisibilitystatus)
- [Changing visibility status](#changing-visibility-status)
  - [changeSubjectsVisibilityStatus](#changesubjectsvisibilitystatus)
  - [changeGroupedElementsVisibilityStatus](#changegroupedelementsvisibilitystatus)
  - [changeModelsVisibilityStatus](./SharedVisibilityHandling.md#changemodelsvisibilitystatus)
  - [changeCategoriesVisibilityStatus](./SharedVisibilityHandling.md#changecategoriesvisibilitystatus)
  - [changeElementsVisibilityStatus](./SharedVisibilityHandling.md#changeelementsvisibilitystatus)

## Getting visibility status

### getSubjectsVisibilityStatus

To determine subjects' visibility status, get their child models from cache and call [getModelsVisibilityStatus](./SharedVisibilityHandling.md#getmodelsvisibilitystatus).

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
  TITLE("<code>getSubjectsVisibilityStatus</code>") --> A["Get models under <code>props.subjectIds</code> from cache. These are related models and models of child subjects (can be nested)"]

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- subjectIds: Id64Arg</code>
  "\]

  A -- modelIds --> B["<code><a href='./SharedVisibilityHandling.md#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</code>"]

  %% Results
  B -- partial --> RESULT_Partial
  B -- visible --> RESULT_Visible
  B -- hidden --> RESULT_Hidden
```

## Changing visibility status

### changeSubjectsVisibilityStatus

Changes subjects' visibility status by propagating the change to all related models.

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
  TITLE(["<code>changeSubjectsVisibilityStatus</code>"]) --> A["Get models under <code>props.subjectIds</code> from cache. These are related models and models of child subjects (can be nested)"]

  PROPS[\"
    <code>props</code>
    <code style='display: block; text-align: left;'>- subjectIds: Id64Arg<br/>- on: boolean</code>
  "\]

  A -- modelIds --> B["<code style='display: block; text-align: left;'><a href='./SharedVisibilityHandling.md#changemodelsvisibilitystatus'>changeModelsVisibilityStatus</a>({
    <code style='padding-left: 2rem'>modelIds,</code>
    <code style='padding-left: 2rem'>on</code>
  })</code>"]
  B --> RESULT_Done
```

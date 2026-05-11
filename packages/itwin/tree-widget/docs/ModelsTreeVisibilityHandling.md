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
  TITLE("<span style='font-family: monospace;'>getSubjectsVisibilityStatus</span>") --> A["Get models under <span style='font-family: monospace;'>props.subjectIds</span> from cache. These are related models and models of child subjects (can be nested)"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- subjectIds: Id64Arg</span>
  "\]

  A -- modelIds --> B["<span style='font-family: monospace;'><a href='./SharedVisibilityHandling.md#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</span>"]

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
  TITLE(["<span style='font-family: monospace;'>changeSubjectsVisibilityStatus</span>"]) --> A["Get models under <span style='font-family: monospace;'>props.subjectIds</span> from cache. These are related models and models of child subjects (can be nested)"]

  PROPS[\"
    <span style='font-family: monospace;'>props</span>
    <span style='display: block; text-align: left; font-family: monospace;'>- subjectIds: Id64Arg<br/>- on: boolean</span>
  "\]

  A -- modelIds --> B["<div style='text-align: left; font-family: monospace;'><a href='./SharedVisibilityHandling.md#changemodelsvisibilitystatus'>changeModelsVisibilityStatus</a>({
    <span style='padding-left: 2rem;'>modelIds,</span>
    <span style='padding-left: 2rem;'>on</span>
    })</div>"]
  B --> RESULT_Done
```

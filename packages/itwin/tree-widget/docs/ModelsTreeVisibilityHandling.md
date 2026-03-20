<!-- cspell: ignore getsubjectsvisibilitystatus getmodelsvisibilitystatus getcategoriesvisibilitystatus getelementsvisibilitystatus -->

# Models tree specific visibility handling

This document explains visibility handling for models tree specific cases.

## Table of contents

- [Getting visibility status](#getting-visibility-status)
  - [getSubjectsVisibilityStatus](#getsubjectsvisibilitystatus)
  - [getModelsVisibilityStatus](./SharedVisibilityHandling.md#getmodelsvisibilitystatus)
  - [getCategoriesVisibilityStatus](./SharedVisibilityHandling.md#getcategoriesvisibilitystatus)
  - [getElementsVisibilityStatus](./SharedVisibilityHandling.md#getelementsvisibilitystatus)

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

  PROPS[\"<code>props</code>
    <div style='text-align: left;'>- subjectIds: **Id64Arg**</div>
  "\]

  A -- modelIds --> B["<code><a href='./SharedVisibilityHandling.md#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })</code>"]

  %% Results
  B -- partial --> RESULT_Partial
  B -- visible --> RESULT_Visible
  B -- hidden --> RESULT_Hidden
```

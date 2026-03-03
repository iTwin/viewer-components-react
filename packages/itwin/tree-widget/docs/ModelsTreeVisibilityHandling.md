<!-- cspell: ignore getmodelsvisibilitystatus -->

# Models tree specific visibility handling

This document explains visibility handling for models tree specific cases.

## Getting visibility status

### getSubjectsVisibilityStatus

To determine subjects' visibility status, get their child models from cache and call <a href='./SharedVisibilityHandling.md#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>.

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
  TITLE(getSubjectsVisibilityStatus) --> A["Get models under <code>Props.subjectIds</code> from cache. These are related models and models of child subjects (can be nested)"]

  PROPS[\"Props
    <div style='text-align: left;'>- subjectIds: **Id64Arg**</div>
  "\]

  A -- modelIds --> B["<a href='./SharedVisibilityHandling.md#getmodelsvisibilitystatus'>getModelsVisibilityStatus</a>({ modelIds })"]

  %% Results
  B -- partial --> RESULT_Partial
  B -- visible --> RESULT_Visible
  B -- hidden --> RESULT_Hidden
```

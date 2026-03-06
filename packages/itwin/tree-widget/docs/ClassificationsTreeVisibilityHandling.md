<!-- cspell: ignore getcategoriesvisibilitystatus -->

# Classifications tree specific visibility handling

This document explains visibility handling for classifications tree specific cases.

## Getting visibility status

### getClassificationTablesVisibilityStatus

To determine classification tables' visibility status, get their child categories from cache and call <a href='./SharedVisibilityHandling.md#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>.

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
  TITLE([getClassificationTablesVisibilityStatus]) --> A["Get categories under <code>Props.classificationTableIds</code> from cache. These are categories of child classifications (can be nested)"]

  PROPS[\"
    Props
    <div style='text-align: left;'>- classificationTableIds: **Id64Arg**</div>
  "\]

  A -- categoryIds --> B["<a href='./SharedVisibilityHandling.md#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>({ categoryIds, modelId: undefined })"]

  %% Results
  B -- partial --> RESULT_Partial
  B -- visible --> RESULT_Visible
  B -- hidden --> RESULT_Hidden
```

### getClassificationsVisibilityStatus

To determine classifications' visibility status, get their child categories from cache and call <a href='./SharedVisibilityHandling.md#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>.

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
  TITLE([getClassificationsVisibilityStatus]) --> A["Get categories under <code>Props.classificationIds</code> from cache. These are related categories and categories of child classifications (can be nested)"]

  PROPS[\"
    Props
    <div style='text-align: left;'>- classificationIds: **Id64Arg**</div>
  "\]

  A -- categoryIds --> B["<a href='./SharedVisibilityHandling.md#getcategoriesvisibilitystatus'>getCategoriesVisibilityStatus</a>({ categoryIds, modelId: undefined })"]

  %% Results
  B -- partial --> RESULT_Partial
  B -- visible --> RESULT_Visible
  B -- hidden --> RESULT_Hidden
```

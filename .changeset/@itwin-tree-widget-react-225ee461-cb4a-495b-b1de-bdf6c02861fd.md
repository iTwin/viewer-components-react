---
"@itwin/tree-widget-react": major
---

Reorganized hierarchy configuration properties by node type. For categories, replace `hideSubCategories` with `subCategories.nodes`, `showElements` with `elements.nodes`, `showEmptyCategories` with `categories.withoutElements`, and `excludedElementClassNames` with `elements.excludedClasses`. For models, replace `hideRootSubject` with `subjects.root`, `showEmptyModels` with `models.withoutElements`, `elementClassSpecification` with `elements.baseClass`, `elementClassGrouping` with `elements.classGrouping`, and `excludedElementClassNames` with `elements.excludedClasses`; the `enableWithCounts` grouping value is now `enable-with-counts`. For classifications, replace `excludedElementClassNames` with `elements.excludedClasses`. Omitted settings retain the previous defaults. EC class name settings, including `ClassificationToCategoriesRelationshipSpecification.fullClassName`, now require dot notation.

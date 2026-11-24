---
"@itwin/tree-widget-react": minor
---

Models and categories tree header buttons now become available much faster on large iModels. Previously, they stayed disabled until the trees finished loading information about which models and categories contain elements.

`useModelsTreeButtonProps` and `useCategoriesTreeButtonProps` now also return `isLoaded`, which tells whether the models and categories used by the header buttons have been loaded. Use it to show a placeholder until the buttons are ready, even when the iModel has no models or categories:

```tsx
const { buttonProps, isLoaded } = useModelsTreeButtonProps({ imodel, viewport });
const buttons = isLoaded ? [<ModelsTreeComponent.ShowAllButton {...buttonProps} key="show-all" />] : [<Skeleton key="show-all" />];
```

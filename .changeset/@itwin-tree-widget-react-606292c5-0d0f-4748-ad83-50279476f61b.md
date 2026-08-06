---
"@itwin/tree-widget-react": patch
---

Changed props of `CategoriesTreeComponent`, `ClassificationsTreeComponent` and `ModelsTreeComponent` to accept an optional viewport of `TreeWidgetViewport` type, that would be used instead of the active AppUI's viewport. Also, changed props of other components that used to take `Viewport` to now take `TreeWidgetViewport` instead. Use the new `createTreeWidgetViewport` function to create `TreeWidgetViewport` from `Viewport`.

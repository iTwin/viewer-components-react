---
"@itwin/tree-widget-react": minor
---

Preload tree caches on root node expansion.

Added an optional `onNodeExpanded` callback to `Tree` for reacting to node expansion events. The `useModelsTree`, `useCategoriesTree`, and `useClassificationsTree` hooks now expose this callback.

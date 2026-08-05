---
"@itwin/tree-widget-react": major
---

Exposed ability to render tree actions in context menu. BREAKING: `getInlineActions` and `getMenuActions` takes in `{ targetNode: PresentationHierarchyNode, selectedNodes: PresentationHierarchyNode[] }` as a first argument instead of `PresentationHierarchyNode` to match the new API in `@itwin/presentation-hierarchies-react`.

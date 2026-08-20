---
"@itwin/tree-widget-react": major
---

Replace `TreeWidget.initialize()` and direct use of `SharedTreeContextProvider` with a single `TreeWidgetContextProvider` near the root of the application. The provider supplies localization, logging, and shared tree resources to every tree below it. Continue registering `LOCALIZATION_NAMESPACES` during application startup. Applications using `createTreeWidget` can continue passing `localization` and `logger` to that function; it adds `TreeWidgetContextProvider` at the widget scope automatically.

`onFeatureUsed` has also been removed from `TreeToolbarButtonProps`. For custom trees, provide `onFeatureUsed` and `onPerformanceMeasured` through a `TelemetryContextProvider` that wraps the tree and any directly rendered header buttons. Standard tree components continue to accept the callbacks directly.

Before:

```tsx
import {
  CategoriesTreeComponent,
  LOCALIZATION_NAMESPACES,
  LocalizationContextProvider,
  ModelsTreeComponent,
  SelectableTree,
  SharedTreeContextProvider,
  TelemetryContextProvider,
  TreeWidget,
  useCategoriesTree,
  useCategoriesTreeButtonProps,
  VisibilityTree,
} from "@itwin/tree-widget-react";

for (const namespace of LOCALIZATION_NAMESPACES) {
  await IModelApp.localization.registerNamespace(namespace);
}

await TreeWidget.initialize(logger);

function App() {
  return (
    <LocalizationContextProvider localization={IModelApp.localization}>
      <SharedTreeContextProvider>
        <ModelsTreeComponent treeLabel="Models tree" selectionStorage={selectionStorage} />
        <TelemetryContextProvider componentIdentifier="my-tree" onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
          <MyTree />
        </TelemetryContextProvider>
      </SharedTreeContextProvider>
    </LocalizationContextProvider>
  );
}

function MyTree() {
  const { buttonProps } = useCategoriesTreeButtonProps({ viewport });
  const { treeProps } = useCategoriesTree({ activeView });

  return (
    <SelectableTree buttons={[<CategoriesTreeComponent.ShowAllButton {...buttonProps} onFeatureUsed={onFeatureUsed} key="show-all" />]}>
      <VisibilityTree {...treeProps} />
    </SelectableTree>
  );
}
```

After:

```tsx
import {
  CategoriesTreeComponent,
  LOCALIZATION_NAMESPACES,
  ModelsTreeComponent,
  SelectableTree,
  TelemetryContextProvider,
  TreeWidgetContextProvider,
  useCategoriesTree,
  useCategoriesTreeButtonProps,
  VisibilityTree,
} from "@itwin/tree-widget-react";

for (const namespace of LOCALIZATION_NAMESPACES) {
  await IModelApp.localization.registerNamespace(namespace);
}

function App() {
  return (
    <TreeWidgetContextProvider localization={IModelApp.localization} logger={logger}>
      <ModelsTreeComponent treeLabel="Models tree" selectionStorage={selectionStorage} />

      <TelemetryContextProvider componentIdentifier="my-tree" onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
        <MyTree />
      </TelemetryContextProvider>
    </TreeWidgetContextProvider>
  );
}

function MyTree() {
  const { buttonProps, onCategoriesFiltered } = useCategoriesTreeButtonProps({ viewport });
  const { treeProps } = useCategoriesTree({ activeView, onCategoriesFiltered });

  return (
    <SelectableTree buttons={[<CategoriesTreeComponent.ShowAllButton {...buttonProps} key="show-all" />]}>
      <VisibilityTree {...treeProps} />
    </SelectableTree>
  );
}
```

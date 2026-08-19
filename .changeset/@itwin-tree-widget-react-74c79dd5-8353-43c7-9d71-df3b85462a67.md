---
"@itwin/tree-widget-react": major
---

Replace `TreeWidget.initialize()` and direct use of `SharedTreeContextProvider` with a single `TreeWidgetContextProvider` near the root of the application. The provider supplies localization, logging, and shared tree resources to every tree below it. Continue registering `LOCALIZATION_NAMESPACES` during application startup. Applications using `createTreeWidget` can continue passing `localization` and `logger` to that function; it adds `TreeWidgetContextProvider` at the widget scope automatically.

Telemetry is now scoped separately:

- Standard tree components create their own telemetry context. Pass `onFeatureUsed` and `onPerformanceMeasured` directly to each standard tree component.
- Custom trees composed from `use*Tree` hooks do not create a telemetry context. Wrap the custom tree and any directly rendered header buttons with `TelemetryContextProvider` so they report through the same callbacks and `componentIdentifier`.
- `onFeatureUsed` has been removed from `TreeToolbarButtonProps` and therefore from the props supplied to standard tree header-button renderers. Header buttons now report through `TelemetryContextProvider` instead of receiving the callback as a prop.

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
        <ModelsTreeComponent
          treeLabel="Models tree"
          selectionStorage={selectionStorage}
          onFeatureUsed={onFeatureUsed}
          onPerformanceMeasured={onPerformanceMeasured}
        />

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
      <ModelsTreeComponent
        treeLabel="Models tree"
        selectionStorage={selectionStorage}
        onFeatureUsed={onFeatureUsed}
        onPerformanceMeasured={onPerformanceMeasured}
      />

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

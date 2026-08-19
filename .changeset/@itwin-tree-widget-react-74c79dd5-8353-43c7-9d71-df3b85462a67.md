---
"@itwin/tree-widget-react": major
---

Replace `TreeWidget.initialize`, `SharedTreeContextProvider`, and `TelemetryContextProvider` with `TreeWidgetContextProvider`. Continue registering `LOCALIZATION_NAMESPACES` during application startup, and wrap directly rendered tree components and hooks with a single `TreeWidgetContextProvider` to supply localization, telemetry, logging, and shared tree resources.

Before:

```tsx
import { LOCALIZATION_NAMESPACES, ModelsTreeComponent, SharedTreeContextProvider, TelemetryContextProvider, TreeWidget } from "@itwin/tree-widget-react";

for (const namespace of LOCALIZATION_NAMESPACES) {
  await IModelApp.localization.registerNamespace(namespace);
}

await TreeWidget.initialize(logger);

function ModelsTreeWidget() {
  return (
    <SharedTreeContextProvider>
      <ModelsTreeComponent
        treeLabel="Models tree"
        selectionStorage={selectionStorage}
        onFeatureUsed={onFeatureUsed}
        onPerformanceMeasured={onPerformanceMeasured}
      />
    </SharedTreeContextProvider>
  );
}

function CustomTreeWidget() {
  return (
    <SharedTreeContextProvider>
      <TelemetryContextProvider componentIdentifier="my-tree" onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
        <MyTree />
      </TelemetryContextProvider>
    </SharedTreeContextProvider>
  );
}
```

After:

```tsx
import { LOCALIZATION_NAMESPACES, ModelsTreeComponent, TreeWidgetContextProvider } from "@itwin/tree-widget-react";

for (const namespace of LOCALIZATION_NAMESPACES) {
  await IModelApp.localization.registerNamespace(namespace);
}

function ModelsTreeWidget() {
  return (
    <TreeWidgetContextProvider
      localization={IModelApp.localization}
      logger={logger}
      onFeatureUsed={onFeatureUsed}
      onPerformanceMeasured={onPerformanceMeasured}
    >
      <ModelsTreeComponent treeLabel="Models tree" selectionStorage={selectionStorage} />
    </TreeWidgetContextProvider>
  );
}

function CustomTreeWidget() {
  return (
    <TreeWidgetContextProvider
      componentIdentifier="my-tree"
      localization={IModelApp.localization}
      logger={logger}
      onFeatureUsed={onFeatureUsed}
      onPerformanceMeasured={onPerformanceMeasured}
    >
      <MyTree />
    </TreeWidgetContextProvider>
  );
}
```

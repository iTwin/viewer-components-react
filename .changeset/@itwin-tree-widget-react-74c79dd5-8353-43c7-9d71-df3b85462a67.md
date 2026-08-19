---
"@itwin/tree-widget-react": major
---

Replace `TreeWidget.initialize`, `SharedTreeContextProvider`, and `TelemetryContextProvider` with `TreeWidgetContextProvider`. Continue registering `LOCALIZATION_NAMESPACES` during application startup, and wrap directly rendered tree components and hooks with a single `TreeWidgetContextProvider` to supply localization, telemetry, logging, and shared tree resources.

Before:

```tsx
import {
  LOCALIZATION_NAMESPACES,
  ModelsTreeComponent,
  CategoriesTreeComponent,
  SharedTreeContextProvider,
  TelemetryContextProvider,
  TreeWidget,
} from "@itwin/tree-widget-react";

for (const namespace of LOCALIZATION_NAMESPACES) {
  await IModelApp.localization.registerNamespace(namespace);
}

await TreeWidget.initialize(logger);

function MyWidget() {
  return (
    <LocalizationContextProvider localization={IModelApp.localization}>
      <SharedTreeContextProvider>
        <TelemetryContextProvider componentIdentifier="my-tree" onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
          <ModelsTreeComponent treeLabel="Models tree" selectionStorage={selectionStorage} />
          <CategoriesTreeComponent treeLabel="Categories tree" selectionStorage={selectionStorage} />
          <CustomTree1 />
          <CustomTree2 />
        </TelemetryContextProvider>
      </SharedTreeContextProvider>
    </LocalizationContextProvider>
  );
}
```

After:

```tsx
import { LOCALIZATION_NAMESPACES, ModelsTreeComponent, CategoriesTreeComponent, TreeWidgetContextProvider } from "@itwin/tree-widget-react";

for (const namespace of LOCALIZATION_NAMESPACES) {
  await IModelApp.localization.registerNamespace(namespace);
}

function MyWidget() {
  return (
    <TreeWidgetContextProvider
      componentIdentifier="my-tree"
      localization={IModelApp.localization}
      logger={logger}
      onFeatureUsed={onFeatureUsed}
      onPerformanceMeasured={onPerformanceMeasured}
    >
        <ModelsTreeComponent treeLabel="Models tree" selectionStorage={selectionStorage} />
        <CategoriesTreeComponent treeLabel="Categories tree" selectionStorage={selectionStorage} />
        <CustomTree1 />
        <CustomTree2 />
    </TelemetryContextProvider>
  );
}
```

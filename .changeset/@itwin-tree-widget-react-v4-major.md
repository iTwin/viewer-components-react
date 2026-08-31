---
"@itwin/tree-widget-react": major
---

The [migration guide](https://github.com/iTwin/viewer-components-react/blob/master/packages/tree-widget/MigrationGuide.md) covers every breaking change below with step-by-step instructions and before/after examples.

#### Application setup

- **Rendering and theming moved to MUI and StrataKit.** Tree Widget no longer renders with `@itwin/itwinui-react`; applications must use compatible MUI and StrataKit theming and peer dependencies. ([#1169](https://github.com/iTwin/viewer-components-react/pull/1169), [#1320](https://github.com/iTwin/viewer-components-react/pull/1320), [#1748](https://github.com/iTwin/viewer-components-react/pull/1748))
- **Runtime and package requirements changed.** v4 requires React 18, the peer dependency versions declared by the package—including iTwin.js 5, MUI, and StrataKit—and an ESM-compatible application and test setup. The package no longer publishes a CommonJS build. ([#1642](https://github.com/iTwin/viewer-components-react/pull/1642), [#1748](https://github.com/iTwin/viewer-components-react/pull/1748))
- **Global initialization was replaced by `TreeWidgetContextProvider`.** The `TreeWidget` class was removed together with `TreeWidget.initialize()`, `TreeWidget.terminate()`, `TreeWidget.i18n`, `TreeWidget.i18nNamespace`, and `TreeWidget.translate`. Continue registering `LOCALIZATION_NAMESPACES`, then place one `TreeWidgetContextProvider` above directly rendered tree components. `TreeWidgetContextProvider`, `createTreeWidget`, and `TreeWidgetComponent` require `localization` and accept an optional `logger`; the widget APIs add the provider automatically. ([#1303](https://github.com/iTwin/viewer-components-react/pull/1303), [#1617](https://github.com/iTwin/viewer-components-react/pull/1617), [#1783](https://github.com/iTwin/viewer-components-react/pull/1783))
- **Header-button telemetry is provided through context.** `onFeatureUsed` was removed from standard header-button props; custom trees should provide telemetry through `TelemetryContextProvider`. ([#1783](https://github.com/iTwin/viewer-components-react/pull/1783))
- **Tree components and renderers now require `treeLabel`.** Supply an accessible label to standard tree components and to `TreeRenderer` or `VisibilityTreeRenderer`. Widget tree definitions receive the configured label through their render callback. ([#1495](https://github.com/iTwin/viewer-components-react/pull/1495))
- **The `density` and `getSchemaContext` props were removed.** `density` is no longer accepted by tree components, header-button renderer props, or `TreeDefinition.render` props, and the schema context is now created internally. ([#1186](https://github.com/iTwin/viewer-components-react/pull/1186), [#1331](https://github.com/iTwin/viewer-components-react/pull/1331))

#### Widget and tree composition

- **The widget and header components changed roles, and the `SelectableTree` name was reused.** The v3 tree selector `SelectableTree` is now `TreeWidgetComponent`, and the v3 header container `TreeWithHeader` is now `SelectableTree`. Migrating by name alone compiles into the wrong layout. `SelectableTreeDefinition` was replaced by `TreeDefinition`, whose `getLabel` receives `{ standardLabels }` and whose `render` receives `treeLabel` and, for searchable definitions, `searchText`. ([#1186](https://github.com/iTwin/viewer-components-react/pull/1186))
- **Standard tree components no longer render their own search input.** `TreeWithHeader.filteringProps` was removed. Set `TreeDefinition.isSearchable` to get the widget-header search box, or render an application-owned input and pass its value through the component's `searchText` prop. ([#1186](https://github.com/iTwin/viewer-components-react/pull/1186), [#1289](https://github.com/iTwin/viewer-components-react/pull/1289))
- **Standard tree hooks return different values.** `useModelsTree` and `useCategoriesTree` return `treeProps` and `getTreeItemProps` instead of `modelsTreeProps` or `categoriesTreeProps` together with `rendererProps`. ([#1540](https://github.com/iTwin/viewer-components-react/pull/1540))
- **Categories tree header buttons require `models`.** `CategoriesTreeHeaderButtonProps` gained a required `models` property, and `onCategoriesFiltered` now receives `{ categories, models }` instead of a categories array. `useCategoriesTreeButtonProps` supplies both. ([#1265](https://github.com/iTwin/viewer-components-react/pull/1265))

#### Tree renderer and action APIs

- **Node customization moved to `getTreeItemProps`.** The single callback replaces the v3 `getLabel`, `getIcon`, and `getSublabel` renderer props through its `label`, `decorations`, and `description` results, and it also supplies the `onClick`, `onKeyDown`, and `onDoubleClick` handlers that replace `onNodeClick`, `onNodeKeyDown`, and `onNodeDoubleClick`. Replace the v3 `PresentationHierarchyNode` and `PresentationTreeNode` callback types with `TreeNode` from `@itwin/presentation-hierarchies-react` v2. The replacement `onClick` and `onDoubleClick` handlers do not receive the v3 `isSelected` argument; query selection state separately when needed. The `filterButtonsVisibility`, `size`, and `enableVirtualization` renderer props were removed without a replacement. ([#1540](https://github.com/iTwin/viewer-components-react/pull/1540), [#1557](https://github.com/iTwin/viewer-components-react/pull/1557))
- **Tree actions were redesigned and expanded.** Replace the v3 `getActions` callback with `getInlineActions`, `getMenuActions`, or `getContextMenuActions`. These callbacks receive `{ targetNode, selectedNodes }`, provide the current renderer props as their second argument, and return React elements: up to two `TreeActionBase` elements inline, and `TreeActionBase` or divider elements in the menus. ([#1394](https://github.com/iTwin/viewer-components-react/pull/1394), [#1485](https://github.com/iTwin/viewer-components-react/pull/1485), [#1522](https://github.com/iTwin/viewer-components-react/pull/1522), [#1534](https://github.com/iTwin/viewer-components-react/pull/1534))
- **The hierarchy level filter callback was renamed.** Replace the `onFilterClick` renderer prop with `filterHierarchyLevel`. ([#1557](https://github.com/iTwin/viewer-components-react/pull/1557))
- **Visibility renderer callbacks were renamed.** `getCheckboxState` and `onCheckboxClicked` became `getVisibilityButtonState` and `onVisibilityButtonClick`, the `"on"` and `"off"` states became `"visible"` and `"hidden"`, and the click callback now receives the node's current state instead of the state to apply. ([#1320](https://github.com/iTwin/viewer-components-react/pull/1320))

#### Search APIs

- **Filtering APIs were renamed to search APIs.** Replace `filter` with `searchText`, `getFilteredPaths` with `getSearchPaths`, and `FilterLimitExceededError` with `SearchLimitExceededError`. Localized keys under `*tree.filtering` moved to `*tree.search`, including `tooManySearchMatches` and `unknownSearchError`. ([#1539](https://github.com/iTwin/viewer-components-react/pull/1539))
- **Hierarchy search and EC class-name types changed.** `getSearchPaths` and `getSubTreePaths` now return `HierarchySearchTree[]` instead of the v3 `HierarchyFilteringPath[]` representation, and the path option `autoExpand` became `reveal`. Configuration APIs that accept full EC class names now use `EC.FullClassNameDotNotation`, so values must use dot notation such as `BisCore.GeometricElement3d`. ([#1636](https://github.com/iTwin/viewer-components-react/pull/1636))
- **Tree highlighting now uses a text value.** Replace the `highlight` object prop on `Tree` and `VisibilityTree` with the `highlightText` string prop. The tree props returned by the standard-tree hooks use the same name. ([#1408](https://github.com/iTwin/viewer-components-react/pull/1408))
- **Custom empty-tree content uses `emptyTreeContent`.** Replace the v3 `noDataMessage` prop on `Tree`, `VisibilityTree`, standard tree components, and the values returned by standard-tree hooks. ([#1214](https://github.com/iTwin/viewer-components-react/pull/1214))

#### Visibility APIs

- **Tree visibility APIs now use `TreeWidgetViewport`.** Models, Categories, and Classifications tree components accept an optional `TreeWidgetViewport` and otherwise use AppUI's active viewport. Hooks and header-button APIs that previously accepted an iTwin.js `Viewport` now require the narrower abstraction; use `createTreeWidgetViewport` to adapt an existing viewport. ([#1466](https://github.com/iTwin/viewer-components-react/pull/1466))
- **Custom hierarchy visibility handlers use standard disposal.** `HierarchyVisibilityHandler` now extends `Disposable`; replace `dispose()` implementations and calls with `[Symbol.dispose]()`. ([#1320](https://github.com/iTwin/viewer-components-react/pull/1320))
- **Models tree visibility override callbacks changed.** `ModelsTreeVisibilityHandlerOverrides` callbacks now use `get*VisibilityStatus` and `change*VisibilityStatus` names, accept entity-specific `Id64Arg` parameters, and allow `modelId` to be omitted from category callbacks. ([#1401](https://github.com/iTwin/viewer-components-react/pull/1401), [#1403](https://github.com/iTwin/viewer-components-react/pull/1403))
- **Custom visibility status APIs changed.** `VisibilityStatus.tooltip` was removed from custom hierarchy visibility handlers. Renderer-specific visibility button state may still supply a tooltip. ([#1286](https://github.com/iTwin/viewer-components-react/pull/1286))

#### Hierarchy

- **Models and Categories hierarchy configuration is now organized by node type.** Omitted settings preserve the v3 defaults; migrate only the settings the application supplies:

  - Categories: replace `showEmptyCategories: true` with `categories: { withoutElements: "include" }`.
  - Models: replace `hideRootSubject: true` with `subjects: { root: "exclude" }` and `showEmptyModels: true` with `models: { withoutElements: "include" }`.
  - Models: replace `elementClassSpecification` with `elements.baseClass` and `elementClassGrouping` with `elements.classGrouping`.
  - Replace the `enableWithCounts` grouping value with `enable-with-counts`.

  ([#1738](https://github.com/iTwin/viewer-components-react/pull/1738))

- **Models and Categories trees now display intermediate category nodes.** When a child element uses a different category than its parent, it is grouped beneath an intermediate node for its own category instead of appearing directly beneath the parent element. Code that walks parent or child nodes, and tests that assert on hierarchy shape or node depth, must account for the extra level. ([#1716](https://github.com/iTwin/viewer-components-react/pull/1716))

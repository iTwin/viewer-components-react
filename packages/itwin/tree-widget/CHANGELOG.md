# Change Log - @itwin/tree-widget-react

<!-- This log was last generated on Thu, 21 Aug 2025 11:00:38 GMT and should not be manually modified. -->

<!-- Start content -->

## 3.14.0

Thu, 21 Aug 2025 11:00:38 GMT

### Minor changes

- Allow Model tree's `getFilteredPaths` prop function to return `undefined` paths. In that case, it's considered that filtering should not be applied, and the full unfiltered tree should be loaded. ([#1417](https://github.com/iTwin/viewer-components-react/pull/1417))

## 3.13.2

Thu, 07 Aug 2025 18:43:06 GMT

### Patches

- Models tree: Stop unnecessarily executing an expensive model elements' count query, whose results we weren't even using.

## 3.13.1

Thu, 07 Aug 2025 12:12:57 GMT

### Patches

- Split large queries into smaller chunks to make them execute quicker. ([#1396](https://github.com/iTwin/viewer-components-react/pull/1396))

## 3.13.0

Wed, 06 Aug 2025 13:46:52 GMT

### Minor changes

- Added `getActions` callback to `TreeRenderer` components. It allows to supply custom actions for tree nodes. ([#1395](https://github.com/iTwin/viewer-components-react/pull/1395))

## 3.12.1

Wed, 06 Aug 2025 10:14:27 GMT

### Patches

- Models tree: Fixed not all required nodes being auto-expanded when using `getSubTreePaths` together with filtering. ([#1391](https://github.com/iTwin/viewer-components-react/pull/1391))

## 3.12.0

Wed, 30 Jul 2025 13:10:01 GMT

### Minor changes

- Added `getSubTreePaths` option to `UseModelsTreeProps` for restricting the visible hierarchy to a sub-tree of nodes based on instance keys. Unlike `getFilteredPaths`, which controls filtering logic, `getSubTreePaths` limits the scope of the hierarchy, allowing filtering within the specified sub-tree. ([#1375](https://github.com/iTwin/viewer-components-react/pull/1375))

## 3.11.0

Thu, 24 Jul 2025 16:07:32 GMT

### Minor changes

- Updated @itwin/presentation-hierarchies to v1.6.1 and @itwin/presentation-hierarchies-react to 1.7.1 ([#1379](https://github.com/iTwin/viewer-components-react/pull/1379))

### Patches

- Fix categories tree incorectly inverting categories visibility. ([#1381](https://github.com/iTwin/viewer-components-react/pull/1381))

## 3.10.3

Mon, 14 Jul 2025 12:38:56 GMT

### Patches

- Added missing peer dependencies. ([#1376](https://github.com/iTwin/viewer-components-react/pull/1376))

## 3.10.2

Mon, 07 Jul 2025 19:55:02 GMT

### Patches

- Bumped `@itwin/presentation-hierarchies-react` version. ([#1368](https://github.com/iTwin/viewer-components-react/pull/1368))
- Fix category count query throwing error on large iModels ([#1364](https://github.com/iTwin/viewer-components-react/pull/1364))

## 3.10.1

Fri, 20 Jun 2025 17:05:06 GMT

### Patches

- Update itwinjs-core dependencies to v5.0.0 ([#1349](https://github.com/iTwin/viewer-components-react/pull/1349))

## 3.10.0

Mon, 02 Jun 2025 13:19:21 GMT

### Minor changes

- `useModelsTree`: The `getFilteredPaths` callback prop now has a `filter` prop, which matches the value of `filter` prop passed to `useModelsTree` hook. This make it more convenient for consumers to filter by instance keys and label at the same time. ([#1335](https://github.com/iTwin/viewer-components-react/pull/1335))

## 3.9.0

Mon, 19 May 2025 16:58:21 GMT

### Minor changes

- Add support for iTwin.js v5.0 ([#1326](https://github.com/iTwin/viewer-components-react/pull/1326))

## 3.8.0

Thu, 15 May 2025 05:33:32 GMT

### Minor changes

- Fixed merged (categories and models) nodes visibility. Changed `@beta` APIs in a **breaking** way: `ModelsTreeVisibilityHandlerOverrides.getModelDisplayStatus` and `ModelsTreeVisibilityHandlerOverrides.getCategoryDisplayStatus` - `id` and `categoryId` props are now of `Id64Arg` type instead of `Id64String`. Use `Id64` from `@itwin/core-bentley` to access individual IDs. ([#1311](https://github.com/iTwin/viewer-components-react/pull/1311))

### Patches

- update presentation deps to versions that properly support core @ 5.0-rc ([#1304](https://github.com/iTwin/viewer-components-react/pull/1304))

## 3.7.0

Mon, 28 Apr 2025 16:18:43 GMT

### Minor changes

- Added ability to disabled hierarchy level filtering in `ModelsTree`. ([#1297](https://github.com/iTwin/viewer-components-react/pull/1297))

## 3.6.1

Fri, 18 Apr 2025 17:06:22 GMT

### Patches

- Fixed Categories tree not reacting to Category display changes from Models tree, when they're made on per-model category overrides. ([#1284](https://github.com/iTwin/viewer-components-react/pull/1284))
- Fixed `ModelsTree` and `CategoriesTree` not applying custom hierarchy level size limit. ([#1292](https://github.com/iTwin/viewer-components-react/pull/1292))

## 3.6.0

Fri, 21 Mar 2025 11:37:20 GMT

### Minor changes

- Add ability to remove root Subject node from Models and iModel content trees by setting `hideRootSubject: true` in the `hierarchyConfig` prop. ([#1251](https://github.com/iTwin/viewer-components-react/pull/1251))

### Patches

- Fixed Models tree showing that modeled elements have children, when their sub model is private or when sub model does not have any elements. Now it shows that modeled element has children only when it's sub model has children and is not private. ([#1253](https://github.com/iTwin/viewer-components-react/pull/1253))
- Fixed Categories tree showing definition containers that contain categories without elements. Now it displays definition containers only when they have categories that contain elements. ([#1248](https://github.com/iTwin/viewer-components-react/pull/1248))

## 3.5.1

Thu, 06 Mar 2025 12:37:44 GMT

### Patches

- Update import to use `@itwin/core-bentley` for types that are reexported by `@itwin/core-common` ([#1232](https://github.com/iTwin/viewer-components-react/pull/1232))

## 3.5.0

Wed, 19 Feb 2025 21:08:10 GMT

### Minor changes

- `CategoriesTree` component rendered `Categories` as a flat list, where each `Category` had zero or more child `SubCategories`. Some iTwin.js applications started to group `Categories` under `DefinitionContainers` and wanted to see them displayed in `CategoriesTree` component. Added `DefinitionContainers` to `CategoriesTree` component. This change doesn't affect applications that don't have `DefinitionContainers`. ([#1172](https://github.com/iTwin/viewer-components-react/pull/1172))

## 3.4.2

Fri, 14 Feb 2025 15:54:49 GMT

### Patches

- Adjusted modeled element / sub-model visibility controls. Now, if visibility of modeled element is changed, visibility of sub-model is adjusted accordingly and vice versa. ([#1183](https://github.com/iTwin/viewer-components-react/pull/1183))

## 3.4.1

Thu, 06 Feb 2025 13:36:20 GMT

### Patches

- Removed horizontal scroll from trees. ([#1180](https://github.com/iTwin/viewer-components-react/pull/1180))

## 3.4.0

Tue, 04 Feb 2025 15:29:52 GMT

### Minor changes

- Expose `FocusedInstancesContextProvider` and `useFocusedInstancesContext` to allow using `ModelsTreeComponent.ToggleInstancesFocusButton` from outside of `ModelsTreeComponent` and accesing the context from other React components. ([#1175](https://github.com/iTwin/viewer-components-react/pull/1175))
- Add `filterButtonsVisibility` prop to `TreeRenderer`. The prop allows to control visibility of hierarchy level filtering buttons in the tree: `show-on-hover` (default) shows them on hover or focus, `hide` only shows them when a node is filtered. ([#1178](https://github.com/iTwin/viewer-components-react/pull/1178))

## 3.3.0

Mon, 27 Jan 2025 18:30:40 GMT

### Minor changes

- Define `type` and `exports` attributes in `package.json`. The `exports attribute prohibits access to APIs that are not intended to be used by external consumers. The `type: "module"` attribute addition moves this package a step closer towards dropping CommonJS support - it's now transpiled from ESM to CommonJS instead of the opposite. ([#1147](https://github.com/iTwin/viewer-components-react/pull/1147))
- Add support for AppUI 5.x ([#1147](https://github.com/iTwin/viewer-components-react/pull/1147))

### Patches

- Fix visibility button with no content rendering empty tooltip. ([#1145](https://github.com/iTwin/viewer-components-react/pull/1145))

## 3.2.4

Tue, 14 Jan 2025 02:51:04 GMT

### Patches

- Fixed a bug in `CategoriesTreeDefinition.createInstanceKeyPaths`, where sometimes incorrect key paths would be created. Because of this, `CategoriesTree` would show incorrect categories with applied label filter. ([#1139](https://github.com/iTwin/viewer-components-react/pull/1139))

## 3.2.3

Wed, 08 Jan 2025 13:28:10 GMT

### Patches

- Changed `onHierarchyLoad` to log errors to console ([#1135](https://github.com/iTwin/viewer-components-react/pull/1135))

## 3.2.2

Tue, 07 Jan 2025 16:30:55 GMT

### Patches

- Propagate `enableVirtualization` flag down to the underlying `Tree` component from `iTwinUI` ([#1133](https://github.com/iTwin/viewer-components-react/pull/1133))

## 3.2.1

Tue, 07 Jan 2025 12:53:32 GMT

### Patches

- Increase performance consistency when creating filtering paths from target items. ([#1130](https://github.com/iTwin/viewer-components-react/pull/1130))
- Reduced main thread blockage ~3 times when creating filtering paths from target items. ([#1123](https://github.com/iTwin/viewer-components-react/pull/1123))

## 3.2.0

Wed, 18 Dec 2024 12:42:56 GMT

### Minor changes

- Added an optional `selectionPredicate` function prop to `ModelsTreeComponent`, `ModelsTree`, `useModelsTree` and `Tree` components. When provided, it allows consumers to conditionally enable/disable selection of tree nodes. ([#1124](https://github.com/iTwin/viewer-components-react/pull/1124))

### Patches

- Bump dependencies ([#1122](https://github.com/iTwin/viewer-components-react/pull/1122))

## 3.1.0

Fri, 29 Nov 2024 10:43:06 GMT

### Minor changes

- Replaced `ModelsTreeVisibilityHandlerOverrides.changeElementState` with `ModelsTreeVisibilityHandlerOverrides.changeElementsState`. The method is provided with a list of elements instead of single element to allow changing visibility of multiple elements in single batch istead of one by one. ([#1098](https://github.com/iTwin/viewer-components-react/pull/1098))

### Patches

- Bump dependencies ([#1103](https://github.com/iTwin/viewer-components-react/pull/1103))
- Add missing tooltips ([#1092](https://github.com/iTwin/viewer-components-react/pull/1092))
- Reduce the number of queries being executed when always/never drawn sets change. ([#1102](https://github.com/iTwin/viewer-components-react/pull/1102))
- Improve performance of visibility status calculation and visibility changes. Also reduce main thread blocking to avoid UI freezing. ([#1098](https://github.com/iTwin/viewer-components-react/pull/1098))

## 3.0.3

Fri, 15 Nov 2024 15:03:19 GMT

### Patches

- Reduce UI blocking when checking visibility status ([#1094](https://github.com/iTwin/viewer-components-react/pull/1094))

## 3.0.2

Tue, 12 Nov 2024 12:57:13 GMT

### Patches

- Update ECSQL queries to always use `.Id` suffix when querying navigation properties - that substantially improves query performance. ([#1085](https://github.com/iTwin/viewer-components-react/pull/1085))
- Models tree: Improved performance of creating instance key paths for large numbers of target instances by up to 200x. ([#1084](https://github.com/iTwin/viewer-components-react/pull/1084))
- Updated `TreeNodeRenderer` to pass `ref` to the underlying `TreeNodeRenderer` from `@itwin/presentation-hierarchies-react`. ([#1078](https://github.com/iTwin/viewer-components-react/pull/1078))

## 3.0.1

Tue, 15 Oct 2024 20:19:11 GMT

### Patches

- Bump `presentation` package dependencies for bug fixes and orders of magnitude hierarchy filtering performance improvement. ([#1067](https://github.com/iTwin/viewer-components-react/pull/1067))

## 3.0.0

Fri, 04 Oct 2024 15:06:44 GMT

### Major changes

- The `3.0` release affects nearly all components in this package, usually in a breaking way. As a result, we suggest treating this version as a completely new package rather than an incremental upgrade - please have a look at the [README](./README.md) for a list of new features and examples on how to consume the new version ([#966](https://github.com/iTwin/viewer-components-react/pull/966))

## 2.3.2

Mon, 10 Jun 2024 12:47:48 GMT

### Patches

- Removed usage of `require` as it is not supported in ES modules ([#902](https://github.com/iTwin/viewer-components-react/pull/902))

## 2.3.1

Wed, 22 May 2024 16:03:40 GMT

### Patches

- Fixed newly inserted subject node visibility not changing ([#838](https://github.com/iTwin/viewer-components-react/pull/838))

## 2.3.0

Tue, 21 May 2024 13:26:36 GMT

### Minor changes

- Added support for custom start icons in `TreeSelector`. ([#830](https://github.com/iTwin/viewer-components-react/pull/830))

### Patches

- Fixed `ModelsTree` not changing visibility for child elements. ([#828](https://github.com/iTwin/viewer-components-react/pull/828))

## 2.2.0

Mon, 29 Apr 2024 14:59:26 GMT

### Minor changes

- Added ability to track usage of `TreeWidget` features. ([#820](https://github.com/iTwin/viewer-components-react/pull/820))

## 2.1.0

Wed, 17 Apr 2024 15:50:19 GMT

### Minor changes

- Added ability to track performance of `TreeWidget` component features. Requires `@itwin/presentation-components` version `5.1` or higher ([#813](https://github.com:iTwin/viewer-components-react.git/pull/813))

### Patches

- ModelsTree: Improved performance when changing visibility of multiple element nodes at the same time. ([#810](https://github.com:iTwin/viewer-components-react.git/pull/810))

## 2.0.2

Thu, 04 Apr 2024 14:19:35 GMT

### Patches

- Removed border appearing around search button. ([#804](https://github.com/iTwin/viewer-components-react/pull/804))

## 2.0.1

Thu, 07 Mar 2024 13:37:08 GMT

### Patches

- Updated trees to always react to data changes and auto update. ([#795](https://github.com/iTwin/viewer-components-react/pull/795))

## 2.0.0

Wed, 06 Mar 2024 15:24:33 GMT

### Major changes

- Update `@itwin/itwinui-react` dependency to `3.x` ([#771](https://github.com/iTwin/viewer-components-react/pull/771))
- Bumped `@itwin/presentation-components` peer dependency version to `^5.0.0`. ([#789](https://github.com/iTwin/viewer-components-react/pull/789))
- Bumped AppUI peer dependencies version to `^4.10.0`. ([#789](https://github.com/iTwin/viewer-components-react/pull/789))

### Minor changes

- Tree Widget: Updated header and its content to be touch friendly when using expanded layout. ([#782](https://github.com/iTwin/viewer-components-react/pull/782))
- Added React 18 support. ([#728](https://github.com/iTwin/viewer-components-react/pull/728))
- Models Tree: zoom to viewport element on node double-click. ([#704](https://github.com/iTwin/viewer-components-react/pull/704))
- Tree Widget: allow opt-in to hierarchy level size limiting. ([#761](https://github.com/iTwin/viewer-components-react/pull/761))
- Tree Widget: Allow opt-in to hierarchy level filtering using `isHierarchyLevelFilteringEnabled` flag for all trees. Add support for `enlarged` nodes in non-visibility trees. ([#751](https://github.com/iTwin/viewer-components-react/pull/751))
- Move `VisibilityTreeEventHandler.onNodeDoubleClick` event handler to newly added `ModelsTreeEventHandler`. Expand `useVisibilityTreeState` hook to support custom `VisibilityTreeEventHandler`'s. ([#741](https://github.com/iTwin/viewer-components-react/pull/741))

### Patches

- Models Tree: For all header actions only consider Models that model either `InformationPartitionElement` or `GeometricElement3d`. This should omit Models that are not displayed in the component. ([#738](https://github.com/iTwin/viewer-components-react/pull/738))
- Fixed progress indicator positioning in enlarged tree layout. ([#790](https://github.com/iTwin/viewer-components-react/pull/790))

## 1.2.2

Tue, 30 Jan 2024 13:20:38 GMT

### Patches

- Fixed `onCheckboxStateChanged` event handling when multiple `rxjs` versions are present. ([#750](https://github.com/iTwin/viewer-components-react/pull/750))

## 1.2.1
Fri, 01 Dec 2023 13:46:38 GMT

### Patches

- Fix padding for icons when elements are enlarged.
- Fix progress indicator sizing in `enlarged` layout

## 1.2.0
Tue, 19 Sep 2023 14:55:43 GMT

### Minor changes

- `ModelsTree`: Add an option to pass `modelsVisibilityHandler` as a factory function.

## 1.1.3
Tue, 29 Aug 2023 13:48:47 GMT

### Patches

- Fix spacing between expander and label in iModelContentTree component.
- Fix Models tree search not loading Subject nodes with hidden content models

## 1.1.2
Tue, 22 Aug 2023 14:39:05 GMT

### Patches

- `Trees`: Do not select node when checkbox is clicked.

## 1.1.1
Thu, 17 Aug 2023 14:42:37 GMT

### Patches

- Trees: Fix eye checkbox background when node is selected and hovered.

## 1.1.0
Mon, 07 Aug 2023 13:36:23 GMT

### Minor changes

- Trees: Added ability to increase node size in order to make tree more user friendly on touch devices.
- Trees: Added ability to customize tree node label
- `ModelsTree`: Added ability to show models without elements.
- Added context menu support.

### Patches

- Removed `@itwin/itwinui-variables` from dependencies.

## 1.0.0
Mon, 31 Jul 2023 14:10:09 GMT

### Breaking changes

- Trees: Make eye checkboxes static on horizontal scroll.
- `createVisibilityTreeNodeRenderer` now takes a `props` object of type `VisibilityTreeNodeRendererProps`. It contains two new configuration options: `levelOffset`, and `disableRootNodeCollapse`.
- Rename `useVisibilityTreeRenderer` to `createVisibilityTreeRenderer`. It now takes a `props` object of type `VisibilityTreeRendererProps`
- Bumped AppUI peer dependencies to `^4.3.0`.
- Renamed `TreeWidgetComponent` to `SelectableTree`.
- Widget: Reworked the way trees are provided to the widget. Instead of having separate configuration properties for hiding default trees and adding additional trees now there is only one property for supplying a list of trees to show.
- Refactored `IModelContentTreeProps` to not inherit `HTMLDivElement` props.
- `IVisibilityHandler`: Methods `getVisibilityStatus` and `changeVisibility` don't take `NodeKey` argument anymore.
- Models tree: `ModelsTreeProps.enableElementsClassGrouping` has been moved to `ModelsTreeProps.hierarchyConfig.enableElementsClassGrouping`.

### Minor changes

- Models tree: Removed expansion toggle for root node.
- Widget: Added ability to conditionally show trees.
- Trees: Decrease whitespace size between the node label and eye checkbox.
- Added base tree props interface for props shared between trees.
- External sources tree: Add `ExternalSourcesTreeComponent` (currently `@alpha`).
- Models tree: Added an option to specialize the class of geometric elements loaded into the hierarchy (see `ModelsTreeHierarchyConfiguration.elementClassSpecification`).
- Trees: Use search box from the `@itwin/itwinui-react` library.

### Patches

- Trees: Keep child nodes state the same after parent node re-expands.
- Categories tree: Fixed behavior of the Invert button. Previously, only categories were affected, now sub-categories are affected as well.
- Handle errors thrown from tree components.
- Persist tree scroll position when switching between widgets.
- `Tree Header`: Fixed dropdown buttons menu not theming correctly.
- `ModelsTree`: Refactor ruleset to not use deprecated `ImageIdOverride` rule.
- `ModelsTree`: Always render checkbox to avoid UI shifting when checkbox appear.

## 0.10.0
Tue, 23 May 2023 13:16:11 GMT

_Version update only_

## 0.9.0
Tue, 02 May 2023 16:12:17 GMT

### Minor changes

- Updated to AppUI 4.0 and Presentation 4.0.

## 0.8.0
Mon, 03 Apr 2023 15:34:07 GMT

### Minor changes

- Removed `SpatialTree` and related components in favor of the ones in `@itwin/breakdown-trees-react`.
- Updated dependencies (`itwinui@2`, `appui@4`, `presentation-components@4`, `itwinjs-core@3.7`).

### Patches

- Use iTwin UI components instead of custom ones and CSS variables from `@itwin/itwinui-variables` instead of `@itwin/core-react`.

## 0.7.2
Fri, 24 Mar 2023 10:46:34 GMT

### Patches

- Fixed tree filtering not being removed when search box is closed.

## 0.7.1
Thu, 23 Mar 2023 15:12:36 GMT

### Patches

- 'ModelsTree': Restored 'HideAll' button behavior to hide only models.

## 0.7.0
Mon, 20 Mar 2023 14:48:35 GMT

### Minor changes

- Add an option to control what buttons are available in tree toolbars.
- Upgrade `itwinjs-core` dependencies to `^3.6.0`.
- Upgrade `typescript` to `~4.4.0`.

### Patches

- ModelsTree: ensure that the "Show all" button is going to show all elements when there are elements with an "exclusive" flag.
- '2d' and '3d' buttons react to visibility changes in the viewport. The '2d' button will be disabled if no models with the PlanProjection flag are present in the model.

## 0.6.2
Thu, 09 Mar 2023 20:08:53 GMT

### Patches

- `ModelsTreeComponent`: ensure that the "show all" and "hide all" buttons affect all iModel content.
- `ModelsTree`: Remove unused feature of filtering the tree by element ids.

## 0.6.1
Thu, 19 Jan 2023 10:29:18 GMT

### Patches

- `CategoryTree`: Updated ruleset to not show private SubCategories.
- Bug fix for changing visibility of multiple nodes at once.

## 0.6.0
Tue, 20 Dec 2022 15:12:29 GMT

### Minor changes

- Moved core trees implementation from `@itwin/appui-react` package to `@itwin/tree-widget-react`.

## 0.5.0
Mon, 12 Sep 2022 19:50:36 GMT

### Minor changes

- Add new `defaultTreeId` prop to specify default tree for `TreeWidgetUiItemsProvider`.

## 0.4.7
Mon, 30 May 2022 12:44:10 GMT

### Patches

- Fix GeometricElement nodes not being shown in `IModelContentTree`.

## 0.4.6
Thu, 26 May 2022 15:54:07 GMT

### Patches

- Allow a caller to specify a default priority for `TreeWidgetUiItemsProvider`.

## 0.4.5
Mon, 09 May 2022 18:04:58 GMT

### Patches

- Set restore transient state in `TreeWidgetUiItemsProvider` to restore state when remounted.

## 0.4.4
Thu, 05 May 2022 12:21:21 GMT

### Patches

- Set tree-widget-search-bar-button-container z-index to 1.

## 0.4.3
Thu, 21 Apr 2022 18:47:53 GMT

### Patches

- Do not unmount children in `AutoSizer` when height or width is 0 to avoid losing children state.

## 0.4.2
Tue, 19 Apr 2022 14:15:57 GMT

### Patches

- Fixed search bar container to take up entire width of widget when open.

## 0.4.1
Wed, 06 Apr 2022 13:48:44 GMT

### Patches

- Allow specifying default panel location.
- Added tree icon to tree widget tab.

## 0.4.0
Fri, 18 Mar 2022 13:31:19 GMT

### Minor changes

- Remove deprecated `WidgetControl`, update `UiItemsProvider` initialization.

## 0.3.0
Wed, 02 Mar 2022 21:38:51 GMT

### Minor changes

- Add `IModelContentTree`.

## 0.2.1
Fri, 04 Feb 2022 00:43:35 GMT

### Patches

- Update scss to be pulled from cjs dir.

## 0.2.0
Mon, 24 Jan 2022 19:14:37 GMT

### Minor changes

- Bump to official iTwin.js 3.0 release.

## 0.1.2
Wed, 19 Jan 2022 17:39:40 GMT

### Patches

- Updated to latest rc, dev-185, and updated deps.

## 0.1.1
Wed, 12 Jan 2022 13:59:35 GMT

### Patches

- iTwin.js 3.0 first rc.

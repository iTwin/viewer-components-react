# Change Log - @itwin/tree-widget-react

This log was last generated on Wed, 06 Mar 2024 15:24:33 GMT and should not be manually modified.

<!-- Start content -->

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

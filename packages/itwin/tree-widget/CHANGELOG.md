# Change Log - @itwin/tree-widget-react

This log was last generated on Tue, 02 May 2023 16:12:17 GMT and should not be manually modified.

## 0.9.0
Tue, 02 May 2023 16:12:17 GMT

### Minor changes

- Updated to AppUI 4.0 and Presentation 4.0

## 0.8.0
Mon, 03 Apr 2023 15:34:07 GMT

### Minor changes

- Removed `SpatialTree` and related components in favor of the ones in `@itwin/breakdown-trees-react`
- Updated dependencies (`itwinui@2`, `appui@4`, `presentation-components@4`, `itwinjs-core@3.7`)

### Patches

- Use iTwin UI components instead of custom ones and CSS variables from `@itwin/itwinui-variables` instead of `@itwin/core-react`

## 0.7.2
Fri, 24 Mar 2023 10:46:34 GMT

### Patches

- Fixed tree filtering not being removed when search box is closed

## 0.7.1
Thu, 23 Mar 2023 15:12:36 GMT

### Patches

- 'ModelsTree': Restored 'HideAll' button behavior to hide only models

## 0.7.0
Mon, 20 Mar 2023 14:48:35 GMT

### Minor changes

- Add an option to control what buttons are available in tree toolbars.
- Upgrade `itwinjs-core` dependencies to `^3.6.0`
- Upgrade `typescript` to `~4.4.0`

### Patches

- ModelsTree: ensure that the "Show all" button is going to show all elements when there are elements with an "exclusive" flag
- '2d' and '3d' buttons react to visibility changes in the viewport. The '2d' button will be disabled if no models with the PlanProjection flag are present in the model.

## 0.6.2
Thu, 09 Mar 2023 20:08:53 GMT

### Patches

- `ModelsTreeComponent`: ensure that the "show all" and "hide all" buttons affect all iModel content
- Models Tree: Remove unused feature of filtering the tree by element ids

## 0.6.1
Thu, 19 Jan 2023 10:29:18 GMT

### Patches

- CategoriesTree: Updated ruleset to not show private SubCategories
- Bug fix for changing visibility of multiple nodes at once

## 0.6.0
Tue, 20 Dec 2022 15:12:29 GMT

### Minor changes

- Moved core trees implementation from @itwin/appui-react package to @itwin/tree-widget-react

## 0.5.0
Mon, 12 Sep 2022 19:50:36 GMT

### Minor changes

- Add new `defaultTreeId` prop to specify default tree for TreeWidgetUiItemsProvider

## 0.4.7
Mon, 30 May 2022 12:44:10 GMT

### Patches

- Fix GeometricElement nodes not being shown in `IModelContentTree`.

## 0.4.6
Thu, 26 May 2022 15:54:07 GMT

### Patches

- Allow a caller to specify a default priority for Tree Widget item provider.

## 0.4.5
Mon, 09 May 2022 18:04:58 GMT

### Patches

- set restore transient state in tree widget ui items provider to restore state when remounted

## 0.4.4
Thu, 05 May 2022 12:21:21 GMT

### Patches

- set tree-widget-search-bar-button-container z-index to 1

## 0.4.3
Thu, 21 Apr 2022 18:47:53 GMT

### Patches

- Do not unmount children in AutoSizer when height or width is 0 to avoid losing children state

## 0.4.2
Tue, 19 Apr 2022 14:15:57 GMT

### Patches

- Fixed search bar container to take up entire width of widget when open.

## 0.4.1
Wed, 06 Apr 2022 13:48:44 GMT

### Patches

- Updates to allow specification of default panel location.
- Add transitive peers as dev deps
- added tree icon to tree widget tab

## 0.4.0
Fri, 18 Mar 2022 13:31:19 GMT

### Minor changes

- Remove deprecated WidgetControl, update UiItemsProvider init

## 0.3.0
Wed, 02 Mar 2022 21:38:51 GMT

### Minor changes

- Add `IModelContentTree`

## 0.2.1
Fri, 04 Feb 2022 00:43:35 GMT

### Patches

- Update scss to be pulled from cjs dir

## 0.2.0
Mon, 24 Jan 2022 19:14:37 GMT

### Minor changes

- Bump to official iTwin.js 3.0 release

## 0.1.2
Wed, 19 Jan 2022 17:39:40 GMT

### Patches

- updated to latest rc, dev-185, and updated deps

## 0.1.1
Wed, 12 Jan 2022 13:59:35 GMT

### Patches

- iTwin.js 3.0 first rc

## 1.4.6
Tue, 11 Jan 2022 16:25:27 GMT

### Patches

- Fix hide all button blocked by search bar

## 1.4.5
Tue, 23 Nov 2021 21:19:42 GMT

### Patches

- Fix an issue where ModelsTree Component could lose its state

## 1.4.4
Thu, 16 Sep 2021 17:55:54 GMT

### Patches

- Stop delivering psuedo-localized strings

## 1.4.3
Thu, 26 Aug 2021 14:00:14 GMT

### Patches

- Search bar was not sized correctly, and alignment was not centered.

## 1.4.2
Mon, 09 Aug 2021 20:24:55 GMT

### Patches

- Updated tree widget barrel file to include UiProvider

## 1.4.1
Mon, 19 Jul 2021 18:07:24 GMT

### Patches

- Model/Category tree was not resizing properly, missing flex=1.

## 1.4.0
Tue, 13 Jul 2021 17:43:28 GMT

### Minor changes

- Added a UiProvider that implements the existing tree widget

## 1.3.1
Tue, 08 Jun 2021 21:23:59 GMT

### Patches

- bump classnames dep

## 1.3.0
Thu, 13 May 2021 21:15:14 GMT

### Minor changes

- update imjs to 2.15.2 to resolve breaking change in usePResentationTreeNodeLoader

## 1.2.8
Wed, 24 Mar 2021 21:09:25 GMT

### Patches

- Avoid Nested ScrollBars in Tree View widget

## 1.2.7
Tue, 23 Mar 2021 16:17:57 GMT

### Patches

- Change .component-selectable-content to block to display to fix resize flicker.

## 1.2.6
Fri, 26 Feb 2021 18:43:33 GMT

### Patches

- Fixes for models tree not loading models when using show all, invert and other toggles

## 1.2.5
Tue, 15 Dec 2020 13:51:37 GMT

### Patches

- Fix styling issues in search bar

## 1.2.4
Wed, 09 Dec 2020 19:09:13 GMT

### Patches

- Fixing resizing issues with the SearchBox in Model tree

## 1.2.3
Tue, 25 Aug 2020 16:57:36 GMT

### Patches

- rm unecessary dep on react-scripts

## 1.2.2
Mon, 24 Aug 2020 17:39:24 GMT

### Patches

- alphabetize package.json

## 1.2.1
Fri, 21 Aug 2020 21:17:48 GMT

### Patches

- readme update
- support replacing model/category/spatial trees in TreeWidgetControl

## 1.2.0
Tue, 11 Aug 2020 14:24:07 GMT

### Minor changes

- Added 2D / 3D toggle to tree view header

### Patches

- Decouple tree header for using in other widgets

## 1.1.1
Tue, 28 Jul 2020 22:10:32 GMT

### Patches

- Fixes for tree widgets consistency: Category tree invert functionality, tooltips on buttons and fix for iFrame height of tree not defined properly

## 1.1.0
Tue, 14 Jul 2020 22:54:18 GMT

### Minor changes

- "Add classifications tree."
- Added in tree-widget package
- Replacing ThemedSelect component with SelectableContent component

### Patches

- Functional component.
- Model tree search box will now properly clear itself in addition to closing when its "X" icon is hit


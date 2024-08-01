# Change Log - @itwin/property-grid-react

This log was last generated on Thu, 01 Aug 2024 16:01:52 GMT and should not be manually modified.

<!-- Start content -->

## 1.12.0

Thu, 01 Aug 2024 16:01:52 GMT

### Minor changes

- Visibility of the widget, when creating it using `PropertyGridUiItemsProvider`, can now be controlled using a `propertyGridProps.shouldShow` predicate, which is invoked on every unified selection change. The default behavior stays the same - show the widget when a node or a non-transient element is selected.  ([#1009](https://github.com/iTwin/viewer-components-react/pull/1009))

## 1.11.0

Tue, 23 Jul 2024 13:05:22 GMT

### Minor changes

- Add missing peer dependencies ([#1007](https://github.com/iTwin/viewer-components-react/pull/1007))

## 1.10.0

Tue, 09 Jul 2024 13:20:07 GMT

### Minor changes

- Added an informational message when no properties match given filter. ([#982](https://github.com/iTwin/viewer-components-react/pull/982))

## 1.9.1

Fri, 05 Jul 2024 12:20:16 GMT

### Patches

- Fixed zebra stripping not working in element list with newer `@itwin/itwinui-react` version. ([#977](https://github.com/iTwin/viewer-components-react/pull/977))

## 1.9.0

Mon, 10 Jun 2024 17:40:38 GMT

### Minor changes

- Do not export top level `@internal` API through barrel. ([#885](https://github.com/iTwin/viewer-components-react/pull/885))

## 1.8.0

Mon, 29 Apr 2024 14:59:26 GMT

### Minor changes

- Added ability to track usage of `PropertyWidget` features. ([#819](https://github.com/iTwin/viewer-components-react/pull/819))

## 1.7.0

Wed, 17 Apr 2024 15:50:19 GMT

### Minor changes

- Added ability to track performance of `PropertyGrid` component features. ([#807](https://github.com:iTwin/viewer-components-react.git/pull/807))

## 1.6.1

Thu, 04 Apr 2024 14:19:35 GMT

### Patches

- Removed border appearing around search button. ([#804](https://github.com/iTwin/viewer-components-react/pull/804))

## 1.6.0

Thu, 07 Mar 2024 13:37:08 GMT

### Minor changes

- Added support for `@itwin/presentation-components` version `5.x`. ([#793](https://github.com/iTwin/viewer-components-react/pull/793))
- Bumped `@itwin/itwinui-react` dependency version to `3.x` ([#793](https://github.com/iTwin/viewer-components-react/pull/793))

## 1.5.2

Thu, 29 Feb 2024 19:46:34 GMT

### Patches

- Fixed property widget being focused in a panel when there are more widgets and selection changes ([#780](https://github.com/iTwin/viewer-components-react/pull/780))

## 1.5.1

Thu, 18 Jan 2024 15:05:39 GMT

### Patches

- Update `@itwin/itwinui-react` version to `2.12.19`. ([#720](https://github.com/iTwin/viewer-components-react/pull/720))

## 1.5.0

Thu, 11 Jan 2024 14:32:37 GMT

### Minor changes

- Added React 18 support. ([#724](https://github.com/iTwin/viewer-components-react/pull/724))

## 1.4.1
Thu, 04 Jan 2024 16:26:24 GMT

### Patches

- Fix incorrect `PropertyGrid` title on concurrent `getData()` calls.

## 1.4.0
Fri, 10 Nov 2023 14:46:30 GMT

### Minor changes

- Add filtering support.

## 1.3.0
Tue, 29 Aug 2023 13:48:47 GMT

### Minor changes

- Make selected items list striped.

## 1.2.0
Fri, 25 Aug 2023 14:06:04 GMT

### Minor changes

- Sort selected elements list by label in an ascending order.
- Improved property editing workflow by adding data provider to `onPropertyUpdated` callback arguments.

## 1.1.2
Fri, 18 Aug 2023 11:01:29 GMT

### Patches

- Correctly determine if element has parent element when both are instances of the same class.

## 1.1.1
Thu, 17 Aug 2023 14:42:37 GMT

### Patches

- Fixed `Selected elements` button not appearing sometimes when selection changes quickly.

## 1.1.0
Mon, 07 Aug 2023 13:36:23 GMT

### Minor changes

- Added ability to override behavior of default context menu items.

### Patches

- Fixed scrollbar not appearing when property grid content starts overflowing.

## 1.0.1
Mon, 02 Aug 2023 12:11:36 GMT

### Patches

- Render property grid header even when too many elements are selected.

## 1.0.0
Mon, 31 Jul 2023 14:10:09 GMT

### Breaking changes

- Bumped AppUI peer dependencies to `^4.3.0`.
- Replaced `enableAncestorNavigation` property with `ancestorsNavigationControls` to allow using custom components for ancestors navigation.
- Removed properties used to configure data provider in favor of `createDataProvider` prop for supplying custom data provider.
- Removed properties used for enabling/disabling context menu items in favor of `contextMenuItems` list that is now used to populate context menu.
- Removed `customOnDataChanged` property. `createDataProvider` and `IPresentationPropertyDataProvider.onDataChanged` should be used instead.
- Removed `Show/Hide Empty Values` setting from context menu and moved it to the setting dropdown in header.

### Minor changes

- Refactored preferences storing to allow persisting new settings in the future.
- Added settings dropdown menu inside Property Grid header.

### Patches

- Handle errors thrown from property grid component.
- Persist property grid scroll position when switching between widgets.
- Fixed property grid not hiding empty struct and array properties.
- Improved keyboard navigation when navigating from Property Grid to Element List.

## 0.11.0
Tue, 23 May 2023 13:16:11 GMT

_Version update only_

## 0.10.0
Tue, 02 May 2023 16:12:17 GMT

### Minor changes

- Updated to AppUI 4.0 and Presentation 4.0.

## 0.9.0
Mon, 03 Apr 2023 15:34:07 GMT

### Minor changes

- Updated dependencies: `itwinjs-core@3.7`, `appui@4.0`, `presentation-components@4.0`, `itwinui@2.0`.

## 0.8.1
Thu, 04 Aug 2022 20:07:49 GMT

### Patches

- Created `FilteringPropertyGrid` which is called directly when `disableUnifiedSelection` is `true` or called through `FilteringPropertyGridWithUnifiedSelection` when false.

## 0.8.0
Fri, 22 Jul 2022 18:27:54 GMT

### Minor changes

- Persist show/hide null value toggle per user and not per iTwin/iModel

## 0.7.1
Fri, 08 Jul 2022 13:44:34 GMT

### Patches

- Instead of hiding the down navigation button, show it disabled.

## 0.7.0
Fri, 01 Jul 2022 13:49:17 GMT

### Minor changes

- Added ancestor navigation to the property grid.

## 0.6.0
Mon, 27 Jun 2022 20:00:02 GMT

### Minor changes

- Replaces deprecated `Table` with `MenuItem` from `@itwin/itwinui-react`, and fixes warning about deprecated `findDOMNode` usage.

## 0.5.5
Fri, 24 Jun 2022 16:51:25 GMT

### Patches

- Refresh property grid when frontstage changes with active selection set.

## 0.5.4
Wed, 08 Jun 2022 20:23:10 GMT

### Patches

- Added `persistNullValueToggle` property and the code to store this value in `UserPreferences` if true.

## 0.5.3
Thu, 26 May 2022 15:54:07 GMT

### Patches

- Allow a caller to specify a default priority for `PropertyGridUiItemsProvider`.
- Added option `forcePosition` property to `ContextMenuItemInfo`.

## 0.5.2
Wed, 18 May 2022 18:04:59 GMT

### Patches

- If the property grid is minimized do not force it open.

## 0.5.1
Wed, 18 May 2022 15:36:43 GMT

### Patches

- Fixed misaligned property grid header.
- Support overriding property grid auto child category expansion behavior.

## 0.5.0
Thu, 12 May 2022 16:56:06 GMT

### Minor changes

- Add ability to persist shared favorites via consuming app.

## 0.4.4
Wed, 11 May 2022 17:37:15 GMT

### Patches

- Allow default zone location to be overridden.

## 0.4.3
Tue, 10 May 2022 15:21:40 GMT

### Patches

- Manually bump to 0.4.2 to allow previous commits to be published.

## 0.4.1
Mon, 09 May 2022 18:04:58 GMT

### Patches

- Ensure the multi select property grid option appears if applicable when component first mounts.
- Don't open property grid tab when only transient elements (such as view sections) are selected.
- Fix `PropertyGridUiItemsProvider` when loading into AppUI v1.0.

## 0.4.0
Wed, 06 Apr 2022 13:48:44 GMT

### Minor changes

- Hide property grid by default.

### Patches

- `PropertyGridProps` expanded to allow default location.
- Remove widget control and add temporary support for ui 1.0.

## 0.3.1
Mon, 14 Mar 2022 19:46:44 GMT

### Patches

- Removed react-spring dependency, and replaced grid animation with css.

## 0.3.0
Thu, 17 Feb 2022 17:30:48 GMT

### Minor changes

- Update initialization to be lazy and make arguments optional.

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

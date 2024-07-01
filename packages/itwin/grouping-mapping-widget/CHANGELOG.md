# Change Log - @itwin/grouping-mapping-widget

This log was last generated on Fri, 28 Jun 2024 13:10:54 GMT and should not be manually modified.

<!-- Start content -->

## 0.27.0

Fri, 28 Jun 2024 13:10:54 GMT

### Minor changes

- Refactor of grouping and mapping properties UI, removed calculated property and custom calculation exports in favor of a single group property that contains all group property related logic, refactor includes a flat-list with icons representing the property type instead of three separate ones for properties list. ([#864](https://github.com/iTwin/viewer-components-react/pull/864))

### Patches

- Show only 1 spinner when toggling extraction ([#935](https://github.com/iTwin/viewer-components-react/pull/935))

## 0.26.1

Tue, 11 Jun 2024 15:52:38 GMT

### Patches

- Fixed an issue with the form validator allowing invalid characters if followed by a valid one. ([#930](https://github.com/iTwin/viewer-components-react/pull/930))

## 0.26.0

Tue, 21 May 2024 13:26:35 GMT

### Minor changes

- Updated insights client to 0.10.1 ([#806](https://github.com/iTwin/viewer-components-react/pull/806))

### Patches

- Fixed overlap progress bar not appearing in Groups component. ([#831](https://github.com/iTwin/viewer-components-react/pull/831))

## 0.25.2

Mon, 29 Apr 2024 14:59:26 GMT

### Patches

- Fixed a bad caching problem when opening the group with the extraction issue after opening extraction logs. ([#821](https://github.com/iTwin/viewer-components-react/pull/821))

## 0.25.1

Wed, 17 Apr 2024 17:54:44 GMT

### Patches

- Fixed an issue where a passed in iModelConnection was not being used by the widget shell. ([#815](https://github.com/iTwin/viewer-components-react/pull/815))

## 0.25.0

Wed, 17 Apr 2024 15:50:19 GMT

### Minor changes

- Switched to iTwinUI Lists component. ([#809](https://github.com:iTwin/viewer-components-react.git/pull/809))

### Patches

- Fixed isMounted returning false in certain situations. ([#814](https://github.com:iTwin/viewer-components-react.git/pull/814))

## 0.24.0

Thu, 29 Feb 2024 19:46:34 GMT

### Minor changes

- Property related components have been refactored to use react-query. ([#776](https://github.com/iTwin/viewer-components-react/pull/776))
- Added feature to trigger extraction and show extraction status on mapping UI. ([#733](https://github.com/iTwin/viewer-components-react/pull/733))

### Patches

- Fixed an issue where the list of properties would disappear if window was too small. ([#784](https://github.com/iTwin/viewer-components-react/pull/784))
- Fixed an issue where duplicate properties would be listed in group properties generation. ([#778](https://github.com/iTwin/viewer-components-react/pull/778))
- Fixed an issue where extraction status would go out of bounds when trying to find the group name in extraction logs. ([#768](https://github.com/iTwin/viewer-components-react/pull/768))
- Fixed an issue where job id's were potentially undefined. ([#777](https://github.com/iTwin/viewer-components-react/pull/777))
- Fixed an issue where visualized groups were not rehidden after going back into the Groups view. ([#783](https://github.com/iTwin/viewer-components-react/pull/783))

## 0.23.1

Fri, 02 Feb 2024 00:04:15 GMT

### Patches

- Fixed an issue where hidden elements would not reappear when the group for those elements was deleted and group color was disabled. ([#753](https://github.com/iTwin/viewer-components-react/pull/753))
- Fixed iModel selection not populating in Import Mappings. ([#755](https://github.com/iTwin/viewer-components-react/pull/755))
- Fixed form validation not running when creating a group. ([#748](https://github.com/iTwin/viewer-components-react/pull/748))

## 0.23.0

Mon, 29 Jan 2024 21:37:20 GMT

### Minor changes

- Groups related components have been refactored to use react-query. ([#739](https://github.com/iTwin/viewer-components-react/pull/739))

### Patches

- Presentation is now correctly localized. ([#745](https://github.com/iTwin/viewer-components-react/pull/745))

## 0.22.0
Mon, 18 Dec 2023 18:31:01 GMT

### Minor changes

- Mapping related components have been refactored to use react-query.

### Patches

- Added new functions for Custom Calculations in FormulaFunctionProvider.ts

## 0.21.1
Fri, 01 Dec 2023 13:46:38 GMT

### Patches

- Fixed extraction error message not showing.

## 0.21.0
Fri, 10 Nov 2023 14:46:30 GMT

### Minor changes

- iTwin.js minimum version bumped to 4.1

## 0.20.1
Tue, 07 Nov 2023 13:43:31 GMT

### Patches

- Kept extraction status data consistent when navigating through Mapping and Group components.

## 0.20.0
Thu, 26 Oct 2023 13:09:22 GMT

### Minor changes

- New visualization logic to distinctly highlight elements that overlap across multiple groups

### Patches

- Removed iModelId and replaced MappingId and GroupId with names in log messages.
- Only allowed one selection for radio buttons for the custom filter of the Extraction Error Log.

## 0.19.2
Mon, 02 Oct 2023 20:32:55 GMT

### Patches

- Changed filter radio buttons to checkboxes

## 0.19.1
Fri, 29 Sep 2023 20:08:20 GMT

### Patches

- Added a formula parser for indexof in Custom Calculation properties.
- Added an icon and modal to expose extraction log messages.

## 0.19.0
Tue, 19 Sep 2023 14:55:43 GMT

### Minor changes

- Added the `GroupsViews` component: a reusable, state-agnostic UI component for managing Groups.
- Renamed Groupings component to Groups for consistency.

### Patches

- Enabled query experimental features e.g '$->'.

## 0.18.1
Thu, 24 Aug 2023 21:32:34 GMT

### Patches

- Added missing state to restore missing import mapping button to default UI.

## 0.18.0
Thu, 17 Aug 2023 14:42:37 GMT

### Minor changes

- Added the `MappingsView` component: a reusable, state-agnostic UI component for managing Mappings.
- Typescript version bump to ^4.5.0

### Patches

- Added a Progress bar when Color By Group

## 0.17.5
Wed, 02 Aug 2023 12:11:30 GMT

### Patches

- Modified operator validation delay time and behavior

## 0.17.4
Wed, 26 Jul 2023 21:49:07 GMT

### Patches

- Adds an informational icon that the user can hover over to learn about custom calculation formulas. Also adds a placeholder to the formula Textarea with an example formula.

## 0.17.3
Mon, 24 Jul 2023 17:26:29 GMT

### Patches

- Added tooltips to buttons.

## 0.17.2
Thu, 20 Jul 2023 20:15:04 GMT

### Patches

- Made Selected Items section expand by default
- Made group creation options fully shown when there is space
- Fixed unicode bug to meet OData simple identifier requirement

## 0.17.1
Tue, 18 Jul 2023 14:40:24 GMT

### Patches

- Added a dropdown arrow for the Add Group button.
- Fixed Color Legend not appearing bug.
- Fixed Enable/Disable Extraction bug
- Added a modal to confirm a property name change.

## 0.17.0
Fri, 09 Jun 2023 17:54:42 GMT

### Minor changes

- New version of the package targeting iTwin.js 4.x and iTwinUI 2.x!

## 0.16.1
Tue, 06 Jun 2023 10:57:06 GMT

### Patches

- Fixed small overflow style issue.

## 0.16.0
Mon, 15 May 2023 16:32:30 GMT

### Minor changes

- Refactored Copy Mapping modal UI to remove dependency on @itwin/imodel-browser-react. The widget now additionally requires the `itwins:read` scope to support the changes. 
- @itwin/grouping-mapping-widget updated to itwinjs 3.7.4.

## 0.15.1
Thu, 04 May 2023 23:59:19 GMT

### Patches

- Resolved a bug that prevented Group Properties from being displayed when GroupPropertyAction was utilized without a viewer.

## 0.15.0
Thu, 27 Apr 2023 16:44:34 GMT

### Minor changes

- Added ability to provide an iModelConnection.
- Added shouldVisualize prop to GroupAction which enables or disables visualization.

### Patches

- Fixed a bug in both Mapping and Groupings components where the title remained clickable even when onClickTitle was undefined. The title is now no longer clickable in such cases.
- Fixed Group By not visualizing queries.

## 0.14.0
Mon, 24 Apr 2023 19:57:10 GMT

### Minor changes

- Grouping component no longer handles Group visualization. This has been moved to the new GroupsVisualization component.
- CalculatedPropertyAction visualization toggle has been moved to CalculatedPropertyActionWithVisuals.
- PropertyMenu Group hiliting and information panel has been moved to PropertyMenuWithVisualization.
- Added additional prop to GroupCustomUI that supplies the initial Group's query during edit mode.

### Patches

- Groups visualization has been optimized.
- Fixed an issue that caused CustomUI's to show up twice on drop down menus.
- Fixed header not appearing while in ContextCustomUI

## 0.13.0
Tue, 18 Apr 2023 17:46:22 GMT

### Minor changes

- Updated the Selection query builder to use VirtualizedPropertyGridWithDataProvider from @itwin/components-react, replacing the previous PropertyGrid implementation.

### Patches

- Fixed a visualization race condition that caused some Groups to not visualize.
- Fixed Select Query Builder reset button. No longer fails to visualize. 

## 0.12.0
Mon, 03 Apr 2023 15:34:07 GMT

### Minor changes

- Improved modularity to PropertyMenu, GroupPropertyAction, CalculatedPropertyAction, CustomCalculationAction components.

## 0.11.1
Mon, 27 Mar 2023 10:30:56 GMT

### Patches

- Fixed a crash that occurred while creating a Group by Selection.

## 0.11.0
Thu, 23 Mar 2023 15:12:36 GMT

### Minor changes

- Added support to override Mappings name in Mappings component.

## 0.10.0
Tue, 07 Mar 2023 15:47:41 GMT

### Minor changes

- Improved modularity to Mapping, MappingAction, Grouping, GroupAction components.
- The view of the widget is now handled by a routing component that displays different views based on the "step" of the current route.
- Added "GroupingMappingContext" component to provide a context for all Grouping and Mapping components, including properties such as custom callback to retrieve access token, iModelId, client prefix, custom implementation of MappingClient, and custom UI's for adding and updating groups and providing additional group context capabilities.

### Patches

- Insights Client version bump. Removed url dependency.
- Added property override to Presentation within Properties selection to display all hidden properties.
- Change itwinui-react dependency version control to caret.

## 0.9.3
Thu, 19 Jan 2023 10:29:18 GMT

### Patches

- Exposed MappingClient context, related hooks and types.
- Exposed GroupingMappingApiConfig context, related hooks and types.

## 0.9.2
Fri, 16 Dec 2022 13:51:28 GMT

### Patches

- Modified border to the color legend for group hiliting to be narrower
- QueryBuilder: separated relational classes from properties, transferred properties from JOIN to WHERE clauses

## 0.9.1
Wed, 16 Nov 2022 19:55:30 GMT

### Patches

- Test coverage added
- Fixed group properties UI traversal to nested structs

## 0.9.0
Wed, 16 Nov 2022 16:49:55 GMT

### Minor changes

- Version bump

### Patches

- Fixed cross references in query builder query string
- Fixed group properties incorrectly generating aspects
- Added support for external source repository information (name/path) in group properties

## 0.8.3
Mon, 31 Oct 2022 19:03:27 GMT

### Patches

- Fixed duplication of JOIN statements in query builder

## 0.8.2
Mon, 17 Oct 2022 17:36:46 GMT

### Patches

- Fixed readme image render error and added tests for Custom UI providers
- Fixed key uniqueness issue in group properties.
- Fixed formula interpreter sometimes not recognising unary operators leading to errors in formula order.

## 0.8.1
Thu, 29 Sep 2022 19:04:42 GMT

### Patches

- Fixed text overflow issue.

## 0.8.0
Wed, 28 Sep 2022 20:44:12 GMT

### Minor changes

- Redesigned group properties UI.

## 0.7.0
Mon, 26 Sep 2022 17:13:11 GMT

### Minor changes

- Add context custom UI support
- Add custom UI extensibility for grouping and mapping and refactor default UI accordingly

## 0.6.0
Mon, 12 Sep 2022 19:50:36 GMT

### Minor changes

- Updated to insights client version 0.3.0

### Patches

- Added border to the color legend for group hiliting

## 0.5.8
Wed, 24 Aug 2022 14:01:03 GMT

### Patches

- Exporting GetAccessTokenFn type from GroupingApiConfigContext for consuming applications to use when setting up the GroupingMappingProvider

## 0.5.7
Mon, 22 Aug 2022 19:37:22 GMT

### Patches

- Updated the classNames within the grouping and mapping components to use `gmw-` prefix, added quick update to property-grid to return code to working state

## 0.5.6
Mon, 22 Aug 2022 18:03:47 GMT

### Patches

- Improved button wrapping in Groups view toolbar
- Changed search bar to match UX guidelines
- Cancel button fix in group by
- Replaced Mappings table with tile component
- Updated css classnames to be scoped to this package only

## 0.5.5
Mon, 08 Aug 2022 11:57:54 GMT

### Patches

- remove zoom on individual visibility change
- Optimized group hiliting

## 0.5.4
Thu, 28 Jul 2022 13:50:39 GMT

### Patches

- Fixed select in group properties
- add color legends for groups

## 0.5.3
Fri, 22 Jul 2022 18:27:54 GMT

### Patches

- group ordering by name

## 0.5.2
Mon, 18 Jul 2022 13:24:31 GMT

### Patches

- Query Keywords by default no longer takes selection when no keywords are applied
- Fixed incorrect prefix being applied on first render

## 0.5.1
Fri, 24 Jun 2022 21:18:52 GMT

### Patches

- Removed unneeded import

## 0.5.0
Fri, 24 Jun 2022 16:51:25 GMT

### Minor changes

- Custom accessToken parameter now takes a callback function

### Patches

- fix category bug and reset button
- fix category query 
- Exposed CustomCalculation formula DataType resolver.

## 0.4.0
Thu, 16 Jun 2022 14:09:35 GMT

### Minor changes

- Enhanced category selection to match based on string in group by selection

### Patches

- add unions of multiple selected classes
- enable group visibility and fix bugs
- Added extension point to provide a custom IMappingClient implementation.

## 0.3.5
Wed, 08 Jun 2022 20:23:10 GMT

### Patches

- Changed the extraction enable toggle label
- Formula validation fixes

## 0.3.4
Thu, 26 May 2022 15:54:07 GMT

### Patches

- Adds a toggle for enabling extraction in the add/edit mapping view and the three dot menu in the mappings table

## 0.3.3
Wed, 18 May 2022 15:36:43 GMT

### Patches

- Description is no longer required in mapping and groups
- Added custom calculation formula validation
- Import mappings modal converted to full page modal

## 0.3.2
Mon, 09 May 2022 18:04:58 GMT

### Patches

- Added optional access token and enviroment props and switched to insights-client

## 0.3.1
Tue, 19 Apr 2022 14:15:57 GMT

### Patches

- Improved query generation from query keywords

## 0.3.0
Wed, 06 Apr 2022 13:48:44 GMT

### Minor changes

- Add missing peer dep on core-frontend

### Patches

- Fixed cancel buttons being disabled initially and readded missing styles in calculated properties menu item
- Fixed group by selection spinners being triggered by mistake and package updates
- Add transitive peers as dev deps

## 0.2.3
Mon, 14 Mar 2022 19:46:44 GMT

### Patches

- Fixed a crash that happened with some categories in group by selection pane
- Fixed overlapping seperator in group by selection pane and polished loading spinners
- Added basic support for categories and models in group properties.
- Package updates
- Added ability to search for elements using search terms

## 0.2.2
Wed, 02 Mar 2022 21:38:51 GMT

### Patches

- Added more error handling and reduced verbosity
- Fixed invalid query generated from aspects

## 0.2.1
Tue, 15 Feb 2022 15:51:36 GMT

### Patches

- Fixed aspect element id's in group queries not being picked up by extractor
- Improved error handling and small tweaks to import mapping wizard
- This adds a check for AbstractZoneLocation.CenterLeft (4) in GroupinngMappingWidget so that the widget will be returned when called by UiItemsProviders in UI 1.0 contexts. This does not affect UI 2.0 uses.
- Fixed property menu overflow
- Changed property menu icon
- Fixed missing struct properties in group properties

## 0.2.0
Fri, 04 Feb 2022 00:43:35 GMT

### Minor changes

- ADDED: Grouping and Mapping Widget first commit to the VCR repository. This is a UI Provider that interfaces with the iTwin Reporting Platform APIs.

# Change Log - @itwin/grouping-mapping-widget

This log was last generated on Wed, 28 Sep 2022 20:44:12 GMT and should not be manually modified.

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


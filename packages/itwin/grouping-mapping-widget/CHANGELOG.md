# Change Log - @itwin/grouping-mapping-widget

This log was last generated on Mon, 09 May 2022 18:04:58 GMT and should not be manually modified.

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


# Change Log - @itwin/grouping-mapping-widget

This log was last generated on Thu, 16 Jun 2022 14:09:35 GMT and should not be manually modified.

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


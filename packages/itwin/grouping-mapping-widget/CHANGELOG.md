# Change Log - @itwin/grouping-mapping-widget

This log was last generated on Tue, 15 Feb 2022 15:51:36 GMT and should not be manually modified.

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


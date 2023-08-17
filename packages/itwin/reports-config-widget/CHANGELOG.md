# Change Log - @itwin/reports-config-widget-react

This log was last generated on Thu, 17 Aug 2023 14:42:37 GMT and should not be manually modified.

## 0.4.0
Thu, 17 Aug 2023 14:42:37 GMT

### Minor changes

- Typescript version bump to ^4.5.0
- Migrated UI items for iTwin UI 2.x and iTwinJS 4.x upgrade.

### Patches

- Removed trash icon in tile if update dataset is queued
- Moved toolbar icons to the right
- Changed update dataset icon

## 0.3.0
Tue, 23 May 2023 13:16:11 GMT

### Minor changes

- Improved modularity to Reports, ReportMappings, and ReportAction components.
- Added a ReportsConfigContext component to manage the configuration of the Reports API, including token retrieval, baseURL, iTwinId, iModelId, and bulk extraction.
- The view of the widget is now handled by a routing component that displays different views based on the "step" of the current route.

## 0.2.1
Tue, 07 Mar 2023 15:47:41 GMT

### Patches

- Insights Client version bump. Removed url dependency.
- Change itwinui-react dependency version control to caret.

## 0.2.0
Thu, 19 Jan 2023 10:29:18 GMT

### Minor changes

- Extraction workflow for mappings updated.
- IModel extraction dropdown removed.

## 0.1.0
Mon, 31 Oct 2022 19:03:27 GMT

### Minor changes

- Datasets can be updated in the Reports page. Reports tiles are now selectable

## 0.0.8
Thu, 29 Sep 2022 19:04:42 GMT

### Patches

- Fixed text overflow issue.

## 0.0.7
Mon, 12 Sep 2022 19:50:36 GMT

### Patches

- updated insights client to 0.3.0

## 0.0.6
Mon, 08 Aug 2022 11:57:54 GMT

### Patches

- Added missing dev dependencies

## 0.0.5
Thu, 04 Aug 2022 20:07:49 GMT

### Patches

- Added a missing dev dep

## 0.0.4
Thu, 28 Jul 2022 13:50:39 GMT

### Patches

- Fixed infinite loop in Report Mappings

## 0.0.3
Fri, 24 Jun 2022 16:51:25 GMT

### Patches

- Unit tests fix
- More unit test refinements 

## 0.0.2
Thu, 16 Jun 2022 14:09:35 GMT

### Patches

- Fixed repository url
- Fixed some flaky unit tests
- ReadMe update

## 0.0.1
Tue, 14 Jun 2022 16:01:06 GMT

### Patches

- Initial release of the reports config widget for Reporting Platform


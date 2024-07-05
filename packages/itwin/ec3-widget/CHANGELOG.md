# Change Log - @itwin/ec3-widget-react

This log was last generated on Fri, 05 Jul 2024 12:20:16 GMT and should not be manually modified.

<!-- Start content -->

## 0.9.1

Fri, 05 Jul 2024 12:20:16 GMT

### Patches

- Bug fix for report-id assignment condition and some file rename exercise for better readability and localization. ([#983](https://github.com/iTwin/viewer-components-react/pull/983))

## 0.9.0

Wed, 03 Jul 2024 19:31:08 GMT

### Minor changes

- Added template id in export callback ([#981](https://github.com/iTwin/viewer-components-react/pull/981))

### Patches

- Added missing localization strings ([#981](https://github.com/iTwin/viewer-components-react/pull/981))

## 0.8.1

Tue, 02 Jul 2024 14:49:30 GMT

### Patches

- Fix for localization ([#978](https://github.com/iTwin/viewer-components-react/pull/978))

## 0.8.0

Fri, 28 Jun 2024 13:10:54 GMT

### Minor changes

- Added localization support. ([#968](https://github.com/iTwin/viewer-components-react/pull/968))
- Added callback props for EC3 export ([#972](https://github.com/iTwin/viewer-components-react/pull/972))
- UX revamp for EC3 template creation workflow ([#940](https://github.com/iTwin/viewer-components-react/pull/940))

## 0.7.0

Tue, 11 Jun 2024 15:52:38 GMT

### Minor changes

- Added props that allow custom implementations of ReportsClient, OdataClient, EC3JobsClient, EC3ConfigurationsClient. ([#897](https://github.com/iTwin/viewer-components-react/pull/897))

## 0.6.0

Mon, 10 Jun 2024 17:40:38 GMT

### Minor changes

- Upgraded insights-client version to 0.10.1, fixed functions using old dependencies ([#841](https://github.com/iTwin/viewer-components-react/pull/841))

## 0.5.0

Mon, 29 Apr 2024 14:59:26 GMT

### Minor changes

- Replaced duplicate types with types from @itwin/insights-client. ([#818](https://github.com/iTwin/viewer-components-react/pull/818))

## 0.4.1
Thu, 24 Aug 2023 21:32:34 GMT

### Patches

- Modified toolbar layout in EC3 widget to be consistent with G&M widget.
- Truncated long assembly name when in narrow width.

## 0.4.0
Fri, 18 Aug 2023 11:01:29 GMT

### Minor changes

- Migrated UI items for iTwin UI 2.x and iTwinJS 4.x upgrade.

### Patches

- Removed frame around Add Assembly button and changed button type.

## 0.3.0
Thu, 17 Aug 2023 14:42:37 GMT

### Minor changes

- Typescript version bump to ^4.5.0

## 0.2.0
Tue, 18 Jul 2023 14:40:24 GMT

### Minor changes

- Improved modularity to Templates and TemplateMenu components.
- Added a EC3Context component to manage the configuration of the components.
- EC3ConfigProps was introduced, which can either be EC3ConfigPropsWithRedirectUri or EC3ConfigPropsWithGetEC3AccessToken, which gives the option of two authentication methods.
- A new property iTwinId was introduced in EC3Config, enabling the configuration to be tied to a specific iTwin instance.

## 0.1.1
Fri, 23 Jun 2023 15:11:15 GMT

### Patches

- Fixed horizontal tiles not having consistent sizing.

## 0.1.0
Mon, 20 Mar 2023 14:48:35 GMT

### Minor changes

- Initial commit

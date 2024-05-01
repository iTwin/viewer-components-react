# Change Log - @itwin/ec3-widget-react

This log was last generated on Mon, 29 Apr 2024 14:59:26 GMT and should not be manually modified.

<!-- Start content -->

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

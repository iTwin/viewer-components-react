# Change Log - @itwin/quantity-formatting-react

## 0.2.0

### Minor Changes

- [#1828](https://github.com/iTwin/viewer-components-react/pull/1828): `unitsProvider` is now optional on `QuantityFormatPanel`, `FormatPanel`, and `FormatSample`. When omitted, the components use `IModelApp.quantityFormatter.unitsProvider` (the bundled BIS units unless the app replaces it) and update when `IModelApp.quantityFormatter.onUnitsProviderChanged` fires.
- [#1828](https://github.com/iTwin/viewer-components-react/pull/1828): Add `@itwin/core-common` and `@itwin/ecschema-metadata` as peer dependencies, since public types already reference them. `QuantityFormatting.startup` now shares a single in-flight initialization, and reading `QuantityFormatting.localization` before startup throws a descriptive error.

### Patch Changes

- [#1827](https://github.com/iTwin/viewer-components-react/pull/1827): Composite unit editing only offers sub-units that divide the parent unit into a whole number of parts, so degree-minute-second angle and azimuth formats can be built with "Add sub-unit". The unit label input shows the default unit label as a placeholder when no custom label is set.
- [#1827](https://github.com/iTwin/viewer-components-react/pull/1827): The decimal and thousands separators can no longer both be set to the same character while the thousands separator is enabled. Enabling it, or changing either separator while it is enabled, switches the other separator when they collide. Unset separators are compared using the formatter's locale defaults.
- [#1827](https://github.com/iTwin/viewer-components-react/pull/1827): Format trait checkboxes such as "Show unit label" now recognize persisted traits regardless of casing (for example `ShowUnitLabel`), and toggling a trait removes every casing variant instead of leaving duplicates behind.
- [#1827](https://github.com/iTwin/viewer-components-react/pull/1827): Switching a horizontal-direction format (for example `Units.HORIZONTAL_DIR_ARC_DEG`) to bearing or azimuth now uses horizontal-direction revolution and base units. Previously it used angle units, which the formatter cannot convert to, so formatting failed.
- [#1827](https://github.com/iTwin/viewer-components-react/pull/1827): `FormatSelector` localizes its empty search message. Documented that `activeFormatSet` must be replaced with a new object when its formats change (for example after `FormatSetFormatsProvider.onFormatsChanged`); updating it in place leaves stale definitions in the list.

<!-- This log was last generated on Tue, 28 Apr 2026 15:59:28 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.1.5

Tue, 28 Apr 2026 15:59:28 GMT

### Patches

- Fix decimal precision label typo, stale closure in FormatSample sample input, keyboard handling to allow clipboard shortcuts and leading minus sign, and double-minus guard. ([#1666](https://github.com/iTwin/viewer-components-react/pull/1666))

## 0.1.4

Thu, 15 Jan 2026 14:30:28 GMT

### Patches

- Reword localized labels to accurately convey functionality ([#1507](https://github.com/iTwin/viewer-components-react/pull/1507))

## 0.1.3

Thu, 13 Nov 2025 09:36:43 GMT

### Patches

- Remove unwanted description from FormatSetSelector ([#1506](https://github.com/iTwin/viewer-components-react/pull/1506))
- Add active badge to FormatSetSelector, show descriptions onHover and onFocus for selector lists ([#1498](https://github.com/iTwin/viewer-components-react/pull/1498))

## 0.1.2

Mon, 13 Oct 2025 14:06:11 GMT

### Patches

- Update FormatSelector to be a list with a searchbox, instead of dropdown. Add FormatSetSelector, FormatSetPanel components, make UI more consistent. ([#1456](https://github.com/iTwin/viewer-components-react/pull/1456))

## 0.1.1

Tue, 16 Sep 2025 11:13:44 GMT

### Patches

- Update FormatSelector to be a list with a searchbox, instead of dropdown ([#1437](https://github.com/iTwin/viewer-components-react/pull/1437))

## 0.1.0

Wed, 20 Aug 2025 13:45:50 GMT

### Minor changes

- Add @itwin/quantity-formatting-react package ([#1404](https://github.com/iTwin/viewer-components-react/pull/1404))

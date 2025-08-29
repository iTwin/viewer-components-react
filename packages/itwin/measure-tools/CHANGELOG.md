# Change Log - @itwin/measure-tools-react

<!-- This log was last generated on Wed, 27 Aug 2025 13:53:50 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.29.3

Wed, 27 Aug 2025 13:53:50 GMT

### Patches

- fixed worldScale conversion being removed ([#1426](https://github.com/iTwin/viewer-components-react/pull/1426))

## 0.29.2

Tue, 26 Aug 2025 19:59:16 GMT

### Patches

- MeasurementWidget reacts to formatsProvider changes ([#1424](https://github.com/iTwin/viewer-components-react/pull/1424))

## 0.29.1

Fri, 22 Aug 2025 18:31:46 GMT

### Patches

- Fix aggregatableValues missing formatting in Measurement widgets ([#1420](https://github.com/iTwin/viewer-components-react/pull/1420))

## 0.29.0

Mon, 11 Aug 2025 13:31:19 GMT

### Minor changes

- Use separate KindOfQuantity for Coordinate Lengths, fallback to QuantityType as last resort ([#1397](https://github.com/iTwin/viewer-components-react/pull/1397))

## 0.28.2

Thu, 24 Jul 2025 16:07:32 GMT

### Patches

- Fix measure context toolbar to not move with cursor ([#1385](https://github.com/iTwin/viewer-components-react/pull/1385))

## 0.28.1

Mon, 07 Jul 2025 19:55:02 GMT

### Patches

- Removed unused `redux` peer dependency. ([#1368](https://github.com/iTwin/viewer-components-react/pull/1368))

## 0.28.0

Tue, 24 Jun 2025 15:02:05 GMT

### Minor changes

- Update quantity formatting logic, add bearing to DistanceMeasurement widget data ([#1336](https://github.com/iTwin/viewer-components-react/pull/1336))

## 0.27.0

Thu, 08 May 2025 14:29:47 GMT

### Minor changes

- Fix issue in MeasurementViewTypeClassifier. fallback classifiers had higher priority than registered classifier. ([#1312](https://github.com/iTwin/viewer-components-react/pull/1312))

## 0.26.4

Fri, 14 Mar 2025 21:21:43 GMT

### Patches

- Resolve GHSA-9crc-q9x8-hgqq ([#1244](https://github.com/iTwin/viewer-components-react/pull/1244))

## 0.26.3

Wed, 19 Feb 2025 21:08:10 GMT

### Patches

- Switch to mouse click event to close popup toolbar since new toolbar buttons need to use mouse down event to execute callback functions. ([#1208](https://github.com/iTwin/viewer-components-react/pull/1208))

## 0.26.2

Tue, 18 Feb 2025 21:33:04 GMT

### Patches

- Add 'types' field in package.json. This fixes some issues for consumers when importing the esm package with moduleResolution: node. (export map support seems flaky in those cases.) ([#1192](https://github.com/iTwin/viewer-components-react/pull/1192))

## 0.26.1

Wed, 29 Jan 2025 21:54:15 GMT

### Patches

- sheets are not required to have jsonProperties ([#1165](https://github.com/iTwin/viewer-components-react/pull/1165))

## 0.26.0

Mon, 27 Jan 2025 18:30:40 GMT

### Minor changes

- Drop CJS in measure-tools. Add .js suffixes per ESM requirement. ([#1160](https://github.com/iTwin/viewer-components-react/pull/1160))

## 0.25.0

Tue, 14 Jan 2025 02:51:04 GMT

### Minor changes

- Update to iTwinUI@3. Bumps AppUI peer deps to ^4.17 and move iTwinUI to peer dep ([#1097](https://github.com/iTwin/viewer-components-react/pull/1097))

## 0.24.1

Fri, 29 Nov 2024 10:43:06 GMT

### Patches

- provide a callback to allow the application to decide whether to show or hide the measurement tools ([#1096](https://github.com/iTwin/viewer-components-react/pull/1096))

## 0.24.0

Tue, 12 Nov 2024 12:57:13 GMT

### Minor changes

- Add support for additional Toolbar items to MeasureToolsUiItemsProvider ([#1074](https://github.com/iTwin/viewer-components-react/pull/1074))
- initiial callback for base and area ([#1079](https://github.com/iTwin/viewer-components-react/pull/1079))

## 0.23.2

Thu, 31 Oct 2024 11:11:57 GMT

### Patches

- inverted logic from checkAllowedDrawingType ([#1073](https://github.com/iTwin/viewer-components-react/pull/1073))
- Added helper functions and tooltip ([#1075](https://github.com/iTwin/viewer-components-react/pull/1075))

## 0.23.1

Tue, 22 Oct 2024 14:42:00 GMT

### Patches

- fixed imports and naming ([#1068](https://github.com/iTwin/viewer-components-react/pull/1068))

## 0.23.0

Tue, 15 Oct 2024 20:19:11 GMT

### Minor changes

- Add a tool settings to measuredistance tool allowing consecutive / multi point measurements ([#1047](https://github.com/iTwin/viewer-components-react/pull/1047))

### Patches

- Fix recursive loop from setState inside useEffect ([#1065](https://github.com/iTwin/viewer-components-react/pull/1065))

## 0.22.1

Tue, 24 Sep 2024 11:54:49 GMT

### Patches

- Fix missing geo location information for location measurement in widget. ([#1053](https://github.com/iTwin/viewer-components-react/pull/1053))

## 0.22.0

Wed, 28 Aug 2024 15:15:02 GMT

### Minor changes

- drawingTypeCache refactor ([#992](https://github.com/iTwin/viewer-components-react/pull/992))

## 0.21.0

Tue, 20 Aug 2024 13:08:31 GMT

### Minor changes

- The measure tools ui-provider can accept an array of strings for StageUsages, rather than hardcode "General". It still defaults to "General", so it's backwards compatible. ([#1020](https://github.com/iTwin/viewer-components-react/pull/1020))
- drawingTypeCache refactor ([#992](https://github.com/iTwin/viewer-components-react/pull/992))

## 0.20.0

Mon, 22 Jul 2024 11:53:05 GMT

### Minor changes

- update itwinjs packages to 4.7 to use apis promoted to public, or alternative apis used to replace some internal apis ([#993](https://github.com/iTwin/viewer-components-react/pull/993))

## 0.19.0

Tue, 09 Jul 2024 13:20:07 GMT

### Minor changes

- Adds profileTransform to drawing data ([#986](https://github.com/iTwin/viewer-components-react/pull/986))

## 0.18.0

Wed, 03 Jul 2024 19:31:08 GMT

### Minor changes

- Remove the usage of the IModelApp.telemetry for reporting telemetry. ([#552](https://github.com/iTwin/viewer-components-react/pull/552))

## 0.17.0

Tue, 02 Jul 2024 14:49:30 GMT

### Minor changes

- Measurement in sheets ([#837](https://github.com/iTwin/viewer-components-react/pull/837))

## 0.16.2

Fri, 28 Jun 2024 13:10:54 GMT

### Patches

- fixed bad rise ([#944](https://github.com/iTwin/viewer-components-react/pull/944))
- Handle blank imodel connection in SheetMeasurementHelper ([#946](https://github.com/iTwin/viewer-components-react/pull/946))

## 0.16.1

Thu, 13 Jun 2024 15:17:40 GMT

### Patches

- Export SheetMeasurementHelper in measure-tools-react package ([#939](https://github.com/iTwin/viewer-components-react/pull/939))

## 0.16.0

Mon, 10 Jun 2024 17:40:38 GMT

### Minor changes

- Add copy button to MeasurementPropertyWidget ([#843](https://github.com/iTwin/viewer-components-react/pull/843))

## 0.15.0

Wed, 29 May 2024 18:39:36 GMT

### Minor changes

- Measurement in sheets ([#837](https://github.com/iTwin/viewer-components-react/pull/837))

## 0.14.2
Thu, 05 Oct 2023 18:48:11 GMT

### Patches

- Clean up files delivered

## 0.14.1
Tue, 22 Aug 2023 14:39:05 GMT

### Patches

- Fix measurement action toolbar to close for scroll/click outside

## 0.14.0
Thu, 17 Aug 2023 14:42:37 GMT

### Minor changes

- Switch to Toolbar instead of ToolbarComposer for Measure Actions toolbar

## 0.13.0
Mon, 24 Jul 2023 17:26:29 GMT

### Minor changes

- Added allowActions property to Measurement base class to let measurements to opt out of the popup action toolbar. Fixed up internal usage of currentInputState with (soon to be) public APIs

## 0.12.2
Thu, 20 Jul 2023 20:15:05 GMT

### Patches

- Add listeners for unit system changes when starting decorator

## 0.12.1
Fri, 23 Jun 2023 15:11:15 GMT

### Patches

- Content in measurements widget needs some padding

## 0.12.0
Tue, 23 May 2023 13:16:11 GMT

_Version update only_

## 0.11.0
Tue, 02 May 2023 16:12:17 GMT

### Minor changes

- Updated to AppUI 4.0 and Presentation 4.0

## 0.10.6
Thu, 01 Dec 2022 14:13:39 GMT

### Patches

- Add listeners to quantityFormatter events we did not account for. Fix issues where a qf override was being set and the measure-tools weren't picking up the change.

## 0.10.5
Wed, 16 Nov 2022 19:55:30 GMT

### Patches

- Hide perpendicular measure tool for drawing view

## 0.10.4
Mon, 31 Oct 2022 19:03:27 GMT

### Patches

- Hide measurement tools button on sheet view.

## 0.10.3
Wed, 19 Oct 2022 14:17:36 GMT

### Patches

- customize widget placement in ui items provider

## 0.10.2
Mon, 17 Oct 2022 17:36:46 GMT

### Patches

- Added launch configs to debug tests properly. Change the minute/second symbols to match what is being used in IModelApp.quantityFormatter. Fix inconsistencies with the slope formatting.

## 0.10.1
Mon, 26 Sep 2022 17:13:11 GMT

### Patches

- Account for the global origin when displaying coordinate values if the measurement is tied to a spatial view.
- Add missing event listener to update the measurement widget when the global origin is changed.
- Make sure we also refresh displayed measurements if the global origin changes. Fix an issue where the text marker would go past the DistanceMeasurement line.
- Factor our the point adjustment logic into a helper function. Add listener for the onGlobalOriginChanged event in the ui 2.0 widget.

## 0.10.0
Wed, 03 Aug 2022 16:36:24 GMT

### Minor changes

- Temporarily fix a problem in core-geometry where Ray3d.createStartEnd captures the origin point instead of copying it. This solves an issue where the DistanceMeasurement's start point was being modified when it shouldn't have. (This will be fixed with PR #4012 on itwinjs-core.)

## 0.9.0
Thu, 28 Jul 2022 13:50:39 GMT

### Minor changes

- Fix obtaining the initial tool settings value. onPostInstall is called after the tool settings is created. Ensure we only notify user once if the iModel is not geolocated. Found a problem where we would output a message on each mouse motion (using dynamic measurement) which would clutter the whole screen.

## 0.8.0
Mon, 18 Jul 2022 13:24:31 GMT

### Minor changes

- Added toolsettings to the MeasureLocationTool.

## 0.7.3
Thu, 16 Jun 2022 14:09:35 GMT

### Patches

- Add option to set itemPriority for MeasureToolsUiItemsProvider

## 0.7.2
Thu, 26 May 2022 15:54:07 GMT

### Patches

- Fix obtaining localized strings for the various tools.
- Fixed an issue where cumulative diameter is incorrect for RadiusMeasurement. Also, changed the way we compute the text position for DistanceMeasurement such that it should not display if the measurement is 'behind' the camera eye.

## 0.7.1
Wed, 18 May 2022 15:36:43 GMT

### Patches

- Modify MeasurementPropertyWidget such that adding or removing measurements one by one does not collapse them. This was working in the MeasurementWidget.

## 0.7.0
Wed, 06 Apr 2022 13:48:44 GMT

### Minor changes

- Hide Measurement widget until measurement is selected"

### Patches

- remove setTimeout from useEffect
- Add transitive peers as dev deps

## 0.6.0
Wed, 02 Mar 2022 21:38:51 GMT

### Minor changes

- Bump to official iTwin.js 3.0 release

### Patches

- Update license year

## 0.1.2
Wed, 19 Jan 2022 17:39:40 GMT

### Patches

- updated to latest rc, dev-185, and updated deps

## 0.1.1
Wed, 12 Jan 2022 13:59:35 GMT

### Patches

- iTwin.js 3.0 first rc

## 0.5.0
Sun, 10 Oct 2021 03:39:20 GMT

### Minor changes

- Added label property to base measurements so they can be named, standard measurements will display this in the property widget if defined.
- Added decorateCached to measurement base class, allowing for subclasses to participate in cached graphics drawing (rather than having to manage their own cached graphics like AreaMeasurement had to do for performance reasons). Added methods to invalidate both regular decorations and cached decorations.

## 0.4.1
Thu, 16 Sep 2021 17:55:54 GMT

### Patches

- Stop delivering psuedo-localized strings

## 0.4.0
Thu, 19 Aug 2021 20:11:48 GMT

### Minor changes

- Add an isVisible property to the measurement base class
- Update iTwin.js minimum dependencies to ^2.19.0

### Patches

- Do not activate Accudraw by default in the measure tools, but setup the hints so if it is activated or get activated it will be setup correctly

## 0.3.0
Tue, 13 Jul 2021 17:43:28 GMT

### Minor changes

- Update iTwin.js minimum dependencies to ^2.17.0

## 0.2.0
Tue, 08 Jun 2021 21:23:59 GMT

### Minor changes

- Initial release of bentley/measure-tools-react!

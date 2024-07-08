# Change Log - @itwin/measure-tools-react

This log was last generated on Wed, 03 Jul 2024 19:31:08 GMT and should not be manually modified.

<!-- Start content -->

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

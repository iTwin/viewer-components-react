# Change Log - @itwin/measure-tools-react

This log was last generated on Mon, 18 Jul 2022 13:24:31 GMT and should not be manually modified.

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


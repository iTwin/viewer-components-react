# Change Log - @itwin/property-grid-react

This log was last generated on Wed, 12 Jan 2022 13:59:35 GMT and should not be manually modified.

## 0.1.1
Wed, 12 Jan 2022 13:59:35 GMT

### Patches

- iTwin.js 3.0 first rc

## 2.2.5
Fri, 10 Dec 2021 15:33:50 GMT

### Patches

- Fix for info button not appearing when multiple elements are selected

## 2.2.4
Thu, 30 Sep 2021 19:32:32 GMT

### Patches

- Styling updates to include displaying an ellipsis for header labels, consistent header size (50px) and consistent back button lozation.

## 2.2.3
Thu, 16 Sep 2021 17:55:54 GMT

### Patches

- Stop delivering psuedo-localized strings

## 2.2.2
Mon, 30 Aug 2021 17:10:22 GMT

### Patches

- Fix bug where label and class name didnt show in multi element property grid, as well as an animation bug

## 2.2.1
Thu, 26 Aug 2021 15:28:08 GMT

### Patches

- Remove unused PropertyGrid Extension that never worked. Make sure i18n gets delivered"

## 2.2.0
Wed, 25 Aug 2021 18:17:58 GMT

### Minor changes

- Updated class based components to functional. UiProvider now adds the multi element property grid instead of the previous single element property grid. Deprecated a few props which are unused and will be removed in next major.

## 2.1.0
Fri, 20 Aug 2021 18:32:34 GMT

### Minor changes

- Changes the PropertyGrid UiProvider to use a new PropertyGrid functional component

## 2.0.0
Thu, 08 Jul 2021 20:22:14 GMT

### Breaking changes

- Added support for FilteringPropertyDataProvider in PropertyGrid

## 1.3.7
Tue, 08 Jun 2021 21:23:59 GMT

### Patches

- fix classnames import

## 1.3.6
Mon, 26 Apr 2021 15:52:28 GMT

### Patches

- Added property grid manager to multi element select for property group nesting flag.

## 1.3.5
Thu, 04 Feb 2021 21:41:55 GMT

### Patches

- update to property favoriting to work with nested props

## 1.3.4
Thu, 28 Jan 2021 22:45:16 GMT

### Patches

- added highlight color when hovering over property in grid

## 1.3.3
Mon, 11 Jan 2021 21:36:07 GMT

### Patches

- fixed duplicate scrollbars via CSS

## 1.3.2
Mon, 21 Dec 2020 16:29:36 GMT

### Patches

- update deps
- drop min ver of core required to be 2.6.0

## 1.3.1
Wed, 09 Dec 2020 19:09:13 GMT

### Patches

- removed height on property panel header

## 1.3.0
Tue, 24 Nov 2020 14:14:52 GMT

### Minor changes

- Updated core packages to 2.9.2

### Patches

- Updated property grid to virtualized property grid.

## 1.2.1
Thu, 01 Oct 2020 15:19:45 GMT

### Patches

- feature flagged nested property category groups

## 1.2.0
Tue, 29 Sep 2020 20:33:53 GMT

### Minor changes

- Add nested property grouping

## 1.1.4
Wed, 26 Aug 2020 14:45:55 GMT

### Patches

- Fix for property panel not maintaining favorite properties

## 1.1.3
Tue, 25 Aug 2020 16:57:36 GMT

### Patches

- React-spring: Import from CommonJS to avoid issues with jest

## 1.1.2
Mon, 24 Aug 2020 19:57:25 GMT

### Patches

- make react-spring a peer dep to avoid versioning issues in it1

## 1.1.1
Mon, 24 Aug 2020 17:39:24 GMT

### Patches

- alphabetize package.json

## 1.1.0
Fri, 21 Aug 2020 21:17:48 GMT

### Minor changes

- Added multi-element property grid that has support for selecting single elements based on selection set. First pass at property grid extension.

### Patches

- minor pkg reorder
- fix property grid source file headers

## 1.0.2
Tue, 11 Aug 2020 14:24:07 GMT

### Patches

- Fixing inf recursion with property grid data loader

## 1.0.1
Mon, 20 Jul 2020 19:24:20 GMT

### Patches

- Adjusted package to conform to PR comments for improvements


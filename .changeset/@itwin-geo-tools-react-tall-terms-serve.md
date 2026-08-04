---
"@itwin/geo-tools-react": patch
---

Fixed an issue where the `GeoAddressSearch` dropdown could close unexpectedly while using the arrow keys to navigate search results. Navigation key events are now kept within the search component so parent controls cannot steal focus.

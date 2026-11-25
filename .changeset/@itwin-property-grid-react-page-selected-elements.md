---
"@itwin/property-grid-react": minor
---

Load selected elements in sorted pages of 100. Scrolling near the end of the list appends skeleton placeholders and loads the next page, instead of loading every label up front.

The `elements-list-page-load` performance event is emitted for each page. The `elements-list-load` event is no longer emitted.

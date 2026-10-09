---
"@itwin/quantity-formatting-react": patch
---

`FormatSelector` localizes its empty search message. Documented that `activeFormatSet` must be replaced with a new object when its formats change (for example after `FormatSetFormatsProvider.onFormatsChanged`); updating it in place leaves stale definitions in the list.

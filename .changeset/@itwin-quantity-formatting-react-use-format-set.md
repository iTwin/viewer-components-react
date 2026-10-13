---
"@itwin/quantity-formatting-react": minor
---

Add `useFormatSet(formatSet, formatsProvider)`, which returns a copy of a format set that is replaced after each `onFormatsChanged`. Pass it to `FormatSelector` as `activeFormatSet` so applied changes show up when `FormatSetFormatsProvider` updates the format set in place.

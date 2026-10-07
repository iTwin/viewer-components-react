---
"@itwin/quantity-formatting-react": patch
---

`FormatSelector` returns the latest format definition after the active format set is updated in place (for example through `FormatSetFormatsProvider.addFormat`), so switching between formats no longer shows stale settings.

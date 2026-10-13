---
"@itwin/quantity-formatting-react": minor
---

Add `@itwin/core-common` and `@itwin/ecschema-metadata` as peer dependencies, since public types already reference them. `QuantityFormatting.startup` now shares a single in-flight initialization, and reading `QuantityFormatting.localization` before startup throws a descriptive error.
